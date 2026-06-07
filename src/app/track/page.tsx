"use client";

import { useState } from "react";
import Link from "next/link";
import { useLang } from "@/context/LanguageContext";
import BeforeAfterSlider from "@/components/BeforeAfterSlider";
import AIAdvocateCard from "@/components/AIAdvocateCard";

/* ── Shared mock database (same IDs from admin/chief) ── */
const COMPLAINTS_DB: Record<string, {
    id: string; subject: string; description: string;
    category: string; priority: string; status: string;
    location: string; date: string; user: string;
    timeline: { stage: string; time: string; done: boolean; note: string }[];
}> = {
    "GRV-12044": {
        id: "GRV-12044", subject: "Street Light Failure", description: "Multiple street lights have stopped working in Sector 12 near the main market, creating safety hazards at night.",
        category: "Infrastructure", priority: "Medium", status: "Pending", location: "Sector 12", date: "2026-02-18", user: "John Doe",
        timeline: [
            { stage: "Submitted", time: "2026-02-18 09:12 AM", done: true, note: "Complaint registered successfully." },
            { stage: "AI Triaged", time: "2026-02-18 09:12 AM", done: true, note: "Categorized as Infrastructure — Medium priority." },
            { stage: "Assigned", time: "2026-02-18 11:30 AM", done: true, note: "Assigned to Officer Singh (Infrastructure Dept)." },
            { stage: "In Progress", time: "", done: false, note: "Pending field inspection." },
            { stage: "Resolved", time: "", done: false, note: "" },
        ],
    },
    "GRV-88291": {
        id: "GRV-88291", subject: "Potable Water Contamination", description: "Tap water in Ward 7 has turned yellowish and smells foul. Multiple residents are falling sick.",
        category: "Environment", priority: "Critical", status: "In Progress", location: "Ward 7", date: "2026-02-19", user: "Jane Smith",
        timeline: [
            { stage: "Submitted", time: "2026-02-19 07:45 AM", done: true, note: "Complaint registered successfully." },
            { stage: "AI Triaged", time: "2026-02-19 07:45 AM", done: true, note: "Categorized as Environment — CRITICAL priority. Escalated immediately." },
            { stage: "Assigned", time: "2026-02-19 08:00 AM", done: true, note: "Assigned to Officer Priya (Environment Dept)." },
            { stage: "In Progress", time: "2026-02-19 10:15 AM", done: true, note: "Field team deployed. Water samples sent for testing." },
            { stage: "Resolved", time: "", done: false, note: "Awaiting lab results." },
        ],
    },
    "GRV-33102": {
        id: "GRV-33102", subject: "Illegal Parking in Zone B", description: "Commercial vehicles are illegally parked blocking the road in Zone B causing daily traffic jams.",
        category: "Safety", priority: "Low", status: "Resolved", location: "Zone B", date: "2026-02-15", user: "Robert Brown",
        timeline: [
            { stage: "Submitted", time: "2026-02-15 02:30 PM", done: true, note: "Complaint registered successfully." },
            { stage: "AI Triaged", time: "2026-02-15 02:30 PM", done: true, note: "Categorized as Safety — Low priority." },
            { stage: "Assigned", time: "2026-02-15 03:00 PM", done: true, note: "Assigned to Officer Meera (Safety Dept)." },
            { stage: "In Progress", time: "2026-02-15 04:00 PM", done: true, note: "Traffic unit deployed to Zone B." },
            { stage: "Resolved", time: "2026-02-15 06:45 PM", done: true, note: "Vehicles towed. No violations observed since." },
        ],
    },
    "GRV-40019": {
        id: "GRV-40019", subject: "Public Hospital Staff Shortage", description: "City Hospital OPD is overwhelmed with only 2 doctors on duty. Patients waiting 4–5 hours.",
        category: "Public Health", priority: "High", status: "Pending", location: "City Hospital", date: "2026-02-20", user: "Alice Green",
        timeline: [
            { stage: "Submitted", time: "2026-02-20 11:05 AM", done: true, note: "Complaint registered successfully." },
            { stage: "AI Triaged", time: "2026-02-20 11:05 AM", done: true, note: "Categorized as Public Health — High priority." },
            { stage: "Assigned", time: "", done: false, note: "Pending assignment." },
            { stage: "In Progress", time: "", done: false, note: "" },
            { stage: "Resolved", time: "", done: false, note: "" },
        ],
    },
    "GRV-55678": {
        id: "GRV-55678", subject: "Road Pothole Danger", description: "Large potholes on NH-48 near km marker 14 have caused 3 accidents in the past week.",
        category: "Infrastructure", priority: "High", status: "In Progress", location: "NH-48", date: "2026-02-17", user: "Ravi Kumar",
        timeline: [
            { stage: "Submitted", time: "2026-02-17 08:00 AM", done: true, note: "Complaint registered successfully." },
            { stage: "AI Triaged", time: "2026-02-17 08:00 AM", done: true, note: "Categorized as Infrastructure — High priority." },
            { stage: "Assigned", time: "2026-02-17 09:30 AM", done: true, note: "Assigned to Officer Singh (Infrastructure Dept)." },
            { stage: "In Progress", time: "2026-02-17 02:00 PM", done: true, note: "Road repair crew dispatched. Work in progress." },
            { stage: "Resolved", time: "", done: false, note: "ETA: 2026-02-22" },
        ],
    },
    "GRV-72190": {
        id: "GRV-72190", subject: "Air Pollution from Factory", description: "Factory in Industrial Area is releasing black smoke 24/7. Residents suffering breathing problems.",
        category: "Environment", priority: "Critical", status: "Pending", location: "Industrial Area", date: "2026-02-21", user: "Meena Patel",
        timeline: [
            { stage: "Submitted", time: "2026-02-21 06:30 AM", done: true, note: "Complaint registered successfully." },
            { stage: "AI Triaged", time: "2026-02-21 06:30 AM", done: true, note: "Categorized as Environment — CRITICAL priority. Escalated." },
            { stage: "Assigned", time: "", done: false, note: "Pending assignment." },
            { stage: "In Progress", time: "", done: false, note: "" },
            { stage: "Resolved", time: "", done: false, note: "" },
        ],
    },
    "GRV-99001": {
        id: "GRV-99001", subject: "Broken Footpath Outside School", description: "The footpath on MG Road near Sunrise School has large cracks and exposed rods. Children are tripping and getting injured daily.",
        category: "Infrastructure", priority: "High", status: "Rejected", location: "MG Road", date: "2026-02-20", user: "Priya Sharma",
        timeline: [
            { stage: "Submitted", time: "2026-02-20 08:15 AM", done: true, note: "Complaint registered successfully." },
            { stage: "AI Triaged", time: "2026-02-20 08:15 AM", done: true, note: "Categorized as Infrastructure — High priority." },
            { stage: "Assigned", time: "2026-02-20 10:00 AM", done: true, note: "Assigned to Officer Singh (Infrastructure Dept)." },
            { stage: "Rejected", time: "2026-02-20 04:30 PM", done: true, note: "Officer cited: \"Under municipal repair schedule. Not an emergency.\"" },
            { stage: "Resolved", time: "", done: false, note: "" },
        ],
    },
};

