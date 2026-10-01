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
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Servlet filter that enforces per-IP rate limits directly at the Spring Boot layer.
 *
 * Protects against:
 *  - Direct-to-backend brute-force login attempts on POST /api/auth/login
 *  - Gemini Vision AI quota exhaustion via POST /api/complaints/analyze-photo
 *  - Complaint submission spam via POST /api/complaints
 *
 * Limits (sliding 60-second windows):
 *  - /api/auth/login          → 10 requests / 60 s per IP
 *  - /api/auth/register       → 5  requests / 60 s per IP
 *  - /api/complaints (POST)   → 20 requests / 60 s per IP
 *  - /api/complaints/analyze-photo → 10 requests / 60 s per IP
 */
@Component
public class RateLimitingFilter implements Filter {

    private static final long WINDOW_MS = 60_000L; // 1-minute sliding window

    /** Endpoint-specific limits: path-suffix → max requests per window */
    private static final Map<String, Integer> ENDPOINT_LIMITS = Map.of(
            "/api/auth/login",                10,
            "/api/auth/register",             5,
            "/api/complaints/analyze-photo",  10
    );
    private static final int COMPLAINTS_POST_LIMIT = 20;

    /** Key: "ip|path" → [count, windowStartEpochMs] */
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
            String key = ip + "|" + normaliseKey(path);

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
        // Exact-match specific paths first
        for (Map.Entry<String, Integer> entry : ENDPOINT_LIMITS.entrySet()) {
            if (path.equals(entry.getKey())) {
                return entry.getValue();
            }
        }
        // Catch POST /api/complaints (complaint submission)
        if ("POST".equalsIgnoreCase(method) && path.equals("/api/complaints")) {
            return COMPLAINTS_POST_LIMIT;
        }
        return null; // no rate limit for this path
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
