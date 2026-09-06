package com.aigrievance.system.controller;

import com.aigrievance.system.dto.ComplaintRequest;
import com.aigrievance.system.dto.StatusUpdateRequest;
import com.aigrievance.system.model.Complaint;
import com.aigrievance.system.service.ComplaintService;
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
