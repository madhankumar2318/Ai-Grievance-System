package com.aigrievance.system.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.http.MediaType;

import java.util.List;
import java.util.Map;
import java.util.Random;

@Service
public class GeminiTriageService {

    @Value("${gemini.api.key}")
    private String apiKey;

    public static class TriageResult {
        private String category;
        private String priority;
        private String reasoning;

        public TriageResult(String category, String priority, String reasoning) {
            this.category = category;
            this.priority = priority;
            this.reasoning = reasoning;
        }

        public String getCategory() { return category; }
        public String getPriority() { return priority; }
        public String getReasoning() { return reasoning; }
    }

    public TriageResult classifyComplaint(String subject, String description, String location) {
        // Fallback local regex triage
        TriageResult fallback = localRegexTriage(subject, description);

        if (apiKey == null || apiKey.isBlank() || apiKey.equals("your_gemini_api_key_here")) {
            return fallback;
        }

        try {
            String systemPrompt = """
                    You are an expert AI Triage Assistant for an Indian Government Grievance Portal.
                    Analyze the following complaint:
                    Subject: "%s"
                    Description: "%s"
                    Location: "%s"

                    Classify it into exactly one Category and one Priority.

                    Category options:
                    - "Infrastructure": Road damage, streetlights, building hazards, water pipes, potholes.
                    - "Public Health": Disease control, hygiene, sanitation, medical facilities.
                    - "Safety": Exposed wires, open manholes, crime, fire, road danger, active hazards.
                    - "Environment": Garbage dumps, air/water pollution, sound pollution, unauthorized tree cutting.
                    - "Administrative": Bribe requests, officer misconduct, major delay in certificates/passports.
                    - "Other": Anything not fitting the above.

                    Priority options:
                    - "Critical": Life-threatening situations, active hazards, severe safety issues.
                    - "High": Major blockages, severe sewer leaks, large scale disruptions.
                    - "Medium": Standard, non-emergency service requests.
                    - "Low": Muted suggestions, general requests.

                    Write a single brief sentence of professional reasoning.

                    Respond with a JSON object matching this schema:
                    {
                      "category": "Infrastructure" | "Public Health" | "Safety" | "Administrative" | "Environment" | "Other",
                      "priority": "Critical" | "High" | "Medium" | "Low",
                      "reasoning": "Brief summary sentence"
                    }
                    """.formatted(subject, description, location != null ? location : "Not specified");

            Map<String, Object> requestBody = Map.of(
                    "contents", List.of(
                            Map.of("parts", List.of(Map.of("text", systemPrompt)))
                    ),
                    "generationConfig", Map.of(
                            "responseMimeType", "application/json"
                    )
            );

            RestClient restClient = RestClient.create();
            String[] models = new String[]{"gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-flash-lite"};
            
            for (String model : models) {
                try {
                    String url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;
                    Map response = restClient.post()
                            .uri(url)
                            .contentType(MediaType.APPLICATION_JSON)
                            .body(requestBody)
                            .retrieve()
                            .body(Map.class);

                    if (response != null && response.containsKey("candidates")) {
                        List candidates = (List) response.get("candidates");
                        if (!candidates.isEmpty()) {
                            Map candidate = (Map) candidates.get(0);
                            Map content = (Map) candidate.get("content");
                            List parts = (List) content.get("parts");
                            Map part = (Map) parts.get(0);
                            String text = (String) part.get("text");

                            if (text != null && !text.isBlank()) {
                                text = text.trim();
                                if (text.startsWith("```json")) text = text.substring(7);
                                if (text.endsWith("```")) text = text.substring(0, text.length() - 3);

                                String category = extractJsonValue(text, "category", fallback.getCategory());
                                String priority = extractJsonValue(text, "priority", fallback.getPriority());
                                String reasoning = extractJsonValue(text, "reasoning", fallback.getReasoning());

                                return new TriageResult(category, priority, "AI Classification: " + reasoning);
                            }
                        }
                    }
                } catch (Exception e) {
                    System.err.println("⚠️ Gemini model " + model + " failed, trying next: " + e.getMessage());
                }
            }
        } catch (Exception e) {
            System.err.println("⚠️ Gemini AI REST API call failed, using local regex triage: " + e.getMessage());
        }

        return fallback;
    }

