package com.aigrievance.system.controller;

import com.aigrievance.system.dto.AuthResponse;
import com.aigrievance.system.dto.LoginRequest;
import com.aigrievance.system.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private AuthService authService;

    @Autowired
    private com.aigrievance.system.security.TokenBlacklistService tokenBlacklistService;

    /** Emit a structured security audit log line. */
    private static void auditLog(HttpServletRequest req, String event, String actor, String outcome) {
        String ip = resolveClientIp(req);
        System.out.printf("SECURITY_AUDIT: timestamp=%s ip=%s user=%s event=%s outcome=%s%n",
                Instant.now(), ip, actor, event, outcome);
    }

    private static String resolveClientIp(HttpServletRequest req) {
        String forwarded = req.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return req.getRemoteAddr();
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest request,
                                              HttpServletRequest req) {
        String email = request.getEmail() != null ? request.getEmail().toLowerCase().trim() : "unknown";
        AuthResponse response = authService.login(request);
        if (!response.isSuccess()) {
            auditLog(req, "LOGIN_FAILED", email, "BLOCKED_401");
            return ResponseEntity.status(401).body(response);
        }
        auditLog(req, "LOGIN_SUCCESS", email, "ALLOWED");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@RequestBody com.aigrievance.system.dto.RegisterRequest request,
                                                 HttpServletRequest req) {
        String email = request.getEmail() != null ? request.getEmail().toLowerCase().trim() : "unknown";
        AuthResponse response = authService.register(request);
        if (!response.isSuccess()) {
            auditLog(req, "REGISTER_FAILED role=" + request.getRole(), email, "BLOCKED_400: " + response.getError());
            return ResponseEntity.badRequest().body(response);
        }
        auditLog(req, "REGISTER_SUCCESS role=" + request.getRole(), email, "ALLOWED");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, Object>> logout(HttpServletRequest req) {
        String bearer = req.getHeader("Authorization");
        if (bearer != null && bearer.startsWith("Bearer ")) {
            String token = bearer.substring(7);
            tokenBlacklistService.blacklistToken(token);
            auditLog(req, "LOGOUT", "token_revoked", "SUCCESS");
        } else {
            auditLog(req, "LOGOUT", "session_cleared", "SUCCESS");
        }
        return ResponseEntity.ok(Map.of("success", true));
    }
}
