import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const SPRING_BOOT_URL = process.env.SPRING_BOOT_URL || "http://localhost:8080";

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // 1. Try Java Spring Boot REST API
        try {
            const springRes = await fetch(`${SPRING_BOOT_URL}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (springRes.ok) {
                const data = await springRes.json();
                if (data.success && data.token) {
                    const cookieStore = await cookies();
                    cookieStore.set("auth_token", data.token, {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === "production",
                        sameSite: "strict",
                        maxAge: 86400,
                        path: "/",
                    });
                    return NextResponse.json({
                        success: true,
                        user: data.user,
                    });
                }
            }
        } catch (err) {
            console.warn("⚠️ Spring Boot Auth backend unreachable, using gateway login:", err);
        }

        // 2. Gateway fallback demo accounts
        const { email, password, role } = body;
        const validDemo = (email === "user@demo.com" && role === "user" && password === "user123") ||
                          (email === "authority@demo.com" && role === "authority" && password === "auth123") ||
                          (email === "chief@demo.com" && role === "chief" && password === "chief123");

        if (validDemo) {
            const username = role === "chief" ? "Chief Kumar" : role === "authority" ? "Officer Priya" : "Rahul Sharma";
            return NextResponse.json({
                success: true,
                user: { email, username, role },
            });
        }

        return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    } catch (err) {
        console.error("Login Gateway API error:", err);
        return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
    }
}