    private String extractJsonValue(String json, String key, String defaultValue) {
        try {
            String search = "\"" + key + "\":";
            int idx = json.indexOf(search);
            if (idx != -1) {
                int start = json.indexOf("\"", idx + search.length());
                if (start != -1) {
                    int end = json.indexOf("\"", start + 1);
                    if (end != -1) {
                        return json.substring(start + 1, end);
                    }
                }
            }
        } catch (Exception ignored) {}
        return defaultValue;
    }

    private TriageResult localRegexTriage(String subject, String description) {
        String combined = (subject + " " + description).toLowerCase();
        String category = "Infrastructure";
        String priority = "Medium";
        String reasoning = "Keyword-based automatic triage matched patterns in your complaint.";

        if (combined.contains("accident") || combined.contains("danger") || combined.contains("fire") || combined.contains("wire")) {
            category = "Safety";
            priority = "Critical";
        } else if (combined.contains("road") || combined.contains("bridge") || combined.contains("pothole") || combined.contains("pipe")) {
            category = "Infrastructure";
            priority = "High";
        } else if (combined.contains("water") || combined.contains("garbage") || combined.contains("waste") || combined.contains("pollution")) {
            category = "Environment";
            priority = "High";
        } else if (combined.contains("hospital") || combined.contains("health") || combined.contains("medical") || combined.contains("doctor")) {
            category = "Public Health";
            priority = "High";
        }

        return new TriageResult(category, priority, reasoning);
    }

    public TriageResult analyzePhotoVision(String base64Image, String mimeType) {
        if (base64Image != null && base64Image.contains(",")) {
            base64Image = base64Image.split(",")[1];
        }

        if (apiKey == null || apiKey.isBlank() || apiKey.contains("your_gemini")) {
            return new TriageResult("Environment", "High", "Civic & Environmental Issue Detected in Photo");
        }

        try {
            Map<String, Object> inlineData = Map.of(
                    "mimeType", mimeType != null ? mimeType : "image/jpeg",
                    "data", base64Image
            );

            String prompt = """
                    Analyze this photo of a civic, municipal, or environmental issue.
                    Identify the exact issue shown (e.g. Environmental Water Body Pollution & Garbage Dumping, Industrial Air Pollution & Factory Smoke, Severe Road Pothole & Asphalt Damage, Exposed Electrical Wires & Safety Hazard, Public Garbage Dumping, Broken Streetlight).

                    Output JSON matching schema:
                    {
                      "subject": "Exact specific title of problem",
                      "category": "Environment" | "Infrastructure" | "Safety" | "Public Health" | "Administrative" | "Other",
                      "confidence": 95
                    }
                    """;

            Map<String, Object> requestBody = Map.of(
                    "contents", List.of(
                            Map.of("parts", List.of(
                                    Map.of("inlineData", inlineData),
                                    Map.of("text", prompt)
                            ))
                    ),
                    "generationConfig", Map.of(
                            "responseMimeType", "application/json"
                    )
            );

            RestClient restClient = RestClient.create();
            String[] models = new String[]{"gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-flash-lite"};

            for (String model : models) {
                try {
                    String url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;

                    Map response = restClient.post()
                            .uri(url)
                            .contentType(MediaType.APPLICATION_JSON)
                            .body(requestBody)
                            .retrieve()
                            .body(Map.class);

                    if (response != null && response.containsKey("candidates")) {
                        List candidates = (List) response.get("candidates");
                        if (!candidates.isEmpty()) {
                            Map candidate = (Map) candidates.get(0);
                            Map content = (Map) candidate.get("content");
                            List parts = (List) content.get("parts");
                            Map part = (Map) parts.get(0);
                            String text = (String) part.get("text");

                            if (text != null && !text.isBlank()) {
                                text = text.trim();
                                if (text.startsWith("```json")) text = text.substring(7);
                                if (text.endsWith("```")) text = text.substring(0, text.length() - 3);

                                String subject = extractJsonValue(text, "subject", "Civic Issue Detected");
                                String category = extractJsonValue(text, "category", "Environment");

                                return new TriageResult(category, "High", subject);
                            }
                        }
                    }
                } catch (Exception e) {
                    System.err.println("⚠️ Gemini Vision model " + model + " failed: " + e.getMessage());
                }
            }
        } catch (Exception e) {
            System.err.println("⚠️ Gemini Vision API error: " + e.getMessage());
        }

        return new TriageResult("Environment", "High", "Civic & Environmental Issue Detected in Photo");
    }
}
