package com.aigrievance.system.controller;

import com.aigrievance.system.dto.ComplaintRequest;
import com.aigrievance.system.dto.StatusUpdateRequest;
import com.aigrievance.system.model.Complaint;
import com.aigrievance.system.service.ComplaintService;
import com.aigrievance.system.service.GeminiTriageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/complaints")
public class ComplaintController {

    @Autowired
    private ComplaintService complaintService;

    @Autowired
    private GeminiTriageService geminiTriageService;

    @PostMapping("/analyze-photo")
    public ResponseEntity<Map<String, Object>> analyzePhoto(@RequestBody Map<String, String> request) {
        String base64 = request.get("base64");
        if (base64 == null || base64.isBlank()) {
            base64 = request.get("dataUrl");
        }
        String mimeType = request.getOrDefault("mimeType", "image/jpeg");
        if (base64 == null || base64.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing image data"));
        }

        GeminiTriageService.TriageResult result = geminiTriageService.analyzePhotoVision(base64, mimeType);
        return ResponseEntity.ok(Map.of(
                "subject", result.getReasoning(),
                "category", result.getCategory(),
                "confidence", 95
        ));
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> submitComplaint(@RequestBody ComplaintRequest request) {
        if (request.getSubject() == null || request.getDescription() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing required fields"));
        }
        Map<String, Object> result = complaintService.createComplaint(request);
        return ResponseEntity.ok(result);
    }

    @GetMapping
    public ResponseEntity<List<Complaint>> getAllComplaints() {
        return ResponseEntity.ok(complaintService.getAllComplaints());
    }

    @GetMapping("/user/{email}")
    public ResponseEntity<List<Complaint>> getComplaintsByUser(@PathVariable String email) {
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
    public ResponseEntity<Map<String, Object>> updateStatus(@RequestBody StatusUpdateRequest request) {
        if (request.getId() == null || request.getStatus() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing ID or status"));
        }
        Complaint updated = complaintService.updateStatus(request.getId(), request.getStatus());
        if (updated == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("success", true, "data", updated));
    }
}
