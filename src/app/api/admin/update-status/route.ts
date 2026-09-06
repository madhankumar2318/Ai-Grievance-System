import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const SPRING_BOOT_URL = process.env.SPRING_BOOT_URL || "http://localhost:8080";

export async function POST(req: Request) {
    try {
        const { id, status } = await req.json();

        if (!id || !status) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Try forwarding to Java Spring Boot REST API
        try {
            const response = await fetch(`${SPRING_BOOT_URL}/api/complaints/update-status`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status }),
            });
            if (response.ok) {
                const data = await response.json();
                return NextResponse.json(data);
            }
        } catch (err) {
            console.warn("⚠️ Spring Boot backend unreachable, using Supabase fallback:", err);
        }

        // Fallback update to Supabase
        const { data, error } = await supabase
            .from("complaints")
            .update({ status })
            .eq("id", id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (err) {
        console.error("Update Status API Error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
