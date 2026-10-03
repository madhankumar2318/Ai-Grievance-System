package com.aigrievance.system.security;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.FilterConfig;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Servlet filter that enforces per-IP rate limits directly at the Spring Boot layer.
 *
 * Protects against:
 *  - Direct-to-backend brute-force login attempts on POST /api/auth/login (10/min)
 *  - Rapid registration spam on POST /api/auth/register (5/min)
 *  - Gemini Vision AI quota exhaustion via POST /api/complaints/analyze-photo (10/min)
 *  - Complaint submission spam via POST /api/complaints (20/min)
 *  - Complaint ID enumeration and brute-force via GET /api/complaints/{id} (30/min)
 *  - Status modification flooding via POST /api/complaints/update-status (30/min)
 *  - Citizen history scraping via GET /api/complaints/user/{email} (30/min)
 */
@Component
public class RateLimitingFilter implements Filter {

    private static final long WINDOW_MS = 60_000L; // 1-minute sliding window

    /** Endpoint-specific limits: static path -> max requests per window */
    private static final Map<String, Integer> ENDPOINT_LIMITS = Map.of(
            "/api/auth/login",                 10,
            "/api/auth/register",              5,
            "/api/complaints/analyze-photo",   10,
            "/api/complaints/update-status",   30
    );
    private static final int COMPLAINTS_POST_LIMIT = 20;
    private static final int COMPLAINT_LOOKUP_LIMIT = 30;
    private static final int USER_COMPLAINTS_LIMIT = 30;

    /** Key: "ip|bucket" -> [count, windowStartEpochMs] */
    private final ConcurrentHashMap<String, long[]> counters = new ConcurrentHashMap<>();

    @Override
    public void init(FilterConfig filterConfig) {}

    @Override
    public void doFilter(ServletRequest servletRequest,
                         ServletResponse servletResponse,
                         FilterChain chain) throws IOException, ServletException {

        HttpServletRequest  req  = (HttpServletRequest)  servletRequest;
        HttpServletResponse resp = (HttpServletResponse) servletResponse;

        String path   = req.getRequestURI();
        String method = req.getMethod();

        Integer limit = resolveLimit(path, method);
        if (limit != null) {
            String ip  = resolveClientIp(req);
            String key = resolveRateKey(ip, path, method);

            if (isRateLimited(key, limit)) {
                auditLog(req, ip, path, "RATE_LIMITED");
                resp.setStatus(429);
                resp.setContentType("application/json");
                resp.getWriter().write("{\"error\":\"Rate limit exceeded. Please slow down and try again later.\"}");
                return;
            }
        }

        chain.doFilter(servletRequest, servletResponse);
    }

    @Override
    public void destroy() {
        counters.clear();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Integer resolveLimit(String path, String method) {
        String cleanPath = normaliseKey(path);

        // Exact-match specific paths first
        for (Map.Entry<String, Integer> entry : ENDPOINT_LIMITS.entrySet()) {
            if (cleanPath.equals(entry.getKey())) {
                return entry.getValue();
            }
        }
        // Catch POST /api/complaints (complaint submission)
        if ("POST".equalsIgnoreCase(method) && cleanPath.equals("/api/complaints")) {
            return COMPLAINTS_POST_LIMIT;
        }
        // Catch GET /api/complaints/user/{email} (citizen grievance history)
        if ("GET".equalsIgnoreCase(method) && cleanPath.startsWith("/api/complaints/user/")) {
            return USER_COMPLAINTS_LIMIT;
        }
        // Catch GET /api/complaints/{id} (single grievance tracking lookup)
        if ("GET".equalsIgnoreCase(method) && cleanPath.matches("^/api/complaints/[^/]+$") && !cleanPath.equals("/api/complaints")) {
            return COMPLAINT_LOOKUP_LIMIT;
        }
        return null; // no rate limit for this path
    }

    private String resolveRateKey(String ip, String path, String method) {
        String cleanPath = normaliseKey(path);
        // Group all grievance lookups under a shared per-IP bucket so cycling IDs does not evade limits
        if ("GET".equalsIgnoreCase(method) && cleanPath.matches("^/api/complaints/[^/]+$") && !cleanPath.equals("/api/complaints")) {
            return ip + "|complaint_lookup";
        }
        if ("GET".equalsIgnoreCase(method) && cleanPath.startsWith("/api/complaints/user/")) {
            return ip + "|user_complaints";
        }
        return ip + "|" + cleanPath;
    }

    private String normaliseKey(String path) {
        // Strip trailing slashes for consistent keying
        return path.replaceAll("/+$", "");
    }

    /**
     * Returns true when the caller has exceeded the limit; also increments the counter.
     * Uses a simple fixed-window per WINDOW_MS.
     */
    private boolean isRateLimited(String key, int limit) {
        long now = System.currentTimeMillis();
        counters.compute(key, (k, v) -> {
            if (v == null || now - v[1] >= WINDOW_MS) {
                return new long[]{1, now}; // reset window
            }
            v[0]++;
            return v;
        });
        long[] state = counters.get(key);
        return state != null && state[0] > limit;
    }

    private static String resolveClientIp(HttpServletRequest req) {
        String forwarded = req.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return req.getRemoteAddr();
    }

    private static void auditLog(HttpServletRequest req, String ip, String path, String outcome) {
        System.out.printf("SECURITY_AUDIT: timestamp=%s ip=%s event=RATE_LIMIT_HIT path=%s outcome=%s%n",
                Instant.now(), ip, path, outcome);
    }
}
