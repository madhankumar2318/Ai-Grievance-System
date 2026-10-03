package com.aigrievance.system.dto;

public class StatusUpdateRequest {
    private String id;
    private String status;

    public StatusUpdateRequest() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
