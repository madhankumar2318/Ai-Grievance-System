import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("auth_token")?.value;

        if (!token) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const decoded = verifyJWT(token);
        if (!decoded || (decoded.role !== "authority" && decoded.role !== "chief")) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }

        const { data, error } = await supabase
            .from("complaints")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Admin complaints DB fetch error:", error);
            return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
        }

        return NextResponse.json({ success: true, complaints: data });
    } catch (err) {
        console.error("Secure admin complaints fetch error:", err);
        return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
    }
}
