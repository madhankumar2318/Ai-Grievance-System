package com.aigrievance.system.config;

import com.aigrievance.system.security.JwtAuthenticationFilter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Autowired
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Public endpoints
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/complaints").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/complaints/analyze-photo").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/complaints/{id}").permitAll()

                        // Protected administrative endpoints (requires AUTHORITY or CHIEF role)
                        .requestMatchers("/api/complaints/update-status").hasAnyRole("AUTHORITY", "CHIEF")
                        .requestMatchers(HttpMethod.GET, "/api/complaints").hasAnyRole("AUTHORITY", "CHIEF")
                        .requestMatchers(HttpMethod.GET, "/api/complaints/user/**").hasAnyRole("AUTHORITY", "CHIEF", "USER")

                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
