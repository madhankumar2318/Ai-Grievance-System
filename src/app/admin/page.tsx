"use client";

import React, { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useLang } from "@/context/LanguageContext";

const MOCK_COMPLAINTS = [
    {
        id: "GRV-12044", subject: "Street Light Failure", category: "Infrastructure", priority: "Medium",
        status: "Pending", user: "John Doe", attachments: 2, userEmail: "",
        description: "Multiple street lights on MG Road between sectors 4–6 have been non-functional for over 10 days, creating a safety hazard for pedestrians and vehicles at night.",
        location: "MG Road, Sector 5", date: "2025-02-15",
        aiNote: "Auto-assigned to Municipal Electrical Dept. Est. resolution: 3–7 days. Similar reports: 3 in last 30 days.",
    },
    {
        id: "GRV-88291", subject: "Potable Water Contamination", category: "Environment", priority: "Critical",
        status: "In Progress", user: "Jane Smith", attachments: 3, userEmail: "",
        description: "Tap water in Block C has turned brownish-yellow with a foul odour since 12th Feb. Multiple families affected. Lab testing recommended immediately.",
        location: "Block C, Green Colony", date: "2025-02-14",
        aiNote: "Escalated to Public Health dept. Lab test dispatch scheduled. Priority raised to CRITICAL due to health risk.",
    },
    {
        id: "GRV-33102", subject: "Illegal Parking in Zone B", category: "Safety", priority: "Low",
        status: "Resolved", user: "Robert Brown", attachments: 0, userEmail: "",
        description: "Vehicles parked illegally on the footpath in front of City Mall, blocking emergency access routes regularly.",
        location: "City Mall, Zone B", date: "2025-02-10",
        aiNote: "Resolved — towing authority notified. 4 vehicles cleared. Signage updated.",
    },
    {
        id: "GRV-40019", subject: "Public Hospital Staff Shortage", category: "Public Health", priority: "High",
        status: "Pending", user: "Alice Green", attachments: 1, userEmail: "",
        description: "District hospital has been operating with 40% less staff for 3 weeks. OPD wait times have crossed 4 hours. Urgent staff deployment needed.",
        location: "District General Hospital", date: "2025-02-16",
        aiNote: "Forwarded to Health Director's office. Temporary staff deployment request raised. Awaiting approval.",
    },
    {
        id: "GRV-55678", subject: "Road Pothole Danger", category: "Infrastructure", priority: "High",
        status: "In Progress", user: "Ravi Kumar", attachments: 4, userEmail: "",
        description: "A large 2-foot deep pothole on NH48 near the Flyover junction has caused 2 accidents this week. Immediate repair is critical for road safety.",
        location: "NH48, Flyover Junction", date: "2025-02-17",
        aiNote: "Assigned to NHAI road repair team. Temporary barricading done. Patch repair scheduled for Feb 20.",
    },
];

const PRIORITY_CONFIG: Record<string, { color: string; icon: string }> = {
    Critical: { color: "#ef4444", icon: "🚨" },
    High: { color: "#f97316", icon: "⚠️" },
    Medium: { color: "#f59e0b", icon: "📍" },
    Low: { color: "#10b981", icon: "✅" },
};

const STATUS_CONFIG: Record<string, { color: string; dot: string }> = {
    Pending: { color: "#f59e0b", dot: "#f59e0b" },
    "In Progress": { color: "#6366f1", dot: "#6366f1" },
    Resolved: { color: "#10b981", dot: "#10b981" },
    Rejected: { color: "#ef4444", dot: "#ef4444" },
};

const CATEGORY_ICONS: Record<string, string> = {
    Infrastructure: "🏗️",
    Environment: "🌿",
    Safety: "🛡️",
    "Public Health": "🏥",
};

