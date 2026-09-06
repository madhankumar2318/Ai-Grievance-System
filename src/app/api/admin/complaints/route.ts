import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const SPRING_BOOT_URL = process.env.SPRING_BOOT_URL || "http://localhost:8080";

export async function GET() {
    try {
        // Try fetching from Java Spring Boot REST API first
        try {
            const response = await fetch(`${SPRING_BOOT_URL}/api/complaints`, {
                cache: "no-store",
            });
            if (response.ok) {
                const list = await response.json();
                return NextResponse.json({ success: true, complaints: list });
            }
        } catch (err) {
            console.warn("⚠️ Spring Boot backend unreachable, using Supabase fallback:", err);
        }

        // Fallback to Supabase database query
        const { data, error } = await supabase
            .from("complaints")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, complaints: data });
    } catch (err) {
        console.error("Admin Complaints API error:", err);
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
}
