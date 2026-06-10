import { NextResponse } from "next/server";
import { Resend } from "resend";
import { signVerificationToken } from "@/lib/auth";

const resend = new Resend(process.env.RESEND_API_KEY);

// In-memory OTP store: { email -> { otp, expiresAt } }
// Note: This resets on server restart — acceptable for development.
// For production with multiple instances, use Redis or Supabase table.
const otpStore = new Map<string, { otp: string; expiresAt: number; attempts: number }>();


function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
}

/* ── Send OTP ─────────────────────────────────────────────────────────────── */
export async function POST(req: Request) {
    try {
        const { email, action } = await req.json();

        if (!email || !email.includes("@")) {
            return NextResponse.json({ success: false, error: "Invalid email address" }, { status: 400 });
        }

        if (action === "send") {
            // Rate limit: don't resend if OTP was sent < 60s ago
            const existing = otpStore.get(email);
            if (existing && existing.expiresAt - 9 * 60 * 1000 > Date.now()) {
                return NextResponse.json({
                    success: false,
                    error: "OTP already sent. Please wait 60 seconds before requesting again.",
                }, { status: 429 });
            }

            const otp = generateOTP();
            const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
            otpStore.set(email, { otp, expiresAt, attempts: 0 });

            // If Resend not configured, log and return success (dev mode)
            if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === "your_resend_api_key") {
                console.log(`[OTP DEV MODE] OTP for ${email}: ${otp}`);
                return NextResponse.json({ success: true, devMode: true, otp }); // expose OTP only in dev
            }

            const { error } = await resend.emails.send({
                from: "AI Grievance System <onboarding@resend.dev>",
                to: [email],
                subject: "🔐 Your Email Verification OTP — AI Grievance System",
                html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 20px;">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:16px 16px 0 0;padding:32px;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">🔐</div>
      <h1 style="color:white;margin:0;font-size:22px;font-weight:800;">Email Verification</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:13px;">AI Grievance System — Citizen Portal</p>
    </div>
    <div style="background:#1a1a2e;border-radius:0 0 16px 16px;padding:32px;border:1px solid #2d2d4a;border-top:none;">
      <p style="color:#e2e8f0;font-size:15px;margin:0 0 20px;">Use the OTP below to verify your email address. It expires in <strong style="color:#6366f1;">10 minutes</strong>.</p>
      <div style="background:#0f0f1a;border:2px solid #6366f1;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
        <div style="font-family:monospace;font-size:42px;font-weight:900;color:#6366f1;letter-spacing:0.3em;">${otp}</div>
        <div style="font-size:11px;color:#64748b;margin-top:8px;text-transform:uppercase;letter-spacing:0.08em;">One-Time Password</div>
      </div>
      <p style="color:#64748b;font-size:12px;margin:0;text-align:center;">
        If you didn't request this, please ignore this email.<br/>
        Do not share this OTP with anyone.
      </p>
    </div>
  </div>
</body>
</html>`.trim(),
            });

            if (error) {
                console.error("Resend OTP error:", error);
                return NextResponse.json({ success: false, error: "Failed to send OTP email." }, { status: 500 });
            }

            return NextResponse.json({ success: true });
        }

        if (action === "verify") {
            const { otp } = await req.json().catch(() => ({ otp: "" }));
            // otp comes from the same body as email and action
            return NextResponse.json({ success: false, error: "Use the verify endpoint separately." });
        }

        return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });

    } catch (err) {
        console.error("OTP API error:", err);
        return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
    }
}

/* ── Verify OTP ───────────────────────────────────────────────────────────── */
export async function PUT(req: Request) {
    try {
        const { email, otp } = await req.json();

        if (!email || !otp) {
            return NextResponse.json({ success: false, error: "Email and OTP are required." }, { status: 400 });
        }

        const stored = otpStore.get(email);

        if (!stored) {
            return NextResponse.json({ success: false, error: "No OTP found. Please request a new one." });
        }
        if (Date.now() > stored.expiresAt) {
            otpStore.delete(email);
            return NextResponse.json({ success: false, error: "OTP expired. Please request a new one." });
        }
        if (stored.attempts >= 5) {
            otpStore.delete(email);
            return NextResponse.json({ success: false, error: "Too many attempts. Please request a new OTP." });
        }

        if (stored.otp !== otp.trim()) {
            otpStore.set(email, { ...stored, attempts: stored.attempts + 1 });
            const remaining = 5 - (stored.attempts + 1);
            return NextResponse.json({ success: false, error: `Incorrect OTP. ${remaining} attempts remaining.` });
        }

        // ✅ OTP correct — clear it so it can't be reused
        otpStore.delete(email);
        const verificationToken = signVerificationToken(email);
        return NextResponse.json({ success: true, message: "Email verified successfully.", verificationToken });

    } catch (err) {
        console.error("OTP verify error:", err);
        return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
    }
}
