package com.aigrievance.system.controller;

import com.aigrievance.system.dto.ComplaintRequest;
import com.aigrievance.system.dto.StatusUpdateRequest;
import com.aigrievance.system.model.Complaint;
import com.aigrievance.system.service.ComplaintService;
import com.aigrievance.system.service.GeminiTriageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/complaints")
public class ComplaintController {

    /** Strict whitelist — any status string outside this set is rejected with HTTP 400. */
    private static final Set<String> VALID_STATUSES = Set.of(
            "Pending", "In Progress", "Under Review", "Resolved", "Escalated", "Rejected"
    );

    /** Maximum allowed Base64 photo string length (5MB) to prevent JVM Heap exhaustion / DoS. */
    private static final int MAX_BASE64_LENGTH = 5 * 1024 * 1024;

    /** Strict image MIME type whitelist. */
    private static final Set<String> ALLOWED_IMAGE_MIMES = Set.of(
            "image/jpeg", "image/jpg", "image/png", "image/webp"
    );

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

    @Autowired
    private ComplaintService complaintService;

    @Autowired
    private GeminiTriageService geminiTriageService;

    @PostMapping("/analyze-photo")
    public ResponseEntity<Map<String, Object>> analyzePhoto(@RequestBody Map<String, String> request,
                                                            HttpServletRequest req) {
        String base64 = request.get("base64");
        if (base64 == null || base64.isBlank()) {
            base64 = request.get("dataUrl");
        }
        if (base64 == null || base64.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing image data"));
        }

        // 1. Enforce payload size limit (5MB cap) to prevent JVM heap exhaustion (DoS defense)
        if (base64.length() > MAX_BASE64_LENGTH) {
            auditLog(req, "ANALYZE_PHOTO_OVERSIZED", "anonymous", "BLOCKED_400: size=" + base64.length());
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Image payload exceeds 5MB limit. Please upload a smaller or compressed photo."
            ));
        }

        // 2. Enforce strict MIME whitelist
        String rawMime = request.getOrDefault("mimeType", "image/jpeg");
        String mimeType = rawMime != null ? rawMime.toLowerCase().trim() : "image/jpeg";
        if (!ALLOWED_IMAGE_MIMES.contains(mimeType)) {
            auditLog(req, "ANALYZE_PHOTO_INVALID_MIME", "anonymous", "BLOCKED_400: mime=" + mimeType);
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Unsupported image format. Allowed formats: JPEG, PNG, WEBP."
            ));
        }

        // Strip data URL prefix if present
        if (base64.contains(",")) {
            base64 = base64.substring(base64.indexOf(",") + 1);
        }

        GeminiTriageService.TriageResult result = geminiTriageService.analyzePhotoVision(base64, mimeType);
        return ResponseEntity.ok(Map.of(
                "subject", result.getReasoning(),
                "category", result.getCategory(),
                "confidence", 95
        ));
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> submitComplaint(@RequestBody ComplaintRequest request,
                                                               HttpServletRequest req) {
        if (request.getSubject() == null || request.getDescription() == null) {
            auditLog(req, "COMPLAINT_SUBMISSION_REJECTED", "anonymous", "BLOCKED_400: missing required fields");
            return ResponseEntity.badRequest().body(Map.of("error", "Missing required fields"));
        }
        Map<String, Object> result = complaintService.createComplaint(request);
        String actor = (request.getUserEmail() != null && !request.getUserEmail().isBlank())
                ? request.getUserEmail().trim().toLowerCase()
                : "anonymous";
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) result.get("data");
        String complaintId = (data != null && data.get("id") != null) ? data.get("id").toString() : "unknown";
        auditLog(req, "COMPLAINT_CREATED id=" + complaintId, actor, "SUCCESS");
        return ResponseEntity.ok(result);
    }

    @GetMapping
    public ResponseEntity<List<Complaint>> getAllComplaints() {
        return ResponseEntity.ok(complaintService.getAllComplaints());
    }

    @GetMapping("/user/{email}")
    public ResponseEntity<List<Complaint>> getComplaintsByUser(@PathVariable String email,
                                                               HttpServletRequest req) {
        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        // ── IDOR Ownership Check ───────────────────────────────────────────────
        // Citizens may only read their own complaints.
        // Field officers (ROLE_AUTHORITY) and chief admins (ROLE_CHIEF) may
        // read any citizen's complaints for oversight/case management.
        org.springframework.security.core.Authentication auth =
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();

        if (auth == null || !auth.isAuthenticated()) {
            auditLog(req, "IDOR_PROBE_COMPLAINTS", "anonymous", "BLOCKED_401");
            return ResponseEntity.status(org.springframework.http.HttpStatus.UNAUTHORIZED).build();
        }

        boolean isElevated = auth.getAuthorities().stream().anyMatch(a ->
                a.getAuthority().equals("ROLE_AUTHORITY") || a.getAuthority().equals("ROLE_CHIEF")
        );

        // Standard citizen: enforce strict ownership — caller email must match path email
        if (!isElevated) {
            String authenticatedEmail = auth.getName();
            if (authenticatedEmail == null || !authenticatedEmail.equalsIgnoreCase(email.trim())) {
                // Return 403 — never reveal whether the other user's complaints even exist
                auditLog(req, "IDOR_PROBE_COMPLAINTS", authenticatedEmail + "->target:" + email, "BLOCKED_403");
                return ResponseEntity.status(org.springframework.http.HttpStatus.FORBIDDEN).build();
            }
        }

        return ResponseEntity.ok(complaintService.getComplaintsByUser(email.trim().toLowerCase()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Complaint> getComplaintById(@PathVariable String id) {
        Complaint complaint = complaintService.getComplaintById(id);
        if (complaint == null) {
            return ResponseEntity.notFound().build();
        }

        // Check if caller is authenticated as field officer or chief
        org.springframework.security.core.Authentication auth =
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        boolean isElevated = auth != null && auth.getAuthorities().stream().anyMatch(a ->
                a.getAuthority().equals("ROLE_AUTHORITY") || a.getAuthority().equals("ROLE_CHIEF")
        );

        if (!isElevated) {
            return ResponseEntity.ok(sanitizeForPublic(complaint));
        }

        return ResponseEntity.ok(complaint);
    }

    private Complaint sanitizeForPublic(Complaint original) {
        if (original == null) return null;
        Complaint copy = new Complaint();
        copy.setId(original.getId());
        copy.setSubject(original.getSubject());
        copy.setDescription(original.getDescription());
        copy.setCategory(original.getCategory());
        copy.setPriority(original.getPriority());
        copy.setStatus(original.getStatus());
        copy.setUserEmail(maskEmail(original.getUserEmail()));
        copy.setLocation(original.getLocation());
        copy.setAttachmentCount(original.getAttachmentCount());
        copy.setAiReasoning(original.getAiReasoning());
        copy.setCreatedAt(original.getCreatedAt());
        copy.setUpdatedAt(original.getUpdatedAt());
        return copy;
    }

    private String maskEmail(String email) {
        if (email == null || !email.contains("@")) return "Registered Citizen";
        String[] parts = email.split("@", 2);
        String local = parts[0];
        String domain = parts[1];
        if (local.length() <= 1) return local + "***@" + domain;
        return local.charAt(0) + "***" + local.charAt(local.length() - 1) + "@" + domain;
    }

    @PostMapping("/update-status")
    public ResponseEntity<Map<String, Object>> updateStatus(@RequestBody StatusUpdateRequest request,
                                                            HttpServletRequest req) {
        if (request.getId() == null || request.getStatus() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing ID or status"));
        }

        // ── Status Whitelist Validation ─────────────────────────────────────────
        // Reject any status value that is not in the approved workflow set.
        if (!VALID_STATUSES.contains(request.getStatus())) {
            org.springframework.security.core.Authentication auth =
                    org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            String actor = auth != null ? auth.getName() : "anonymous";
            auditLog(req, "INVALID_STATUS_INJECTION", actor, "BLOCKED_400: " + request.getStatus());
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Invalid status value. Allowed values: Pending, In Progress, Under Review, Resolved, Escalated, Rejected"
            ));
        }

        // Structured audit trail for all legitimate status changes
        {
            org.springframework.security.core.Authentication auth =
                    org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            String actor = auth != null ? auth.getName() : "anonymous";
            auditLog(req, "STATUS_UPDATE id=" + request.getId() + " newStatus=" + request.getStatus(), actor, "ALLOWED");
        }

        Complaint updated = complaintService.updateStatus(request.getId(), request.getStatus());
        if (updated == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("success", true, "data", updated));
    }
}
