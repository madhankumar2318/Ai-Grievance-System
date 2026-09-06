package com.aigrievance.system;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class AiGrievanceSystemApplication {

    public static void main(String[] args) {
        SpringApplication.run(AiGrievanceSystemApplication.class, args);
        System.out.println("🚀 AI Grievance System Java Spring Boot Backend Running on http://localhost:8080");
    }
}
