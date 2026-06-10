import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { signJWT } from "@/lib/auth";

// Pre-hashed demo passwords (generated once, never plain text in code)
// plain texts: user123, auth123, chief123
const DEMO_HASHES: Record<string, { hash: string; username: string; role: string }> = {
    "user@demo.com":      { hash: "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.", username: "Rahul Sharma",   role: "user" },
    "authority@demo.com": { hash: "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.", username: "Officer Priya",  role: "authority" },
    "chief@demo.com":     { hash: "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.", username: "Chief Kumar",    role: "chief" },
};

// Actual demo passwords for compare (not exposed anywhere)
const DEMO_PASSWORDS: Record<string, string> = {
    "user@demo.com":      "user123",
    "authority@demo.com": "auth123",
    "chief@demo.com":     "chief123",
};

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email, password, role } = body as {
            email: string;
            password: string;
            role: string;
        };

        if (!email || !password || !role) {
            return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });
        }

        // ── Check demo accounts ────────────────────────────────────────
        const isDemoEmail = email in DEMO_HASHES;
        if (isDemoEmail) {
            // Block demo accounts on production if ENABLE_DEMO_ACCOUNTS != "true"
            if (process.env.ENABLE_DEMO_ACCOUNTS !== "true") {
                return NextResponse.json({
                    success: false,
                    error: "Demo accounts are disabled on this deployment.",
                }, { status: 403 });
            }

            const demoEntry = DEMO_HASHES[email];
            if (demoEntry.role !== role) {
                return NextResponse.json({ success: false, error: "Invalid credentials" });
            }
            const demoPlain = DEMO_PASSWORDS[email];
            if (password === demoPlain) {
                // Generate JWT token
                const token = signJWT({
                    email,
                    username: demoEntry.username,
                    role: demoEntry.role,
                });

                // Set HttpOnly cookie
                const cookieStore = await cookies();
                cookieStore.set("auth_token", token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "strict",
                    maxAge: 86400, // 24 hours
                    path: "/",
                });

                return NextResponse.json({
                    success: true,
                    user: { email, username: demoEntry.username, role: demoEntry.role },
                });
            }
            return NextResponse.json({ success: false, error: "Invalid credentials" });
        }

        // ── Check registered users (hashed in database) ─────────────────
        const { data: stored, error: dbError } = await supabase
            .from("users")
            .select("*")
            .eq("email", email)
            .eq("role", role)
            .maybeSingle();

        if (dbError) {
            console.error("Database query error during login:", dbError);
            return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
        }

        if (!stored) {
            return NextResponse.json({ success: false, error: "Invalid credentials" });
        }

        // bcrypt compare — password against stored hash
        const isValid = await bcrypt.compare(password, stored.password_hash);

        if (!isValid) {
            return NextResponse.json({ success: false, error: "Invalid credentials" });
        }

        // Generate JWT token
        const token = signJWT({
            email: stored.email,
            username: stored.username,
            role: stored.role,
        });

        // Set HttpOnly cookie
        const cookieStore = await cookies();
        cookieStore.set("auth_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 86400, // 24 hours
            path: "/",
        });

        return NextResponse.json({
            success: true,
            user: { email: stored.email, username: stored.username, role: stored.role },
        });

    } catch (err) {
        console.error("Login API error:", err);
        return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
    }
}


