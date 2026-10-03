package com.aigrievance.system.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory sliding-window token revocation blacklist.
 * Holds revoked JWT signatures / tokens until their expiration timestamp,
 * ensuring tokens cannot be replayed after logout even before their natural 24h expiry.
 */
@Service
public class TokenBlacklistService {

    @Autowired
    private JwtTokenProvider tokenProvider;

    // Map: token -> expiryTimestampEpochMs
    private final Map<String, Long> blacklistedTokens = new ConcurrentHashMap<>();

    public void blacklistToken(String token) {
        if (token == null || token.isBlank()) return;
        try {
            Date expiry = tokenProvider.getExpirationFromToken(token);
            long expiryMs = (expiry != null) ? expiry.getTime() : (System.currentTimeMillis() + 86400000L);
            blacklistedTokens.put(token.trim(), expiryMs);
            cleanupExpiredTokens();
        } catch (Exception e) {
            // Even if parsing fails, blacklist for 24 hours
            blacklistedTokens.put(token.trim(), System.currentTimeMillis() + 86400000L);
        }
    }

    public boolean isBlacklisted(String token) {
        if (token == null || token.isBlank()) return false;
        String clean = token.trim();
        Long expiryMs = blacklistedTokens.get(clean);
        if (expiryMs == null) return false;
        if (System.currentTimeMillis() > expiryMs) {
            blacklistedTokens.remove(clean);
            return false;
        }
        return true;
    }

    private void cleanupExpiredTokens() {
        long now = System.currentTimeMillis();
        blacklistedTokens.entrySet().removeIf(entry -> entry.getValue() < now);
    }
}