export default function AdminDashboard() {
    const { t } = useLang();
    const [complaints, setComplaints] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("All");
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const toggleRow = (id: string) => setExpandedId(prev => prev === id ? null : id);

    const fetchComplaints = async () => {
        try {
            const res = await fetch("/api/admin/complaints");
            const data = await res.json();
            if (data.success && data.complaints) {
                const mapped = data.complaints.map((c: any) => ({
                    id: c.id,
                    subject: c.subject,
                    category: c.category,
                    priority: c.priority,
                    status: c.status,
                    user: c.user_email || "Anonymous",
                    attachments: c.attachment_count || 0,
                    userEmail: c.user_email || "",
                    description: c.description,
                    location: c.location,
                    date: new Date(c.created_at).toLocaleDateString("en-IN"),
                    aiNote: c.ai_reasoning || "Triage complete.",
                }));
                setComplaints(mapped);
            }
        } catch (err) {
            console.error("Error fetching complaints:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchComplaints();
    }, []);

    const updateStatus = async (id: string, newStatus: "Resolved" | "Rejected") => {
        setComplaints(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
        setExpandedId(null);
        const complaint = complaints.find(c => c.id === id);
        if (complaint?.userEmail) {
            try {
                await fetch("/api/notify", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ to: complaint.userEmail, complaintId: id, subject: complaint.subject, category: complaint.category, priority: complaint.priority, type: "status_change" }),
                });
            } catch { /* silent */ }
        }
        try {
            await fetch("/api/admin/update-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status: newStatus }),
            });
        } catch (err) {
            console.error("Error updating status:", err);
        }
    };

    const pending = complaints.filter(c => c.status === "Pending").length;
    const resolved = complaints.filter(c => c.status === "Resolved").length;
    const inProgress = complaints.filter(c => c.status === "In Progress").length;
    const rejected = complaints.filter(c => c.status === "Rejected").length;

    const STATS = [
        { label: t("admin_total"), value: complaints.length, color: "#6366f1", icon: "📋", grad: "linear-gradient(135deg,#6366f1,#8b5cf6)" },
        { label: t("admin_pending"), value: pending, color: "#f59e0b", icon: "⏳", grad: "linear-gradient(135deg,#f59e0b,#f97316)" },
        { label: t("admin_in_progress"), value: inProgress, color: "#6366f1", icon: "🔄", grad: "linear-gradient(135deg,#06b6d4,#6366f1)" },
        { label: t("admin_resolved"), value: resolved, color: "#10b981", icon: "✅", grad: "linear-gradient(135deg,#10b981,#06b6d4)" },
        { label: "Rejected", value: rejected, color: "#ef4444", icon: "✕", grad: "linear-gradient(135deg,#ef4444,#f97316)" },
    ];

    const FILTERS = ["All", "Pending", "In Progress", "Resolved", "Rejected"];
    const filtered = filter === "All" ? complaints : complaints.filter(c => c.status === filter);

    return (
        <ProtectedRoute allowedRoles={["authority", "chief"]}>
            <main className="container section">

                {/* ── Header ── */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3rem", flexWrap: "wrap", gap: "1rem" }}>
                    <div>
                        <h1 className="gradient-text" style={{ fontSize: "2.5rem" }}>{t("admin_title")}</h1>
                        <p style={{ marginTop: "0.25rem" }}>{t("admin_subtitle")}</p>
                    </div>
                    <div className="glass" style={{ padding: "0.5rem 1rem", borderRadius: "0.5rem", fontSize: "0.9rem", fontWeight: "bold", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block", position: "relative" }}>
                            <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#10b981", animation: "ping 1.5s ease-out infinite" }} />
                        </span>
                        {t("admin_active_officers")}
                    </div>
                </div>

                {/* ── Stat Cards ── */}
                <div className="stagger-children" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1.25rem", marginBottom: "2.5rem" }}>
                    {STATS.map(({ label, value, color, icon, grad }) => (
                        <div key={label} className="glass card-hover animate-fade-in" style={{ padding: "1.75rem 1.25rem", borderRadius: "var(--radius)", textAlign: "center", borderTop: `3px solid ${color}`, position: "relative", overflow: "hidden" }}>
                            <div style={{ position: "absolute", top: "-20px", right: "-20px", width: "80px", height: "80px", borderRadius: "50%", background: `${color}18`, filter: "blur(20px)" }} />
                            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "40px", height: "40px", borderRadius: "10px", background: grad, fontSize: "1.1rem", marginBottom: "0.75rem", boxShadow: `0 4px 12px ${color}44` }}>
                                {icon}
                            </div>
                            <div style={{ fontSize: "2.25rem", fontWeight: "900", color, lineHeight: 1, marginBottom: "0.3rem" }}>{value}</div>
                            <div style={{ fontSize: "0.78rem", fontWeight: "600", color: "var(--text-muted)" }}>{label}</div>
                        </div>
                    ))}
                </div>

                {/* ── Filter Bar ── */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "var(--text-muted)", marginRight: "0.25rem" }}>Filter:</span>
                    {FILTERS.map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            style={{
                                padding: "0.35rem 0.9rem", borderRadius: "99px",
                                fontSize: "0.78rem", fontWeight: "700",
                                border: filter === f ? "1.5px solid var(--primary)" : "1.5px solid var(--border)",
                                background: filter === f ? "var(--grad-primary)" : "var(--bg-card)",
                                color: filter === f ? "white" : "var(--text-muted)",
                                cursor: "pointer", transition: "var(--transition)",
                                boxShadow: filter === f ? "0 4px 12px var(--primary-glow)" : "none",
                            }}
                        >{f}</button>
                    ))}
                    <span style={{ marginLeft: "auto", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        Showing {filtered.length} of {complaints.length}
                    </span>
                </div>

                {/* ── Hint ── */}
                <p style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span>👆</span> Click any row to view full complaint details
                </p>

                {/* ── Table ── */}
                <div className="glass" style={{ borderRadius: "1.5rem", overflow: "hidden", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                        <thead>
                            <tr style={{ background: "rgba(99,102,241,0.05)", borderBottom: "1px solid var(--border)" }}>
                                {[t("admin_col_id"), t("admin_col_subject"), t("admin_col_citizen"), t("admin_col_priority"), t("admin_col_status"), t("admin_col_attachments"), t("admin_col_actions"), ""].map((h, i) => (
                                    <th key={i} style={{ padding: "1.1rem 1.25rem", fontWeight: "700", fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((c, idx) => {
                                const pCfg = PRIORITY_CONFIG[c.priority] ?? PRIORITY_CONFIG.Medium;
                                const sCfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.Pending;
                                const isExpanded = expandedId === c.id;
                                return (
                                    <React.Fragment key={c.id}>
                                        {/* ── Main Row ── */}
                                        <tr
                                            key={c.id}
                                            onClick={() => toggleRow(c.id)}
                                            style={{
                                                borderBottom: isExpanded ? "none" : "1px solid var(--border)",
                                                animationDelay: `${idx * 40}ms`,
                                                cursor: "pointer",
                                                background: isExpanded ? "rgba(99,102,241,0.05)" : "transparent",
                                                transition: "background 0.2s ease",
                                            }}
                                            className="animate-fade-in"
                                            onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLTableRowElement).style.background = "rgba(99,102,241,0.03)"; }}
                                            onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                                        >
                                            {/* ID */}
                                            <td style={{ padding: "1.1rem 1.25rem", fontWeight: "700", fontFamily: "monospace", fontSize: "0.82rem", color: "var(--primary)" }}>{c.id}</td>
                                            {/* Subject */}
                                            <td style={{ padding: "1.1rem 1.25rem" }}>
                                                <div style={{ fontWeight: "600", marginBottom: "0.2rem" }}>{c.subject}</div>
                                                <span style={{ fontSize: "0.7rem", padding: "0.15rem 0.55rem", borderRadius: "99px", background: "var(--border-subtle)", color: "var(--primary)", fontWeight: "700" }}>{c.category}</span>
                                            </td>
                                            {/* User */}
                                            <td style={{ padding: "1.1rem 1.25rem", fontSize: "0.875rem", color: "var(--text-muted)" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                    <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: "800", color: "var(--text-muted)", flexShrink: 0 }}>
                                                        {c.user.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                                                    </div>
                                                    {c.user}
                                                </div>
                                            </td>
                                            {/* Priority */}
                                            <td style={{ padding: "1.1rem 1.25rem" }}>
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", padding: "0.3rem 0.75rem", borderRadius: "99px", fontSize: "0.75rem", fontWeight: "700", background: `${pCfg.color}18`, color: pCfg.color, border: `1px solid ${pCfg.color}35` }}>
                                                    {c.priority === "Critical" && (
                                                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: pCfg.color, display: "inline-block", position: "relative" }}>
                                                            <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: pCfg.color, animation: "ping 1.2s ease-out infinite" }} />
                                                        </span>
                                                    )}
                                                    {c.priority}
                                                </span>
                                            </td>
                                            {/* Status */}
                                            <td style={{ padding: "1.1rem 1.25rem" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: sCfg.dot, flexShrink: 0 }} />
                                                    <span style={{ fontSize: "0.875rem", fontWeight: "600" }}>{c.status}</span>
                                                </div>
                                            </td>
                                            {/* Attachments */}
                                            <td style={{ padding: "1.1rem 1.25rem" }}>
                                                {c.attachments > 0 ? (
                                                    <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "#6366f1", background: "#6366f115", padding: "0.25rem 0.6rem", borderRadius: "99px", border: "1px solid #6366f130" }}>📎 {c.attachments}</span>
                                                ) : (
                                                    <span style={{ fontSize: "0.8rem", color: "var(--text-faint)" }}>—</span>
                                                )}
                                            </td>
                                            {/* Actions */}
                                            <td style={{ padding: "1.1rem 1.25rem" }} onClick={e => e.stopPropagation()}>
                                                {c.status === "Resolved" ? (
                                                    <span style={{ color: "#10b981", fontWeight: "700", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>✅ {t("admin_done")}</span>
                                                ) : c.status === "Rejected" ? (
                                                    <span style={{ color: "#ef4444", fontWeight: "700", fontSize: "0.82rem" }}>✕ Rejected</span>
                                                ) : (
                                                    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                                                        <button
                                                            className="btn btn-primary"
                                                            style={{ padding: "0.35rem 0.75rem", fontSize: "0.78rem", borderRadius: "0.5rem" }}
                                                            onClick={() => updateStatus(c.id, "Resolved")}
                                                        >✓ {t("admin_resolve")}</button>
                                                        <button
                                                            style={{ padding: "0.35rem 0.75rem", fontSize: "0.78rem", borderRadius: "0.5rem", background: "#ef444412", color: "#ef4444", border: "1px solid #ef444428", cursor: "pointer", fontWeight: "700", transition: "var(--transition)" }}
                                                            onClick={() => updateStatus(c.id, "Rejected")}
                                                            onMouseEnter={e => { e.currentTarget.style.background = "#ef444422"; }}
                                                            onMouseLeave={e => { e.currentTarget.style.background = "#ef444412"; }}
                                                        >✕ Reject</button>
                                                    </div>
                                                )}
                                            </td>
                                            {/* Chevron */}
                                            <td style={{ padding: "1.1rem 0.75rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                                                <span style={{ display: "inline-block", transition: "transform 0.3s ease", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
                                            </td>
                                        </tr>

                                        {/* ── Detail Panel ── */}
                                        {isExpanded && (
                                            <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                                <td colSpan={8} style={{ padding: 0 }}>
                                                    <div style={{
                                                        padding: "1.5rem 2rem",
                                                        background: "rgba(99,102,241,0.03)",
                                                        borderTop: `3px solid ${pCfg.color}`,
                                                        animation: "slideDown 0.25s ease",
                                                    }}>
                                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.5rem" }}>

                                                            {/* Col 1 — Description */}
                                                            <div>
                                                                <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>
                                                                    {CATEGORY_ICONS[c.category] || "📁"} Description
                                                                </div>
                                                                <p style={{ fontSize: "0.88rem", lineHeight: "1.65", color: "var(--text-main)", margin: 0 }}>{c.description}</p>
                                                            </div>

                                                            {/* Col 2 — Meta */}
                                                            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                                                <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.1rem" }}>📋 Details</div>
                                                                {[
                                                                    { icon: "📍", label: "Location", val: c.location },
                                                                    { icon: "📅", label: "Filed", val: c.date },
                                                                    { icon: "👤", label: "Citizen", val: c.user },
                                                                    { icon: "📂", label: "Category", val: c.category },
                                                                ].map(row => (
                                                                    <div key={row.label} style={{ display: "flex", gap: "0.5rem", fontSize: "0.83rem" }}>
                                                                        <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{row.icon}</span>
                                                                        <span style={{ color: "var(--text-muted)", fontWeight: "600", flexShrink: 0 }}>{row.label}:</span>
                                                                        <span style={{ color: "var(--text-main)" }}>{row.val}</span>
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            {/* Col 3 — AI Note + Actions */}
                                                            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                                                                <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>🤖 AI Triage Note</div>
                                                                <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: "0.75rem", padding: "0.75rem 1rem", fontSize: "0.82rem", lineHeight: "1.6", color: "var(--text-main)" }}>
                                                                    {c.aiNote}
                                                                </div>
                                                                {/* Detail actions */}
                                                                {c.status !== "Resolved" && c.status !== "Rejected" && (
                                                                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                                                                        <button
                                                                            className="btn btn-primary"
                                                                            style={{ flex: 1, padding: "0.55rem 0", fontSize: "0.82rem", borderRadius: "0.625rem" }}
                                                                            onClick={() => updateStatus(c.id, "Resolved")}
                                                                        >✓ Mark Resolved</button>
                                                                        <button
                                                                            style={{ flex: 1, padding: "0.55rem 0", fontSize: "0.82rem", borderRadius: "0.625rem", background: "#ef444412", color: "#ef4444", border: "1px solid #ef444428", cursor: "pointer", fontWeight: "700", transition: "var(--transition)" }}
                                                                            onClick={() => updateStatus(c.id, "Rejected")}
                                                                            onMouseEnter={e => { e.currentTarget.style.background = "#ef444422"; }}
                                                                            onMouseLeave={e => { e.currentTarget.style.background = "#ef444412"; }}
                                                                        >✕ Reject</button>
                                                                    </div>
                                                                )}
                                                                {(c.status === "Resolved" || c.status === "Rejected") && (
                                                                    <div style={{ fontSize: "0.82rem", fontWeight: "700", color: sCfg.color, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                                                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: sCfg.dot, display: "inline-block" }} />
                                                                        This complaint is {c.status.toLowerCase()}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Empty state */}
                    {loading && (
                        <div style={{ padding: "4rem 2rem", textAlign: "center" }}>
                            <div style={{ fontSize: "2rem", marginBottom: "0.75rem", animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</div>
                            <p style={{ fontWeight: "600", color: "var(--text-muted)" }}>Loading complaints from Supabase...</p>
                        </div>
                    )}
                    {!loading && filtered.length === 0 && (
                        <div style={{ padding: "4rem 2rem", textAlign: "center" }}>
                            <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>📭</div>
                            <p style={{ fontWeight: "600", color: "var(--text-muted)" }}>No complaints match &quot;{filter}&quot;</p>
                        </div>
                    )}
                </div>

            </main>
            <style>{`
                @keyframes ping {
                    0%        { transform: scale(1); opacity: 0.8; }
                    75%, 100% { transform: scale(2.2); opacity: 0; }
                }
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-8px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                tbody tr { transition: background 0.15s ease; }
                tbody tr:hover td { background: transparent; }
            `}</style>
        </ProtectedRoute>
    );
}
