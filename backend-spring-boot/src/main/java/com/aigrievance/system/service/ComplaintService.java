package com.aigrievance.system.service;

import com.aigrievance.system.dto.ComplaintRequest;
import com.aigrievance.system.model.Complaint;
import com.aigrievance.system.repository.ComplaintRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Random;

@Service
public class ComplaintService {

    @Autowired
    private ComplaintRepository complaintRepository;

    @Autowired
    private GeminiTriageService geminiTriageService;

    @Autowired
    private EmailService emailService;

    private String sanitizeInput(String input, int maxLength) {
        if (input == null) return "";
        // Strip all HTML tags and non-printable control characters to prevent Stored XSS
        String clean = input.replaceAll("<[^>]*>", "").replaceAll("[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]", "").trim();
        if (clean.length() > maxLength) {
            clean = clean.substring(0, maxLength).trim();
        }
        return clean;
    }

    @Transactional
    public Map<String, Object> createComplaint(ComplaintRequest request) {
        String randomSuffix = java.util.UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        int year = java.time.Year.now().getValue();
        String complaintId = "GRV-" + year + "-" + randomSuffix;

        // Sanitize all incoming user inputs
        String safeSubject = sanitizeInput(request.getSubject(), 200);
        String safeDescription = sanitizeInput(request.getDescription(), 2500);
        String safeLocation = sanitizeInput(request.getLocation(), 250);
        String safeEmail = sanitizeInput(request.getUserEmail(), 150).toLowerCase();

        // Perform AI Triage with sanitized inputs
        GeminiTriageService.TriageResult triage = geminiTriageService.classifyComplaint(
                safeSubject,
                safeDescription,
                safeLocation
        );

        Complaint complaint = new Complaint();
        complaint.setId(complaintId);
        complaint.setSubject(safeSubject);
        complaint.setDescription(safeDescription);
        complaint.setLocation(safeLocation);
        complaint.setCategory(triage.getCategory());
        complaint.setPriority(triage.getPriority());
        complaint.setStatus("Pending");
        complaint.setUserEmail(safeEmail);
        complaint.setAttachmentCount(request.getAttachmentCount() != null ? Math.max(0, Math.min(10, request.getAttachmentCount())) : 0);
        complaint.setAiReasoning(triage.getReasoning());

        // Save to PostgreSQL via Spring Data JPA
        complaintRepository.save(complaint);

        // Send Email Notification in managed async thread pool
        if (complaint.getUserEmail() != null && !complaint.getUserEmail().isBlank()) {
            java.util.concurrent.CompletableFuture.runAsync(() -> emailService.sendComplaintNotification(
                    complaint.getUserEmail(),
                    complaintId,
                    complaint.getSubject(),
                    triage.getCategory(),
                    triage.getPriority(),
                    "submission"
            ));
        }

        return Map.of(
                "success", true,
                "data", Map.of(
                        "id", complaintId,
                        "ai_triage", Map.of(
                                "category", triage.getCategory(),
                                "priority", triage.getPriority(),
                                "confidence", 0.95,
                                "reasoning", triage.getReasoning()
                        ),
                        "attachmentCount", complaint.getAttachmentCount()
                )
        );
    }

    public List<Complaint> getAllComplaints() {
        return complaintRepository.findAllByOrderByCreatedAtDesc();
    }

    public List<Complaint> getComplaintsByUser(String email) {
        return complaintRepository.findByUserEmailOrderByCreatedAtDesc(email);
    }

    public Complaint getComplaintById(String id) {
        return complaintRepository.findById(id).orElse(null);
    }

    @Transactional
    public Complaint updateStatus(String id, String newStatus) {
        Complaint complaint = complaintRepository.findById(id).orElse(null);
        if (complaint != null) {
            complaint.setStatus(newStatus);
            complaintRepository.save(complaint);

            // Send status update notification email via managed async thread pool
            if (complaint.getUserEmail() != null && !complaint.getUserEmail().isBlank()) {
                java.util.concurrent.CompletableFuture.runAsync(() -> emailService.sendComplaintNotification(
                        complaint.getUserEmail(),
                        complaint.getId(),
                        complaint.getSubject(),
                        complaint.getCategory(),
                        complaint.getPriority(),
                        "status_change"
                ));
            }
        }
        return complaint;
    }
}