const PRIORITY_COLORS: Record<string, string> = { Critical: "#ef4444", High: "#f97316", Medium: "#f59e0b", Low: "#10b981" };
const STATUS_COLORS: Record<string, string> = { Resolved: "#10b981", "In Progress": "#6366f1", Pending: "#f59e0b", Rejected: "#ef4444" };
const STAGE_ICONS = ["📝", "🤖", "👤", "🔄", "✅"];

export default function TrackPage() {
    const { t } = useLang();
    const [query, setQuery] = useState("");
    const [searched, setSearched] = useState(false);
    const [loading, setLoading] = useState(false);
    const [complaint, setComplaint] = useState<any | null>(null);

    const getTimeline = (c: any) => {
        const createdStr = new Date(c.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
        const updatedStr = new Date(c.updated_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
        
        const baseTimeline = [
            { stage: "Submitted", time: createdStr, done: true, note: "Complaint registered successfully." },
            { stage: "AI Triaged", time: createdStr, done: true, note: `Categorized as ${c.category} — ${c.priority} priority. ${c.ai_reasoning || ""}` },
        ];

        if (c.status === "Pending") {
            return [
                ...baseTimeline,
                { stage: "Assigned", time: "", done: false, note: "Pending officer assignment." },
                { stage: "In Progress", time: "", done: false, note: "" },
                { stage: "Resolved", time: "", done: false, note: "" }
            ];
        } else if (c.status === "In Progress") {
            return [
                ...baseTimeline,
                { stage: "Assigned", time: createdStr, done: true, note: "Assigned to field officer." },
                { stage: "In Progress", time: updatedStr, done: true, note: "Field team deployed. Work in progress." },
                { stage: "Resolved", time: "", done: false, note: "" }
            ];
        } else if (c.status === "Resolved") {
            return [
                ...baseTimeline,
                { stage: "Assigned", time: createdStr, done: true, note: "Assigned to field officer." },
                { stage: "In Progress", time: updatedStr, done: true, note: "Field team deployed. Work completed." },
                { stage: "Resolved", time: updatedStr, done: true, note: "Grievance resolved successfully." }
            ];
        } else if (c.status === "Rejected") {
            return [
                ...baseTimeline,
                { stage: "Assigned", time: createdStr, done: true, note: "Assigned to department officer." },
                { stage: "Rejected", time: updatedStr, done: true, note: c.ai_reasoning || "Decision reviewed. Rejected by officer." },
                { stage: "Resolved", time: "", done: false, note: "" }
            ];
        }
        return baseTimeline;
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const id = query.trim().toUpperCase();
        if (!id) return;
        setLoading(true);
        setSearched(false);
        try {
            const { supabase } = await import("@/lib/supabase");
            const { data, error } = await supabase
                .from("complaints")
                .select("*")
                .eq("id", id);
            
            if (data && data.length > 0) {
                const c = data[0];
                setComplaint({
                    id: c.id,
                    subject: c.subject,
                    description: c.description,
                    category: c.category,
                    priority: c.priority,
                    status: c.status,
                    location: c.location,
                    date: new Date(c.created_at).toLocaleDateString("en-IN"),
                    user: c.user_email || "Anonymous",
                    timeline: getTimeline(c)
                });
            } else {
                setComplaint(null);
            }
        } catch (err) {
            console.error("Error searching complaint:", err);
            setComplaint(null);
        } finally {
            setLoading(false);
            setSearched(true);
        }
    };

    const doneCount = complaint ? complaint.timeline.filter((t: any) => t.done).length : 0;
    const progress = complaint ? Math.round((doneCount / complaint.timeline.length) * 100) : 0;

    return (
        <main className="container section animate-fade-in">
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: "3rem" }}>
                <div style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: "72px", height: "72px", borderRadius: "20px",
                    background: "var(--grad-primary)",
                    fontSize: "2rem", marginBottom: "1.25rem",
                    boxShadow: "0 8px 32px var(--primary-glow)",
                    animation: "float 5s ease-in-out infinite",
                }}>🔍</div>
                <h1 style={{ fontSize: "clamp(2rem, 5vw, 3rem)", marginBottom: "0.75rem" }}>
                    {t("track_title").split(" ").slice(0, -1).join(" ")} <span className="gradient-text">{t("track_title").split(" ").slice(-1)}</span>
                </h1>
                <p style={{ color: "var(--text-muted)", fontSize: "1.1rem" }}>
                    {t("track_subtitle")}
                </p>
            </div>

            {/* Search Box */}
            <div style={{ maxWidth: "580px", margin: "0 auto 3rem" }}>
                <form onSubmit={handleSearch} style={{ display: "flex", gap: "0.75rem" }}>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t("track_placeholder")}
                        style={{ flex: 1, fontFamily: "monospace", fontSize: "1.05rem", letterSpacing: "0.08em", textTransform: "uppercase", height: "52px" }}
                    />
                    <button disabled={loading} className="btn btn-primary" type="submit" style={{ flexShrink: 0, padding: "0 1.75rem", height: "52px", fontSize: "1rem", borderRadius: "0.75rem", opacity: loading ? 0.7 : 1 }}>
                        {loading ? "⏳" : t("track_btn")}
                    </button>
                </form>
                <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: "0.5rem", fontSize: "0.78rem" }}>
                    <span style={{ color: "var(--text-muted)" }}>Try:</span>
                    {["GRV-12044", "GRV-88291", "GRV-33102", "GRV-55678"].map(id => (
                        <button key={id} type="button" onClick={() => setQuery(id)} style={{ padding: "0.2rem 0.6rem", borderRadius: "99px", background: "var(--border-subtle)", border: "1px solid var(--border)", color: "var(--primary)", fontSize: "0.75rem", fontWeight: "700", fontFamily: "monospace", cursor: "pointer", transition: "var(--transition)" }}>{id}</button>
                    ))}
                    <button type="button" onClick={() => setQuery("GRV-99001")} style={{ padding: "0.2rem 0.6rem", borderRadius: "99px", background: "#ef444410", border: "1px solid #ef444440", color: "#ef4444", fontSize: "0.75rem", fontWeight: "700", fontFamily: "monospace", cursor: "pointer", transition: "var(--transition)" }}>GRV-99001 ⚖️</button>
                </div>
            </div>

            {/* Not Found */}
            {searched && !complaint && (
                <div className="glass animate-fade-in" style={{ maxWidth: "560px", margin: "0 auto", padding: "3rem", borderRadius: "1.5rem", textAlign: "center" }}>
                    <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>❌</div>
                    <h2 style={{ marginBottom: "0.75rem" }}>{t("track_not_found")}</h2>
                    <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
                        {t("track_not_found_desc")}
                    </p>
                    <Link href="/" className="btn btn-primary">{t("btn_file_complaint")}</Link>
                </div>
            )}

            {/* Result Card */}
            {complaint && (
                <div className="animate-fade-in" style={{ maxWidth: "700px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

                    {/* Summary Card */}
                    <div className="glass" style={{ padding: "2rem", borderRadius: "1.5rem", borderLeft: `4px solid ${STATUS_COLORS[complaint.status]}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                            <div>
                                <div style={{ fontFamily: "monospace", fontWeight: "700", fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.4rem" }}>{complaint.id}</div>
                                <h2 style={{ fontSize: "1.4rem", marginBottom: "0.5rem" }}>{complaint.subject}</h2>
                                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>{complaint.description}</p>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "flex-end" }}>
                                <span style={{ padding: "0.3rem 0.9rem", borderRadius: "99px", fontSize: "0.8rem", fontWeight: "700", background: `${STATUS_COLORS[complaint.status]}22`, color: STATUS_COLORS[complaint.status], border: `1px solid ${STATUS_COLORS[complaint.status]}44` }}>
                                    ● {complaint.status}
                                </span>
                                <span style={{ padding: "0.3rem 0.9rem", borderRadius: "99px", fontSize: "0.8rem", fontWeight: "700", background: `${PRIORITY_COLORS[complaint.priority]}22`, color: PRIORITY_COLORS[complaint.priority], border: `1px solid ${PRIORITY_COLORS[complaint.priority]}44` }}>
                                    {complaint.priority} {t("track_priority")}
                                </span>
                            </div>
                        </div>

                        {/* Meta row */}
                        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginTop: "1.25rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border)", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                            <span>📂 {complaint.category}</span>
                            <span>📍 {complaint.location}</span>
                            <span>📅 {complaint.date}</span>
                            <span>👤 {complaint.user}</span>
                        </div>

                        {/* Progress bar */}
                        <div style={{ marginTop: "1.25rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem", fontSize: "0.8rem", fontWeight: "600" }}>
                                <span style={{ color: "var(--text-muted)" }}>{t("track_progress")}</span>
                                <span style={{ color: STATUS_COLORS[complaint.status] }}>{progress}%</span>
                            </div>
                            <div style={{ height: "8px", borderRadius: "99px", background: "var(--border)", overflow: "hidden" }}>
                                <div style={{ height: "100%", borderRadius: "99px", width: `${progress}%`, background: `linear-gradient(90deg, #6366f1, ${STATUS_COLORS[complaint.status]})`, transition: "width 1s ease" }} />
                            </div>
                        </div>
                    </div>

                    {/* Timeline */}
                    <div className="glass" style={{ padding: "2rem", borderRadius: "1.5rem" }}>
                        <h3 style={{ marginBottom: "1.75rem" }}>{t("track_timeline")}</h3>
                        <div style={{ position: "relative" }}>
                            {/* Gradient vertical connector */}
                            <div style={{
                                position: "absolute", left: "19px", top: "20px", bottom: "20px", width: "2px",
                                background: `linear-gradient(180deg, #6366f1 ${Math.max(0, (doneCount / complaint.timeline.length) * 100)}%, var(--border) ${Math.max(0, (doneCount / complaint.timeline.length) * 100)}%)`,
                                transition: "background 1s ease",
                            }} />
                            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                                {complaint.timeline.map((step, i) => {
                                    const isActive = !step.done && i === doneCount;
                                    return (
                                        <div key={step.stage} style={{ display: "flex", gap: "1.25rem", paddingBottom: i < complaint.timeline.length - 1 ? "1.75rem" : "0" }}>
                                            {/* Icon bubble */}
                                            <div style={{ position: "relative", flexShrink: 0 }}>
                                                {isActive && (
                                                    <div style={{
                                                        position: "absolute", inset: "-6px", borderRadius: "50%",
                                                        border: "2px solid #6366f1",
                                                        animation: "glowPulse 1.5s ease-in-out infinite",
                                                        opacity: 0.6,
                                                    }} />
                                                )}
                                                <div style={{
                                                    width: "40px", height: "40px", borderRadius: "50%",
                                                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", zIndex: 1,
                                                    background: step.done ? "linear-gradient(135deg, #6366f1, #ec4899)" : "var(--bg-main)",
                                                    border: `2px solid ${step.done ? "#6366f1" : isActive ? "#f59e0b" : "var(--border)"}`,
                                                    boxShadow: step.done ? "0 0 12px rgba(99,102,241,0.3)" : isActive ? "0 0 10px rgba(245,158,11,0.3)" : "none",
                                                    transition: "all 0.4s ease",
                                                }}>
                                                    {STAGE_ICONS[i]}
                                                </div>
                                            </div>
                                            {/* Content */}
                                            <div style={{ flex: 1, paddingTop: "0.5rem" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
                                                    <span style={{ fontWeight: "700", fontSize: "0.95rem", color: step.done ? "var(--text-main)" : isActive ? "#f59e0b" : "var(--text-muted)" }}>{step.stage}</span>
                                                    {step.done && <span style={{ fontSize: "0.65rem", fontWeight: "700", padding: "0.1rem 0.5rem", borderRadius: "99px", background: "#10b98120", color: "#10b981", border: "1px solid #10b98130" }}>DONE</span>}
                                                    {isActive && <span style={{ fontSize: "0.65rem", fontWeight: "700", padding: "0.1rem 0.5rem", borderRadius: "99px", background: "#f59e0b20", color: "#f59e0b", border: "1px solid #f59e0b30" }}>● CURRENT</span>}
                                                </div>
                                                {step.time && <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.3rem" }}>🕐 {step.time}</div>}
                                                {step.note && <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", background: "var(--bg-main)", padding: "0.5rem 0.75rem", borderRadius: "0.5rem", borderLeft: `3px solid ${step.done ? "#6366f1" : isActive ? "#f59e0b" : "var(--border)"}`, transition: "border-color 0.3s" }}>{step.note}</div>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Before & After Slider — only for resolved complaints */}
                    {complaint.status === "Resolved" && (
                        <div className="glass animate-fade-in" style={{ padding: "2rem", borderRadius: "1.5rem" }}>
                            <BeforeAfterSlider
                                complaintCategory={complaint.category}
                                title="📸 Resolution Evidence"
                                beforeLabel="BEFORE"
                                afterLabel="AFTER ✓"
                            />
                        </div>
                    )}

                    {/* AI Advocate Card — only for rejected complaints */}
                    {complaint.status === "Rejected" && (
                        <div className="animate-fade-in">
                            <AIAdvocateCard
                                complaintId={complaint.id}
                                subject={complaint.subject}
                                category={complaint.category}
                                rejectionReason="Under municipal repair schedule. Not an emergency."
                            />
                        </div>
                    )}

                    {/* Back button */}
                    <div style={{ textAlign: "center" }}>
                        <Link href="/" className="btn btn-primary" style={{ display: "inline-flex", gap: "0.5rem", padding: "0.85rem 2.5rem", fontSize: "1rem", borderRadius: "0.875rem" }}>🏠 {t("track_submit_another")}</Link>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes glowPulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.4); opacity: 1; }
                    50%       { box-shadow: 0 0 0 8px rgba(99,102,241,0); opacity: 0.4; }
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50%       { transform: translateY(-8px); }
                }
            `}</style>
        </main>
    );
}
