package com.aigrievance.system.service;

import com.aigrievance.system.dto.AuthResponse;
import com.aigrievance.system.dto.LoginRequest;
import com.aigrievance.system.model.User;
import com.aigrievance.system.repository.UserRepository;
import com.aigrievance.system.security.JwtTokenProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;

@Service
public class AuthService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider tokenProvider;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    // Pre-configured demo accounts
    private static final Map<String, String[]> DEMO_USERS = Map.of(
            "user@demo.com", new String[]{"Rahul Sharma", "user123", "user"},
            "authority@demo.com", new String[]{"Officer Priya", "auth123", "authority"},
            "chief@demo.com", new String[]{"Chief Kumar", "chief123", "chief"}
    );

    public AuthResponse login(LoginRequest request) {
        String email = request.getEmail() != null ? request.getEmail().toLowerCase().trim() : "";
        String password = request.getPassword();
        String role = request.getRole();

        // 1. Check demo accounts
        if (DEMO_USERS.containsKey(email)) {
            String[] demoDetails = DEMO_USERS.get(email);
            String demoName = demoDetails[0];
            String demoPass = demoDetails[1];
            String demoRole = demoDetails[2];

            if (demoRole.equalsIgnoreCase(role) && demoPass.equals(password)) {
                String token = tokenProvider.generateToken(email, demoName, demoRole);
                return new AuthResponse(true, token, new AuthResponse.UserDto(email, demoName, demoRole));
            }
            return new AuthResponse(false, "Invalid demo credentials.");
        }

        // 2. Check registered users in Supabase PostgreSQL
        Optional<User> userOptional = userRepository.findByEmailAndRole(email, role);
        if (userOptional.isPresent()) {
            User user = userOptional.get();
            if (passwordEncoder.matches(password, user.getPasswordHash()) || password.equals(user.getPasswordHash())) {
                String token = tokenProvider.generateToken(user.getEmail(), user.getUsername(), user.getRole());
                return new AuthResponse(true, token, new AuthResponse.UserDto(user.getEmail(), user.getUsername(), user.getRole()));
            }
        }

        return new AuthResponse(false, "Invalid email, password, or role.");
    }
}
