import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
    try {
        const { to, complaintId, subject, category, priority, type } = await req.json();

        if (!to || !complaintId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const isStatusChange = type === "status_change";
        const statusText = isStatusChange ? "has been updated" : "has been registered";
        const emoji = isStatusChange ? "🔄" : "✅";

        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;

        // Fallback if SMTP credentials are not set
        if (!smtpUser || smtpUser === "your_gmail_address" || !smtpPass) {
            console.log(`[SMTP SKIPPED] SMTP credentials are not set. Would have sent email to: ${to}`);
            console.log(`Complaint ID: ${complaintId}, Subject: ${subject}, Category: ${category}, Priority: ${priority}`);
            return NextResponse.json({ success: true, skipped: true });
        }

        // Dynamically resolve tracking link hostname
        const origin = req.headers.get("origin") || "";
        const host = origin ? origin : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
        const trackLink = `${host}/track?id=${complaintId}`;

        // Create Nodemailer Transporter pointing to Gmail SMTP
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
        });

        const mailOptions = {
            from: `"AI Grievance System" <${smtpUser}>`,
            to,
            subject: `${emoji} Your Complaint ${complaintId} ${statusText}`,
            html: `
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
      <div style="font-size:48px;margin-bottom:12px;">${emoji}</div>
      <h1 style="color:white;margin:0;font-size:24px;font-weight:800;">AI Grievance System</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Powered by AI · Transparent · Fast</p>
    </div>

    <!-- Body -->
    <div style="background:#1a1a2e;border-radius:0 0 16px 16px;padding:32px;border:1px solid #2d2d4a;border-top:none;">
      <p style="color:#e2e8f0;font-size:16px;margin:0 0 24px;">
        ${isStatusChange
                    ? "Your complaint status has been updated by an authority officer."
                    : "Your grievance has been received and processed by our AI triage system."
                }
      </p>

      <!-- Complaint Details Card -->
      <div style="background:#0f0f1a;border:1px solid #2d2d4a;border-radius:12px;padding:24px;margin-bottom:24px;">
        <div style="margin-bottom:16px;">
          <span style="font-size:11px;color:#6366f1;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Tracking ID</span>
          <div style="font-family:monospace;font-size:22px;font-weight:900;color:#6366f1;margin-top:4px;">${complaintId}</div>
        </div>
        <div style="display:grid;gap:12px;">
          <div>
            <span style="font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;">Subject</span>
            <div style="color:#e2e8f0;font-weight:600;margin-top:2px;">${subject}</div>
          </div>
          <div style="display:flex;gap:16px;flex-wrap:wrap;">
            <div>
              <span style="font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;">Category</span>
              <div style="color:#e2e8f0;font-weight:600;margin-top:2px;">📂 ${category}</div>
            </div>
            <div>
              <span style="font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;">Priority</span>
              <div style="color:${priority === "Critical" ? "#ef4444" : priority === "High" ? "#f97316" : priority === "Medium" ? "#f59e0b" : "#10b981"};font-weight:700;margin-top:2px;">
                ${priority === "Critical" ? "🚨" : priority === "High" ? "⚠️" : priority === "Medium" ? "📍" : "✅"} ${priority}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Track Button -->
      <div style="text-align:center;margin-bottom:24px;">
        <a href="${trackLink}"
           style="display:inline-block;background:linear-gradient(135deg,#6366f1,#ec4899);color:white;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;">
          🔍 Track Complaint Status
        </a>
      </div>

      <!-- Footer -->
      <p style="color:#64748b;font-size:12px;text-align:center;margin:0;">
        This is an automated notification from the AI Grievance System.<br/>
        Save your tracking ID: <strong style="color:#6366f1;">${complaintId}</strong>
      </p>
    </div>
  </div>
</body>
</html>
            `.trim(),
        };

        await transporter.sendMail(mailOptions);
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Notify API error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

