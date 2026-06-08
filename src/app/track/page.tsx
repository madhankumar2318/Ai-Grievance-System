"use client";

import { useState } from "react";
import Link from "next/link";
import { useLang } from "@/context/LanguageContext";
import BeforeAfterSlider from "@/components/BeforeAfterSlider";
import AIAdvocateCard from "@/components/AIAdvocateCard";

/* ── Constants ──────────────────────────────────────────────────────────── */
const PRIORITY_COLORS: Record<string, string> = {
    Critical: "#ef4444",
    High: "#f97316",
    Medium: "#f59e0b",
    Low: "#10b981",
};
const STATUS_COLORS: Record<string, string> = {
    Resolved: "#10b981",
    "In Progress": "#6366f1",
    Pending: "#f59e0b",
    Rejected: "#ef4444",
};
const STAGE_ICONS: Record<string, string> = {
    Submitted: "📝",
    "AI Triaged": "🤖",
    Assigned: "👤",
    "In Progress": "🔄",
    Resolved: "✅",
    Rejected: "⚖️",
};

/* ── Build a smart timeline from the raw Supabase row ──────────────────── */
function buildTimeline(c: Record<string, string>) {
    const fmt = (d: string) =>
        new Date(d).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
        });

    const createdAt = fmt(c.created_at);
    const updatedAt = fmt(c.updated_at || c.created_at);

    const base = [
        {
            stage: "Submitted",
            time: createdAt,
            done: true,
            note: "Complaint registered successfully in the system.",
        },
        {
            stage: "AI Triaged",
            time: createdAt,
            done: true,
            note: `Categorized as ${c.category} — ${c.priority} priority. ${c.ai_reasoning || "Auto-triage complete."}`,
        },
    ];

    if (c.status === "Pending") {
        return [
            ...base,
            { stage: "Assigned", time: "", done: false, note: "Pending officer assignment." },
            { stage: "In Progress", time: "", done: false, note: "" },
            { stage: "Resolved", time: "", done: false, note: "" },
        ];
    }
    if (c.status === "In Progress") {
        return [
            ...base,
            { stage: "Assigned", time: createdAt, done: true, note: "Assigned to field officer." },
            { stage: "In Progress", time: updatedAt, done: true, note: "Field team deployed. Work in progress." },
            { stage: "Resolved", time: "", done: false, note: "" },
        ];
    }
    if (c.status === "Resolved") {
        return [
            ...base,
            { stage: "Assigned", time: createdAt, done: true, note: "Assigned to field officer." },
            { stage: "In Progress", time: updatedAt, done: true, note: "Field team deployed. Work completed." },
            { stage: "Resolved", time: updatedAt, done: true, note: "Grievance resolved successfully. ✅" },
        ];
    }
    if (c.status === "Rejected") {
        return [
            ...base,
            { stage: "Assigned", time: createdAt, done: true, note: "Reviewed by department officer." },
            {
                stage: "Rejected",
                time: updatedAt,
                done: true,
                note: c.ai_reasoning || "Decision reviewed. Complaint rejected by officer.",
            },
            { stage: "Resolved", time: "", done: false, note: "" },
        ];
    }
    return base;
}

