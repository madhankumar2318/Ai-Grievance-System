"use client";

import { useState } from "react";
import Link from "next/link";
import { useLang } from "@/context/LanguageContext";
import BeforeAfterSlider from "@/components/BeforeAfterSlider";
import AIAdvocateCard from "@/components/AIAdvocateCard";
import { getComplaintByIdServerAction } from "@/app/actions/complaintActions";

export interface TimelineStep {
    stage: string;
    time: string;
    done: boolean;
    note: string;
}

export interface Complaint {
    id: string;
    subject: string;
    description: string;
    status: string;
    priority: string;
    category: string;
    location: string;
    date: string;
    user: string;
    ai_reasoning?: string;
    timeline: TimelineStep[];
}

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
        const atrMatch = (c.description || "").match(/\[ACTION_TAKEN_REPORT:([\s\S]*?)\]/);
        let resolvedNote = "Grievance resolved successfully. ✅";
        if (atrMatch) {
            try {
                const atr = JSON.parse(atrMatch[1]);
                resolvedNote = `Resolved by ${atr.officerName}: ${atr.actionDescription}`;
            } catch {}
        }
        return [
            ...base,
            { stage: "Assigned", time: createdAt, done: true, note: "Assigned to field officer." },
            { stage: "In Progress", time: updatedAt, done: true, note: "Field team deployed. Work completed." },
            { stage: "Resolved", time: updatedAt, done: true, note: resolvedNote },
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

/* ── PII Masking ─────────────────────────────────────────────────────────── */
/**
 * Masks a citizen's email on the public tracking page to prevent PII exposure.
 * e.g. "rajan.kumar@gmail.com" → "r***r@gmail.com"
 * Officers/Chief dashboards always receive the full email via authenticated APIs.
 */
function maskEmail(email: string): string {
    if (!email || !email.includes("@")) return "Registered Citizen";
    const [local, domain] = email.split("@");
    if (local.length <= 1) return `${local}***@${domain}`;
    const masked = local[0] + "***" + local[local.length - 1];
    return `${masked}@${domain}`;
}

/* ── Component ──────────────────────────────────────────────────────────── */
export default function TrackPage() {
    const { t } = useLang();
    const [query, setQuery] = useState("");
    const [searched, setSearched] = useState(false);
    const [loading, setLoading] = useState(false);
    const [complaint, setComplaint] = useState<Complaint | null>(null);
    const [errorMsg, setErrorMsg] = useState("");
    const [viewingModalPhoto, setViewingModalPhoto] = useState<{ url: string; title: string } | null>(null);

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
            // ── Secure server-side lookup ─────────────────────────────────────
            // getComplaintByIdServerAction runs entirely on the Next.js server:
            //   • Supabase API key never reaches the browser
            //   • user_email is masked before JSON is serialised to the client
            //   • Rate-limited to 20 queries/min/IP to prevent ID enumeration
            const result = await getComplaintByIdServerAction(id);

            if (result.success && result.complaint) {
                const c = result.complaint;
                setComplaint({
                    id: c.id,
                    subject: c.subject,
                    description: c.description,
                    category: c.category,
                    priority: c.priority,
                    status: c.status || "Pending",
                    location: c.location || "",
                    date: c.created_at
                        ? new Date(c.created_at).toLocaleDateString("en-IN")
                        : new Date().toLocaleDateString("en-IN"),
                    // user_email is already masked server-side — no client masking needed
                    user: c.user_email || "Registered Citizen",
                    ai_reasoning: c.ai_reasoning || "",
                    timeline: buildTimeline({
                        created_at: c.created_at,
                        updated_at: c.updated_at || c.created_at,
                        status: c.status,
                        category: c.category,
                        priority: c.priority,
                        ai_reasoning: c.ai_reasoning || "",
                        description: c.description || "",
                    }),
                });
                return;
            }

            // Rate-limited or server error — surface message to user
            if (!result.success && result.error) {
                // Don't fall through to localStorage for rate limit errors
                if (result.rateLimited) {
                    setErrorMsg(result.error);
                    return;
                }
            }

            // ── Offline / demo fallback — localStorage only ───────────────────
            // This path is only reached if the server action found nothing.
            // localStorage data was written by this same browser so no
            // cross-user PII leakage is possible here.
            if (typeof window !== "undefined") {
                try {
                    const localList = JSON.parse(
                        localStorage.getItem("grievance_my_complaints") || "[]"
                    );
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const found = localList.find((c: any) => c.id === id);
                    if (found) {
                        setComplaint({
                            id: found.id,
                            subject: found.subject,
                            description: found.description,
                            category: found.category,
                            priority: found.priority,
                            status: found.status || "Pending",
                            location: found.location || "",
                            date: found.createdAt
                                ? new Date(found.createdAt).toLocaleDateString("en-IN")
                                : new Date().toLocaleDateString("en-IN"),
                            user: maskEmail(found.userEmail || found.user_email || ""),
                            ai_reasoning: found.aiReasoning || found.ai_reasoning || "",
                            timeline: buildTimeline({
                                created_at: found.createdAt || found.created_at || new Date().toISOString(),
                                updated_at: found.updatedAt || found.updated_at || found.createdAt || found.created_at,
                                status: found.status,
                                category: found.category,
                                priority: found.priority,
                                ai_reasoning: found.aiReasoning || found.ai_reasoning || "",
                            }),
                        });
                        return;
                    }
                } catch { /* localStorage parse error — ignore */ }
            }

            // Nothing found anywhere
            setComplaint(null);
        } catch {
            setComplaint(null);
            setErrorMsg("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
            setSearched(true);
        }
    };

    const timeline = complaint?.timeline ?? [];
    const doneCount = timeline.filter((s: TimelineStep) => s.done).length;
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
                    <span style={{ fontFamily: "monospace", fontWeight: "700", color: "var(--primary)" }}>GRV-49033</span>)
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
                                {(() => {
                                    const photoMatch = complaint.description.match(/\[EVIDENCE_PHOTO:([^\]]+)\]/);
                                    const evidencePhoto = photoMatch ? photoMatch[1] : null;
                                    const atrMatch = complaint.description.match(/\[ACTION_TAKEN_REPORT:([\s\S]*?)\]/);
                                    let atrData = null;
                                    if (atrMatch) {
                                        try { atrData = JSON.parse(atrMatch[1]); } catch {}
                                    }
                                    const cleanDesc = complaint.description
                                        .replace(/\[EVIDENCE_PHOTO:[^\]]+\]/g, "")
                                        .replace(/\[ACTION_TAKEN_REPORT:[\s\S]*?\]/g, "")
                                        .trim();
                                    return (
                                        <>
                                            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>{cleanDesc}</p>
                                            {evidencePhoto && (
                                                <div style={{ marginTop: "0.75rem" }}>
                                                    <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "#a5b4fc", marginBottom: "0.35rem" }}>
                                                        📷 Attached Photo Evidence
                                                    </div>
                                                    <img
                                                        src={evidencePhoto}
                                                        alt="Evidence"
                                                        style={{ maxWidth: "240px", maxHeight: "160px", borderRadius: "0.5rem", border: "1px solid var(--border)", objectFit: "cover", cursor: "pointer" }}
                                                        onClick={() => setViewingModalPhoto({ url: evidencePhoto, title: "Citizen Evidence Photo" })}
                                                    />
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
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
                            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                                {timeline.map((step: TimelineStep, i: number) => {
                                    const isActive = !step.done && i === doneCount;
                                    const icon = STAGE_ICONS[step.stage] ?? "📌";
                                    return (
                                        <div key={`${step.stage}-${i}`} style={{
                                            display: "flex", gap: "1.25rem",
                                            paddingBottom: i < timeline.length - 1 ? "1.75rem" : "0",
                                            position: "relative",
                                        }}>
                                            {/* Vertical connector line to next step */}
                                            {i < timeline.length - 1 && (
                                                <div style={{
                                                    position: "absolute",
                                                    left: "20px",
                                                    top: "40px",
                                                    bottom: "0px",
                                                    width: "2px",
                                                    transform: "translateX(-50%)",
                                                    background: step.done
                                                        ? (timeline[i + 1]?.done ? "#6366f1" : "linear-gradient(180deg, #6366f1 0%, #f59e0b 100%)")
                                                        : "rgba(255, 255, 255, 0.15)",
                                                    zIndex: 0,
                                                    transition: "background 0.5s ease",
                                                }} />
                                            )}

                                            {/* Icon bubble */}
                                            <div style={{
                                                position: "relative",
                                                width: "40px",
                                                height: "40px",
                                                flexShrink: 0,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                zIndex: 1,
                                            }}>
                                                {isActive && (
                                                    <div style={{
                                                        position: "absolute",
                                                        width: "48px",
                                                        height: "48px",
                                                        top: "-4px",
                                                        left: "-4px",
                                                        borderRadius: "50%",
                                                        border: "2px solid #f59e0b",
                                                        animation: "pulseRing 2s ease-in-out infinite",
                                                        pointerEvents: "none",
                                                    }} />
                                                )}
                                                <div style={{
                                                    width: "40px", height: "40px", borderRadius: "50%",
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    fontSize: "1.05rem",
                                                    background: step.done
                                                        ? "linear-gradient(135deg, #6366f1, #ec4899)"
                                                        : isActive
                                                        ? "rgba(245, 158, 11, 0.18)"
                                                        : "var(--bg-main)",
                                                    border: `2px solid ${step.done ? "#6366f1" : isActive ? "#f59e0b" : "var(--border)"}`,
                                                    boxShadow: step.done
                                                        ? "0 0 12px rgba(99,102,241,0.3)"
                                                        : isActive
                                                        ? "0 0 14px rgba(245,158,11,0.4)"
                                                        : "none",
                                                    color: step.done ? "#ffffff" : isActive ? "#f59e0b" : "var(--text-muted)",
                                                    transition: "all 0.4s ease",
                                                }}>
                                                    {icon}
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <div style={{ flex: 1, paddingTop: "0.4rem" }}>
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

                    {/* ── Official Action Taken Report (ATR) & Proof Section ── */}
                    {complaint.status === "Resolved" && (() => {
                        const atrMatch = complaint.description.match(/\[ACTION_TAKEN_REPORT:([\s\S]*?)\]/);
                        let atrData = null;
                        if (atrMatch) {
                            try { atrData = JSON.parse(atrMatch[1]); } catch {}
                        }
                        const photoMatch = complaint.description.match(/\[EVIDENCE_PHOTO:([^\]]+)\]/);
                        const citizenBeforePhoto = photoMatch ? photoMatch[1] : null;

                        if (atrData) {
                            return (
                                <div className="glass animate-fade-in" style={{
                                    padding: "2rem",
                                    borderRadius: "1.5rem",
                                    border: "1.5px solid rgba(16, 185, 129, 0.4)",
                                    background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(6, 182, 212, 0.04))",
                                    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
                                }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
                                        <div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                                                <span style={{ fontSize: "1.3rem" }}>✅</span>
                                                <h3 style={{ fontSize: "1.25rem", fontWeight: "800", color: "#ffffff", margin: 0 }}>
                                                    Official Action Taken Report (ATR)
                                                </h3>
                                            </div>
                                            <p style={{ fontSize: "0.82rem", color: "#34d399", margin: 0, fontWeight: "600" }}>
                                                ✓ Ground repair verified and documented by municipal authorities
                                            </p>
                                        </div>
                                        <span style={{
                                            padding: "0.25rem 0.75rem",
                                            borderRadius: "99px",
                                            background: "rgba(16, 185, 129, 0.2)",
                                            color: "#10b981",
                                            border: "1px solid rgba(16, 185, 129, 0.4)",
                                            fontSize: "0.75rem",
                                            fontWeight: "800",
                                        }}>
                                            VERIFIED RESOLUTION
                                        </span>
                                    </div>

                                    {/* Officer & Date details */}
                                    <div style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                                        gap: "1rem",
                                        marginBottom: "1.25rem",
                                        padding: "1rem",
                                        borderRadius: "0.85rem",
                                        background: "rgba(0,0,0,0.25)",
                                        border: "1px solid rgba(255,255,255,0.06)",
                                    }}>
                                        <div>
                                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700", marginBottom: "0.2rem" }}>
                                                👷 Official Staff / Engineer
                                            </div>
                                            <div style={{ fontSize: "0.95rem", fontWeight: "700", color: "#ffffff" }}>
                                                {atrData.officerName || "Municipal Field Officer"}
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700", marginBottom: "0.2rem" }}>
                                                📅 Resolution Date
                                            </div>
                                            <div style={{ fontSize: "0.95rem", fontWeight: "700", color: "#ffffff" }}>
                                                {atrData.resolvedAt ? new Date(atrData.resolvedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : complaint.date}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Description */}
                                    <div style={{ marginBottom: "1.5rem" }}>
                                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "800", marginBottom: "0.35rem" }}>
                                            📝 Work Executed &amp; Action Taken:
                                        </div>
                                        <div style={{
                                            fontSize: "0.92rem",
                                            lineHeight: 1.6,
                                            color: "#e2e8f0",
                                            padding: "1rem 1.25rem",
                                            borderRadius: "0.75rem",
                                            background: "rgba(255,255,255,0.04)",
                                            borderLeft: "4px solid #10b981",
                                        }}>
                                            "{atrData.actionDescription}"
                                        </div>
                                    </div>

                                    {/* Before vs After Photo Proofs */}
                                    <div>
                                        <div style={{ fontSize: "0.85rem", fontWeight: "800", color: "#ffffff", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                            <span>📸</span>
                                            <span>Ground Evidence: Before vs. After Repair</span>
                                        </div>

                                        <div style={{
                                            display: "grid",
                                            gridTemplateColumns: citizenBeforePhoto && atrData.resolutionPhoto ? "repeat(auto-fit, minmax(280px, 1fr))" : "1fr",
                                            gap: "1.25rem",
                                        }}>
                                            {/* Citizen's Before Photo */}
                                            {citizenBeforePhoto && (
                                                <div style={{
                                                    borderRadius: "0.85rem",
                                                    overflow: "hidden",
                                                    border: "1.5px solid rgba(239, 68, 68, 0.4)",
                                                    background: "#080b12",
                                                }}>
                                                    <div style={{ position: "relative", height: "220px", display: "flex", alignItems: "center", justifyContent: "center", background: "#000" }}>
                                                        <img
                                                            src={citizenBeforePhoto}
                                                            alt="Citizen Reported Evidence"
                                                            style={{ maxHeight: "220px", width: "100%", objectFit: "contain", cursor: "pointer" }}
                                                            onClick={() => setViewingModalPhoto({ url: citizenBeforePhoto, title: "Citizen Evidence (Before Repair)" })}
                                                        />
                                                        <div style={{
                                                            position: "absolute", top: "0.6rem", left: "0.6rem",
                                                            background: "rgba(239, 68, 68, 0.9)", color: "white",
                                                            padding: "0.2rem 0.65rem", borderRadius: "99px",
                                                            fontSize: "0.7rem", fontWeight: "800",
                                                        }}>
                                                            BEFORE REPAIR
                                                        </div>
                                                    </div>
                                                    <div style={{ padding: "0.75rem 1rem", fontSize: "0.78rem", color: "var(--text-muted)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                        <span>📷 Citizen's Reported Evidence</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setViewingModalPhoto({ url: citizenBeforePhoto, title: "Citizen Evidence (Before Repair)" })}
                                                            style={{ background: "none", border: "none", color: "#a5b4fc", cursor: "pointer", fontWeight: "600", fontSize: "0.75rem" }}
                                                        >
                                                            🔍 Inspect
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Officer's Resolution Photo */}
                                            {atrData.resolutionPhoto && (
                                                <div style={{
                                                    borderRadius: "0.85rem",
                                                    overflow: "hidden",
                                                    border: "1.5px solid rgba(16, 185, 129, 0.5)",
                                                    background: "#080b12",
                                                    boxShadow: "0 0 25px rgba(16, 185, 129, 0.2)",
                                                }}>
                                                    <div style={{ position: "relative", height: "220px", display: "flex", alignItems: "center", justifyContent: "center", background: "#000" }}>
                                                        <img
                                                            src={atrData.resolutionPhoto}
                                                            alt="Officer Resolution Proof"
                                                            style={{ maxHeight: "220px", width: "100%", objectFit: "contain", cursor: "pointer" }}
                                                            onClick={() => setViewingModalPhoto({ url: atrData.resolutionPhoto, title: "Official Resolution Proof (After Repair)" })}
                                                        />
                                                        <div style={{
                                                            position: "absolute", top: "0.6rem", left: "0.6rem",
                                                            background: "rgba(16, 185, 129, 0.95)", color: "white",
                                                            padding: "0.2rem 0.65rem", borderRadius: "99px",
                                                            fontSize: "0.7rem", fontWeight: "800",
                                                            boxShadow: "0 2px 8px rgba(16, 185, 129, 0.4)",
                                                        }}>
                                                            AFTER REPAIR ✓
                                                        </div>
                                                    </div>
                                                    <div style={{ padding: "0.75rem 1rem", fontSize: "0.78rem", color: "#34d399", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: "600" }}>
                                                        <span>✓ Verified Ground Repair Proof</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setViewingModalPhoto({ url: atrData.resolutionPhoto, title: "Official Resolution Proof (After Repair)" })}
                                                            style={{ background: "none", border: "none", color: "#34d399", cursor: "pointer", fontWeight: "700", fontSize: "0.75rem" }}
                                                        >
                                                            🔍 Inspect Full Size
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        // Fallback to slider if legacy complaint without ATR
                        return (
                            <div className="glass animate-fade-in" style={{ padding: "2rem", borderRadius: "1.5rem" }}>
                                <BeforeAfterSlider
                                    complaintCategory={complaint.category}
                                    title="📸 Resolution Evidence"
                                    beforeLabel="BEFORE"
                                    afterLabel="AFTER ✓"
                                />
                            </div>
                        );
                    })()}

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

                    {/* ── Photo Evidence Viewer Lightbox Modal ── */}
            {viewingModalPhoto && (
                <div
                    onClick={() => setViewingModalPhoto(null)}
                    style={{
                        position: "fixed", inset: 0, zIndex: 9999,
                        background: "rgba(5,5,10,0.85)", backdropFilter: "blur(8px)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        padding: "1.5rem",
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        className="animate-fade-in"
                        style={{
                            maxWidth: "900px", width: "100%", maxHeight: "90vh",
                            background: "rgba(15,15,26,0.98)", border: "1px solid rgba(99,102,241,0.3)",
                            borderRadius: "1.25rem", overflow: "hidden", display: "flex", flexDirection: "column",
                            boxShadow: "0 25px 60px rgba(0,0,0,0.7)",
                        }}
                    >
                        <div style={{
                            padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)",
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            background: "rgba(255,255,255,0.02)",
                        }}>
                            <span style={{ fontWeight: "800", fontSize: "0.95rem", color: "#ffffff" }}>
                                {viewingModalPhoto.title}
                            </span>
                            <button
                                onClick={() => setViewingModalPhoto(null)}
                                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.4rem", cursor: "pointer" }}
                            >✕</button>
                        </div>
                        <div style={{ padding: "1.25rem", display: "flex", alignItems: "center", justifyContent: "center", background: "#000" }}>
                            <img
                                src={viewingModalPhoto.url}
                                alt={viewingModalPhoto.title}
                                style={{ maxHeight: "70vh", maxWidth: "100%", objectFit: "contain" }}
                            />
                        </div>
                        <div style={{ padding: "0.75rem 1.25rem", borderTop: "1px solid var(--border)", textAlign: "right" }}>
                            <button
                                onClick={() => setViewingModalPhoto(null)}
                                style={{ padding: "0.4rem 1rem", borderRadius: "0.5rem", background: "var(--primary)", border: "none", color: "white", fontSize: "0.8rem", fontWeight: "700", cursor: "pointer" }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
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
                @keyframes pulseRing {
                    0%, 100% {
                        transform: scale(1);
                        opacity: 0.9;
                        box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.6);
                    }
                    50% {
                        transform: scale(1.15);
                        opacity: 0.25;
                        box-shadow: 0 0 0 7px rgba(245, 158, 11, 0);
                    }
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50%       { transform: translateY(-8px); }
                }
            `}</style>
        </main>
    );
}
