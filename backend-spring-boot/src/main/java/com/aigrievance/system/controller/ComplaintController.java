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
@CrossOrigin(origins = "*")
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
        return ResponseEntity.ok(complaintService.getComplaintsByUser(email));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Complaint> getComplaintById(@PathVariable String id) {
        Complaint complaint = complaintService.getComplaintById(id);
        if (complaint == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(complaint);
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
