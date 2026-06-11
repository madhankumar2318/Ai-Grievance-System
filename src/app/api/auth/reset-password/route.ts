import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";
import { verifyVerificationToken } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email: rawEmail, password, otpToken } = body;

        if (!rawEmail || !password || !otpToken) {
            return NextResponse.json(
                { success: false, error: "Missing required fields." },
                { status: 400 }
            );
        }

        const email = rawEmail.toLowerCase().trim();

        // ── Validate password strength policy ───────────────────────────
        if (password.length < 8) {
            return NextResponse.json(
                { success: false, error: "Password must be at least 8 characters." },
                { status: 400 }
            );
        }
        if (!/[A-Z]/.test(password)) {
            return NextResponse.json(
                { success: false, error: "Password must contain at least one uppercase letter." },
                { status: 400 }
            );
        }
        if (!/[^A-Za-z0-9]/.test(password)) {
            return NextResponse.json(
                { success: false, error: "Password must contain at least one special character." },
                { status: 400 }
            );
        }

        // ── Cryptographically verify OTP token ─────────────────────────
        const isValid = verifyVerificationToken(otpToken, email);
        if (!isValid) {
            return NextResponse.json(
                { success: false, error: "Email verification expired or invalid. Please verify again." },
                { status: 400 }
            );
        }

        // ── Hash the new password using bcrypt ──────────────────────────
        const passwordHash = await bcrypt.hash(password, 12);

        // ── Update database entry ──────────────────────────────────────
        const { error: updateError } = await supabase
            .from("users")
            .update({ password_hash: passwordHash })
            .eq("email", email);

        if (updateError) {
            console.error("Supabase password update error:", updateError);
            return NextResponse.json(
                { success: false, error: "Failed to update password." },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Password reset successfully.",
        });

    } catch (err) {
        console.error("Reset password API error:", err);
        return NextResponse.json(
            { success: false, error: "Server error" },
            { status: 500 }
        );
    }
}
