package com.aigrievance.system.service;

import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${spring.mail.username:your_gmail_address@gmail.com}")
    private String fromEmail;

    @Value("${app.frontend.url:http://localhost:3000}")
    private String frontendUrl;

    public void sendComplaintNotification(String toEmail, String complaintId, String subject, String category, String priority, String type) {
        if (toEmail == null || toEmail.isBlank()) return;

        boolean isStatusChange = "status_change".equalsIgnoreCase(type);
        String statusText = isStatusChange ? "has been updated" : "has been registered";
        String emoji = isStatusChange ? "🔄" : "✅";
        String trackingLink = frontendUrl + "/track?id=" + complaintId;

        String priorityColor = "Critical".equalsIgnoreCase(priority) ? "#ef4444"
                : "High".equalsIgnoreCase(priority) ? "#f97316"
                : "Medium".equalsIgnoreCase(priority) ? "#f59e0b" : "#10b981";

        String htmlContent = """
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8"/>
                  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
                </head>
                <body style="margin:0;padding:0;background:#0f0f1a;font-family:'Segoe UI',sans-serif;">
                  <div style="max-width:580px;margin:0 auto;padding:40px 20px;">

                    <!-- Header -->
                    <div style="background:linear-gradient(135deg,#6366f1,#ec4899);border-radius:16px 16px 0 0;padding:32px;text-align:center;">
                      <div style="font-size:48px;margin-bottom:12px;">%s</div>
                      <h1 style="color:white;margin:0;font-size:24px;font-weight:800;">AI Grievance System</h1>
                      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Powered by Spring Boot & Gemini AI · Transparent · Fast</p>
                    </div>

                    <!-- Body -->
                    <div style="background:#1a1a2e;border-radius:0 0 16px 16px;padding:32px;border:1px solid #2d2d4a;border-top:none;">
                      <p style="color:#e2e8f0;font-size:16px;margin:0 0 24px;">
                        %s
                      </p>

                      <!-- Complaint Details Card -->
                      <div style="background:#0f0f1a;border:1px solid #2d2d4a;border-radius:12px;padding:24px;margin-bottom:24px;">
                        <div style="margin-bottom:16px;">
                          <span style="font-size:11px;color:#6366f1;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Tracking ID</span>
                          <div style="font-family:monospace;font-size:22px;font-weight:900;color:#6366f1;margin-top:4px;">%s</div>
                        </div>
                        <div style="display:grid;gap:12px;">
                          <div>
                            <span style="font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;">Subject</span>
                            <div style="color:#e2e8f0;font-weight:600;margin-top:2px;">%s</div>
                          </div>
                          <div style="display:flex;gap:16px;flex-wrap:wrap;">
                            <div>
                              <span style="font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;">Category</span>
                              <div style="color:#e2e8f0;font-weight:600;margin-top:2px;">📂 %s</div>
                            </div>
                            <div>
                              <span style="font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;">Priority</span>
                              <div style="color:%s;font-weight:700;margin-top:2px;">%s</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Track Button -->
                      <div style="text-align:center;margin-bottom:24px;">
                        <a href="%s"
                           style="display:inline-block;background:linear-gradient(135deg,#6366f1,#ec4899);color:white;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;">
                          🔍 Track Complaint Status
                        </a>
                      </div>

                      <!-- Footer -->
                      <p style="color:#64748b;font-size:12px;text-align:center;margin:0;">
                        This is an automated notification from the Spring Boot AI Grievance System.<br/>
                        Save your tracking ID: <strong style="color:#6366f1;">%s</strong>
                      </p>
                    </div>
                  </div>
                </body>
                </html>
                """.formatted(
                emoji,
                isStatusChange ? "Your complaint status has been updated by an authority officer." : "Your grievance has been received and processed by our AI triage system.",
                complaintId,
                subject,
                category,
                priorityColor,
                priority,
                trackingLink,
                complaintId
        );

        try {
            if (mailSender != null && !fromEmail.equals("your_gmail_address@gmail.com")) {
                MimeMessage message = mailSender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
                helper.setFrom("AI Grievance System <" + fromEmail + ">");
                helper.setTo(toEmail);
                helper.setSubject(emoji + " Your Complaint " + complaintId + " " + statusText);
                helper.setText(htmlContent, true);
                mailSender.send(message);
                System.out.println("✅ Spring Mail dispatched notification email to: " + toEmail);
            } else {
                System.out.println("ℹ️ [SPRING MAIL SKIPPED] Configured fallback logging for email to: " + toEmail);
            }
        } catch (Exception e) {
            System.err.println("⚠️ Email dispatch failed: " + e.getMessage());
        }
    }
}
