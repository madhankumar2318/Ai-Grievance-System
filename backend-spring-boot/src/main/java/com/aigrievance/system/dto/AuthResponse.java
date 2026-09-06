package com.aigrievance.system.dto;

public class AuthResponse {
    private boolean success;
    private String token;
    private UserDto user;
    private String error;

    public AuthResponse() {}

    public AuthResponse(boolean success, String token, UserDto user) {
        this.success = success;
        this.token = token;
        this.user = user;
    }

    public AuthResponse(boolean success, String error) {
        this.success = success;
        this.error = error;
    }

    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public UserDto getUser() { return user; }
    public void setUser(UserDto user) { this.user = user; }

    public String getError() { return error; }
    public void setError(String error) { this.error = error; }

    public static class UserDto {
        private String email;
        private String username;
        private String role;

        public UserDto(String email, String username, String role) {
            this.email = email;
            this.username = username;
            this.role = role;
        }

        public String getEmail() { return email; }
        public String getUsername() { return username; }
        public String getRole() { return role; }
    }
}
