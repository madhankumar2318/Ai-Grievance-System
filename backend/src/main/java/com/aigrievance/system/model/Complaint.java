package com.aigrievance.system.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "complaints")
public class Complaint {

    @Id
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "subject", nullable = false)
    private String subject;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "category")
    private String category;

    @Column(name = "priority")
    private String priority;

    @Column(name = "status")
    private String status;

    @Column(name = "user_email")
    private String userEmail;

    @Column(name = "location")
    private String location;

    @Column(name = "attachment_count")
    private Integer attachmentCount;

    @Column(name = "ai_reasoning", columnDefinition = "TEXT")
    private String aiReasoning;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Complaint() {}

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        if (this.status == null) this.status = "Pending";
        if (this.attachmentCount == null) this.attachmentCount = 0;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getUserEmail() { return userEmail; }
    public void setUserEmail(String userEmail) { this.userEmail = userEmail; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public Integer getAttachmentCount() { return attachmentCount; }
    public void setAttachmentCount(Integer attachmentCount) { this.attachmentCount = attachmentCount; }

    public String getAiReasoning() { return aiReasoning; }
    public void setAiReasoning(String aiReasoning) { this.aiReasoning = aiReasoning; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
