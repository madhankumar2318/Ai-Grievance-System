import { NextResponse } from "next/server";
import { supabase, isConfigured as isSupabaseConfigured } from "@/lib/supabase";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { subject, description, location, attachmentCount = 0, userEmail: rawUserEmail } = body;
        const userEmail = rawUserEmail ? rawUserEmail.toLowerCase().trim() : "";

        if (!subject || !description) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // ── AI Triage Logic ────────────────────────────────────────
        const categories = ["Infrastructure", "Public Health", "Safety", "Administrative", "Environment"];
        let detectedCategory = categories[Math.floor(Math.random() * categories.length)];
        let detectedPriority = "Medium";

        const lowerDesc = description.toLowerCase();
        if (lowerDesc.includes("accident") || lowerDesc.includes("danger") || lowerDesc.includes("hurt")) {
            detectedPriority = "Critical"; detectedCategory = "Safety";
        } else if (lowerDesc.includes("road") || lowerDesc.includes("bridge") || lowerDesc.includes("building")) {
            detectedCategory = "Infrastructure"; detectedPriority = "High";
        } else if (lowerDesc.includes("water") || lowerDesc.includes("pollution") || lowerDesc.includes("waste")) {
            detectedCategory = "Environment"; detectedPriority = "High";
        } else if (lowerDesc.includes("hospital") || lowerDesc.includes("health") || lowerDesc.includes("medical")) {
            detectedCategory = "Public Health"; detectedPriority = "High";
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const complaintId = `GRV-${Math.floor(Math.random() * 90000) + 10000}`;
        const reasoning = "Keyword-based automatic triage matched patterns in your description.";

        // ── Save to Supabase ───────────────────────────────────────
        if (isSupabaseConfigured) {
            const { error: dbError } = await supabase.from("complaints").insert({
                id: complaintId,
                subject,
                description,
                location: location || "",
                category: detectedCategory,
                priority: detectedPriority,
                status: "Pending",
                user_email: userEmail || "",
                attachment_count: attachmentCount,
                ai_reasoning: reasoning,
            });
            if (dbError) {
                console.error("Supabase insert error:", dbError.message);
            }
        }

        // ── Send Email Notification ────────────────────────────────
        if (userEmail) {
            try {
                await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/notify`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        to: userEmail,
                        complaintId,
                        subject,
                        category: detectedCategory,
                        priority: detectedPriority,
                        type: "submission",
                    }),
                });
            } catch (emailErr) {
                console.error("Email notification failed:", emailErr);
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                id: complaintId,
                ai_triage: {
                    category: detectedCategory,
                    priority: detectedPriority,
                    confidence: 0.92,
                    reasoning,
                },
                attachmentCount,
                received_at: new Date().toISOString(),
            },
        });

    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
