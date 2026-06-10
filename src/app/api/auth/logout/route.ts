import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
    try {
        const cookieStore = await cookies();
        cookieStore.set("auth_token", "", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 0, // Expire immediately
            path: "/",
        });
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Logout API error:", err);
        return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
    }
}