/* ── Component ──────────────────────────────────────────────────────────── */
export default function TrackPage() {
    const { t } = useLang();
    const [query, setQuery] = useState("");
    const [searched, setSearched] = useState(false);
    const [loading, setLoading] = useState(false);
    const [complaint, setComplaint] = useState<Record<string, any> | null>(null);
    const [errorMsg, setErrorMsg] = useState("");

    /* ── Search handler ─────────────────────────────────────────────────── */
    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const id = query.trim().toUpperCase();
        if (!id) return;

        setLoading(true);
        setSearched(false);
        setComplaint(null);
        setErrorMsg("");

        try {
            const { supabase, isConfigured } = await import("@/lib/supabase");

            if (!isConfigured) {
                setErrorMsg("Database is not configured. Please contact support.");
                return;
            }

            const { data, error } = await supabase
                .from("complaints")
                .select("*")
                .eq("id", id)
                .single();

            if (error || !data) {
                setComplaint(null);
            } else {
                setComplaint({
                    id: data.id,
                    subject: data.subject,
                    description: data.description,
                    category: data.category,
                    priority: data.priority,
                    status: data.status,
                    location: data.location,
                    date: new Date(data.created_at).toLocaleDateString("en-IN"),
                    user: data.user_email || "Anonymous",
                    ai_reasoning: data.ai_reasoning || "",
                    timeline: buildTimeline(data),
                });
            }
        } catch {
            setComplaint(null);
            setErrorMsg("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
            setSearched(true);
        }
    };

    const timeline = complaint?.timeline ?? [];
    const doneCount = timeline.filter((s: Record<string, boolean>) => s.done).length;
    const progress = timeline.length > 0 ? Math.round((doneCount / timeline.length) * 100) : 0;

    return (
        <main className="container section animate-fade-in">

            {/* ── Header ── */}
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
                    {t("track_title").split(" ").slice(0, -1).join(" ")}{" "}
                    <span className="gradient-text">{t("track_title").split(" ").slice(-1)}</span>
                </h1>
                <p style={{ color: "var(--text-muted)", fontSize: "1.1rem" }}>
                    {t("track_subtitle")}
                </p>
            </div>

            {/* ── Search Box ── */}
            <div style={{ maxWidth: "580px", margin: "0 auto 3rem" }}>
                <form onSubmit={handleSearch} style={{ display: "flex", gap: "0.75rem" }}>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t("track_placeholder")}
                        style={{
                            flex: 1, fontFamily: "monospace", fontSize: "1.05rem",
                            letterSpacing: "0.08em", textTransform: "uppercase", height: "52px",
                        }}
                    />
                    <button
                        disabled={loading}
                        className="btn btn-primary"
                        type="submit"
                        style={{
                            flexShrink: 0, padding: "0 1.75rem", height: "52px",
                            fontSize: "1rem", borderRadius: "0.75rem",
                            opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer",
                        }}
                    >
                        {loading ? "⏳" : t("track_btn")}
                    </button>
                </form>

                {/* Tip row */}
                <div style={{ marginTop: "0.75rem", textAlign: "center", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    💡 Enter the Complaint ID you received when submitting your grievance (e.g.&nbsp;
                    <span style={{ fontFamily: "monospace", fontWeight: "700", color: "var(--primary)" }}>GRV-XXXXX</span>)
                </div>
            </div>

            {/* ── Error state ── */}
            {errorMsg && (
                <div className="glass animate-fade-in" style={{
                    maxWidth: "560px", margin: "0 auto", padding: "1.5rem 2rem",
                    borderRadius: "1.25rem", textAlign: "center",
                    borderLeft: "4px solid #ef4444", color: "#ef4444", fontWeight: "600",
                }}>
                    ⚠️ {errorMsg}
                </div>
            )}

            {/* ── Not Found ── */}
            {searched && !complaint && !errorMsg && (
                <div className="glass animate-fade-in" style={{
                    maxWidth: "560px", margin: "0 auto", padding: "3rem",
                    borderRadius: "1.5rem", textAlign: "center",
                }}>
                    <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔎</div>
                    <h2 style={{ marginBottom: "0.75rem" }}>{t("track_not_found")}</h2>
                    <p style={{ color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                        {t("track_not_found_desc")}
                    </p>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginBottom: "1.75rem" }}>
                        Make sure you are entering the exact ID shown in your confirmation page.
                    </p>
                    <Link href="/" className="btn btn-primary">
                        {t("btn_file_complaint")}
                    </Link>
                </div>
            )}

            {/* ── Result Card ── */}
            {complaint && (
                <div className="animate-fade-in" style={{
                    maxWidth: "700px", margin: "0 auto",
                    display: "flex", flexDirection: "column", gap: "1.5rem",
                }}>

                    {/* Summary Card */}
                    <div className="glass" style={{
                        padding: "2rem", borderRadius: "1.5rem",
                        borderLeft: `4px solid ${STATUS_COLORS[complaint.status] ?? "#6366f1"}`,
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                            <div>
                                <div style={{ fontFamily: "monospace", fontWeight: "700", fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.4rem" }}>
                                    {complaint.id}
                                </div>
                                <h2 style={{ fontSize: "1.4rem", marginBottom: "0.5rem" }}>{complaint.subject}</h2>
                                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>{complaint.description}</p>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "flex-end" }}>
                                <span style={{
                                    padding: "0.3rem 0.9rem", borderRadius: "99px", fontSize: "0.8rem", fontWeight: "700",
                                    background: `${STATUS_COLORS[complaint.status] ?? "#6366f1"}22`,
                                    color: STATUS_COLORS[complaint.status] ?? "#6366f1",
                                    border: `1px solid ${STATUS_COLORS[complaint.status] ?? "#6366f1"}44`,
                                }}>
                                    ● {complaint.status}
                                </span>
                                <span style={{
                                    padding: "0.3rem 0.9rem", borderRadius: "99px", fontSize: "0.8rem", fontWeight: "700",
                                    background: `${PRIORITY_COLORS[complaint.priority] ?? "#f59e0b"}22`,
                                    color: PRIORITY_COLORS[complaint.priority] ?? "#f59e0b",
                                    border: `1px solid ${PRIORITY_COLORS[complaint.priority] ?? "#f59e0b"}44`,
                                }}>
                                    {complaint.priority} {t("track_priority")}
                                </span>
                            </div>
                        </div>

                        {/* Meta row */}
                        <div style={{
                            display: "flex", gap: "1.5rem", flexWrap: "wrap",
                            marginTop: "1.25rem", paddingTop: "1.25rem",
                            borderTop: "1px solid var(--border)",
                            fontSize: "0.82rem", color: "var(--text-muted)",
                        }}>
                            <span>📂 {complaint.category}</span>
                            <span>📍 {complaint.location}</span>
                            <span>📅 {complaint.date}</span>
                            <span>👤 {complaint.user}</span>
                        </div>

                        {/* Progress bar */}
                        <div style={{ marginTop: "1.25rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem", fontSize: "0.8rem", fontWeight: "600" }}>
                                <span style={{ color: "var(--text-muted)" }}>{t("track_progress")}</span>
                                <span style={{ color: STATUS_COLORS[complaint.status] ?? "#6366f1" }}>{progress}%</span>
                            </div>
                            <div style={{ height: "8px", borderRadius: "99px", background: "var(--border)", overflow: "hidden" }}>
                                <div style={{
                                    height: "100%", borderRadius: "99px", width: `${progress}%`,
                                    background: `linear-gradient(90deg, #6366f1, ${STATUS_COLORS[complaint.status] ?? "#6366f1"})`,
                                    transition: "width 1s ease",
                                }} />
                            </div>
                        </div>
                    </div>

                    {/* Timeline */}
                    <div className="glass" style={{ padding: "2rem", borderRadius: "1.5rem" }}>
                        <h3 style={{ marginBottom: "1.75rem" }}>{t("track_timeline")}</h3>
                        <div style={{ position: "relative" }}>
                            {/* Vertical connector line */}
                            <div style={{
                                position: "absolute", left: "19px", top: "20px", bottom: "20px", width: "2px",
                                background: `linear-gradient(180deg, #6366f1 ${Math.max(0, (doneCount / timeline.length) * 100)}%, var(--border) ${Math.max(0, (doneCount / timeline.length) * 100)}%)`,
                                transition: "background 1s ease",
                            }} />
                            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                                {timeline.map((step: Record<string, any>, i: number) => {
                                    const isActive = !step.done && i === doneCount;
                                    const icon = STAGE_ICONS[step.stage] ?? "📌";
                                    return (
                                        <div key={`${step.stage}-${i}`} style={{
                                            display: "flex", gap: "1.25rem",
                                            paddingBottom: i < timeline.length - 1 ? "1.75rem" : "0",
                                        }}>
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
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    fontSize: "1rem", zIndex: 1,
                                                    background: step.done ? "linear-gradient(135deg, #6366f1, #ec4899)" : "var(--bg-main)",
                                                    border: `2px solid ${step.done ? "#6366f1" : isActive ? "#f59e0b" : "var(--border)"}`,
                                                    boxShadow: step.done ? "0 0 12px rgba(99,102,241,0.3)" : isActive ? "0 0 10px rgba(245,158,11,0.3)" : "none",
                                                    transition: "all 0.4s ease",
                                                }}>
                                                    {icon}
                                                </div>
                                            </div>
                                            {/* Content */}
                                            <div style={{ flex: 1, paddingTop: "0.5rem" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
                                                    <span style={{ fontWeight: "700", fontSize: "0.95rem", color: step.done ? "var(--text-main)" : isActive ? "#f59e0b" : "var(--text-muted)" }}>
                                                        {step.stage}
                                                    </span>
                                                    {step.done && (
                                                        <span style={{ fontSize: "0.65rem", fontWeight: "700", padding: "0.1rem 0.5rem", borderRadius: "99px", background: "#10b98120", color: "#10b981", border: "1px solid #10b98130" }}>
                                                            DONE
                                                        </span>
                                                    )}
                                                    {isActive && (
                                                        <span style={{ fontSize: "0.65rem", fontWeight: "700", padding: "0.1rem 0.5rem", borderRadius: "99px", background: "#f59e0b20", color: "#f59e0b", border: "1px solid #f59e0b30" }}>
                                                            ● CURRENT
                                                        </span>
                                                    )}
                                                </div>
                                                {step.time && (
                                                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.3rem" }}>
                                                        🕐 {step.time}
                                                    </div>
                                                )}
                                                {step.note && (
                                                    <div style={{
                                                        fontSize: "0.82rem", color: "var(--text-muted)",
                                                        background: "var(--bg-main)", padding: "0.5rem 0.75rem",
                                                        borderRadius: "0.5rem",
                                                        borderLeft: `3px solid ${step.done ? "#6366f1" : isActive ? "#f59e0b" : "var(--border)"}`,
                                                        transition: "border-color 0.3s",
                                                    }}>
                                                        {step.note}
                                                    </div>
                                                )}
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
                                rejectionReason={complaint.ai_reasoning || "Rejected by officer."}
                            />
                        </div>
                    )}

                    {/* Back button */}
                    <div style={{ textAlign: "center" }}>
                        <Link
                            href="/"
                            className="btn btn-primary"
                            style={{ display: "inline-flex", gap: "0.5rem", padding: "0.85rem 2.5rem", fontSize: "1rem", borderRadius: "0.875rem" }}
                        >
                            🏠 {t("track_submit_another")}
                        </Link>
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
