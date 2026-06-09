import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

const DEMO_EMAILS = ["user@demo.com", "authority@demo.com", "chief@demo.com"];

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email, password, username, role, registeredUsers = [], ...metadata } = body;

        if (!email || !password || !username || !role) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        // ── Block demo email reuse ─────────────────────────────────────
        if (DEMO_EMAILS.includes(email)) {
            return NextResponse.json({ success: false, error: "This email is reserved for demo accounts." }, { status: 400 });
        }

        // ── Check if email already taken ───────────────────────────────
        const alreadyExists = (registeredUsers as { email: string }[]).some(
            (u) => u.email === email
        );
        if (alreadyExists) {
            return NextResponse.json({ success: false, error: "Email already registered" }, { status: 409 });
        }

        // ── Hash password (10 salt rounds) ────────────────────────────
        const passwordHash = await bcrypt.hash(password, 10);

        // Return the safe user object (passwordHash, NOT password)
        return NextResponse.json({
            success: true,
            user: {
                email,
                passwordHash,  // ← bcrypt hash, never plain text
                username,
                role,
                ...metadata,   // phone, state, district etc.
            },
        });

    } catch (err) {
        console.error("Register API error:", err);
        return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
    }
}
