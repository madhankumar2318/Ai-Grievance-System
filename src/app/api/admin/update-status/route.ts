import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
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

        const { id, status } = await req.json();

        if (!id || !status) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        const { error } = await supabase
            .from("complaints")
            .update({ status, updated_at: new Date().toISOString() })
            .eq("id", id);

        if (error) {
            console.error("DB update status error:", error);
            return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Secure admin update status error:", err);
        return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
    }
}
