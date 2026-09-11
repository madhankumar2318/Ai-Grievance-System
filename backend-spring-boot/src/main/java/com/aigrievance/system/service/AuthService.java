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

    @org.springframework.beans.factory.annotation.Value("${security.passphrase.chief:Ch-Falcon20}")
    private String chiefPassphrase;

    @org.springframework.beans.factory.annotation.Value("${security.passphrase.authority:Au-Titan18}")
    private String authorityPassphrase;

    @org.springframework.beans.factory.annotation.Value("${security.demo.enabled:false}")
    private boolean demoEnabled;

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

        // 1. Check demo accounts if enabled
        if (demoEnabled && DEMO_USERS.containsKey(email)) {
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

    public AuthResponse register(com.aigrievance.system.dto.RegisterRequest request) {
        String email = request.getEmail() != null ? request.getEmail().toLowerCase().trim() : "";
        String role = request.getRole() != null ? request.getRole() : "user";
        String username = request.getUsername() != null ? request.getUsername().trim() : "Citizen User";

        if (email.isBlank() || request.getPassword() == null || request.getPassword().isBlank()) {
            return new AuthResponse(false, "Email and password are required.");
        }

        // Validate administrative secret passphrases for elevated roles
        if ("chief".equalsIgnoreCase(role)) {
            if (request.getPasscode() == null || !request.getPasscode().trim().equals(chiefPassphrase)) {
                return new AuthResponse(false, "Access Denied: Invalid Chief Administrator verification passphrase.");
            }
        } else if ("authority".equalsIgnoreCase(role)) {
            if (request.getPasscode() == null || !request.getPasscode().trim().equals(authorityPassphrase)) {
                return new AuthResponse(false, "Access Denied: Invalid Field Officer verification passphrase.");
            }
        }

        if (userRepository.existsByEmail(email)) {
            return new AuthResponse(false, "Email is already registered.");
        }

        String hashedPassword = passwordEncoder.encode(request.getPassword());
        User user = new User(email, username, hashedPassword, role);
        userRepository.save(user);

        String token = tokenProvider.generateToken(email, username, role);
        return new AuthResponse(true, token, new AuthResponse.UserDto(email, username, role));
    }
}
