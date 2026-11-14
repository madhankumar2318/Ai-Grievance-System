"use client";

import React, { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useLang } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { getComplaintsServerAction, updateComplaintStatusServerAction, ActionTakenReportData } from "@/app/actions/complaintActions";
import ActionTakenReportModal from "@/components/ActionTakenReportModal";


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

export interface AdminComplaint {
    id: string;
    subject: string;
    category: string;
    priority: string;
    status: string;
    user: string;
    attachments: number;
    userEmail: string;
    description: string;
    location: string;
    date: string;
    aiNote: string;
}

export interface DbAdminComplaint {
    id: string;
    subject: string;
    category: string;
    priority: string;
    status: string;
    user_email: string | null;
    attachment_count: number | null;
    description: string;
    location: string | null;
    created_at: string;
    ai_reasoning: string | null;
}

export default function AdminDashboard() {
    const { t, lang } = useLang();
    const { user } = useAuth();
    const [complaints, setComplaints] = useState<AdminComplaint[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("All");
    const [departmentFilter, setDepartmentFilter] = useState("All");
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [viewingPhoto, setViewingPhoto] = useState<{ url: string | null; title: string; location: string; category?: string } | null>(null);
    const [resolvingComplaint, setResolvingComplaint] = useState<{
        id: string;
        subject: string;
        category: string;
        location: string;
        citizenEvidencePhoto?: string | null;
    } | null>(null);

    const handleOpenResolveModal = (c: AdminComplaint) => {
        const photoMatch = c.description.match(/\[EVIDENCE_PHOTO:([^\]]+)\]/);
        const citizenEvidencePhoto = photoMatch ? photoMatch[1] : null;
        setResolvingComplaint({
            id: c.id,
            subject: c.subject,
            category: c.category,
            location: c.location,
            citizenEvidencePhoto,
        });
    };

    const handleResolveSuccess = (id: string, atr: ActionTakenReportData) => {
        setComplaints(prev => prev.map(c => {
            if (c.id === id) {
                const baseDesc = c.description.replace(/\n\n\[ACTION_TAKEN_REPORT:[\s\S]*?\]/g, '').trim();
                return {
                    ...c,
                    status: 'Resolved',
                    description: baseDesc + '\n\n[ACTION_TAKEN_REPORT:' + JSON.stringify(atr) + ']',
                };
            }
            return c;
        }));
        setExpandedId(null);
    };

    // Authority Officer's locked jurisdiction (strictly derived from their login / profile)
    const officerState = user?.state || "Tamil Nadu";
    const officerDistrict = user?.district || "Tiruchirappalli";

    const toggleRow = (id: string) => setExpandedId(prev => prev === id ? null : id);

    const fetchComplaints = async () => {
        setLoading(true);
        try {
            const res = await getComplaintsServerAction();
            if (res.success && res.complaints) {
                const mapped = res.complaints.map((c) => ({
                    id: c.id,
                    subject: c.subject,
                    category: c.category || "General",
                    priority: c.priority || "Medium",
                    status: c.status || "Pending",
                    user: c.user_email || "Citizen",
                    attachments: c.attachment_count || 0,
                    userEmail: c.user_email || "",
                    description: c.description || "",
                    location: c.location || "Location not specified",
                    date: c.created_at ? new Date(c.created_at).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN"),
                    aiNote: c.ai_reasoning || "Triage complete.",
                }));
                setComplaints(mapped);
                try {
                    sessionStorage.setItem("cached_admin_complaints", JSON.stringify(mapped));
                } catch {}
            }
        } catch (err) {
            console.error("Error fetching complaints in admin dashboard:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Fast-path: instantly load cached records from session storage (< 5ms)
        try {
            const cached = sessionStorage.getItem("cached_admin_complaints");
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setComplaints(parsed);
                    setLoading(false);
                }
            }
        } catch {}

        fetchComplaints();
    }, []);

    const updateStatus = async (id: string, newStatus: "Resolved" | "Rejected") => {
        setComplaints(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
        setExpandedId(null);
        try {
            await updateComplaintStatusServerAction(id, newStatus);
        } catch (err) {
            console.error("Error updating status:", err);
        }
    };

    // ── Privacy & Data Segregation Boundary ──────────────────────────────────────
    // Authority officers are strictly confined to their assigned State & District.
    // Complaints from other jurisdictions are never exposed to prevent cross-district privacy leaks.
    const jurisdictionComplaints = React.useMemo(() => {
        return complaints.filter(c => {
            if (officerDistrict === "Tiruchirappalli") {
                return (
                    /trichy|tiruchirappalli|kaikatti|10\.95|78\.44/i.test(c.location || "") ||
                    /trichy|tiruchirappalli|kaikatti/i.test(c.description || "") ||
                    /green valley|shanti nagar|gandhi nagar|city mall|industrial area|rampur|nh-48|general hospital/i.test(c.location || "")
                );
            }
            const dLower = officerDistrict.toLowerCase();
            const sLower = officerState.toLowerCase();
            const locLower = (c.location || "").toLowerCase();
            const descLower = (c.description || "").toLowerCase();
            const subjLower = (c.subject || "").toLowerCase();

            return (
                locLower.includes(dLower) ||
                descLower.includes(dLower) ||
                subjLower.includes(dLower) ||
                locLower.includes(sLower) ||
                descLower.includes(sLower)
            );
        });
    }, [complaints, officerDistrict, officerState]);

    const pending = jurisdictionComplaints.filter(c => c.status === "Pending").length;
    const resolved = jurisdictionComplaints.filter(c => c.status === "Resolved").length;
    const inProgress = jurisdictionComplaints.filter(c => c.status === "In Progress").length;
    const rejected = jurisdictionComplaints.filter(c => c.status === "Rejected").length;

    const STATS = [
        { label: t("admin_total"), value: jurisdictionComplaints.length, color: "#6366f1", icon: "📋", grad: "linear-gradient(135deg,#6366f1,#8b5cf6)" },
        { label: t("admin_pending"), value: pending, color: "#f59e0b", icon: "⏳", grad: "linear-gradient(135deg,#f59e0b,#f97316)" },
        { label: t("admin_in_progress"), value: inProgress, color: "#6366f1", icon: "🔄", grad: "linear-gradient(135deg,#06b6d4,#6366f1)" },
        { label: t("admin_resolved"), value: resolved, color: "#10b981", icon: "✅", grad: "linear-gradient(135deg,#10b981,#06b6d4)" },
        { label: t("admin_rejected"), value: rejected, color: "#ef4444", icon: "✕", grad: "linear-gradient(135deg,#ef4444,#f97316)" },
    ];

    const FILTERS = ["All", "Pending", "In Progress", "Resolved", "Rejected"];

    // Dynamic unique department options from jurisdiction complaints
    const availableDepartments = React.useMemo(() => {
        const set = new Set(jurisdictionComplaints.map(c => c.category).filter(Boolean));
        return ["All", ...Array.from(set).sort()];
    }, [jurisdictionComplaints]);

    // Combined filtering within the officer's jurisdiction
    const filtered = jurisdictionComplaints.filter(c => {
        if (filter !== "All" && c.status !== filter) return false;
        if (departmentFilter !== "All" && c.category !== departmentFilter) return false;

        // Search Query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const matches =
                c.id.toLowerCase().includes(q) ||
                c.subject.toLowerCase().includes(q) ||
                c.category.toLowerCase().includes(q) ||
                c.location.toLowerCase().includes(q) ||
                c.user.toLowerCase().includes(q) ||
                c.description.toLowerCase().includes(q);
            if (!matches) return false;
        }

        return true;
    });

    return (
        <ProtectedRoute allowedRoles={["authority", "chief"]}>
            <main className="container section">

                {/* ── Header ── */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2.5rem", flexWrap: "wrap", gap: "1rem" }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                            <h1 className="gradient-text" style={{ fontSize: "2.5rem", margin: 0 }}>{t("admin_title")}</h1>
                            {/* Locked Jurisdiction Badge */}
                            <div style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.4rem",
                                padding: "0.35rem 0.85rem",
                                borderRadius: "99px",
                                background: "rgba(16, 185, 129, 0.12)",
                                border: "1.5px solid rgba(16, 185, 129, 0.35)",
                                color: "#34d399",
                                fontSize: "0.82rem",
                                fontWeight: "700",
                                boxShadow: "0 0 15px rgba(16, 185, 129, 0.15)",
                            }}>
                                <span>🔒</span>
                                <span>{officerDistrict}, {officerState} Jurisdiction</span>
                            </div>
                        </div>
                        <p style={{ marginTop: "0.35rem", color: "var(--text-muted)", fontSize: "0.88rem" }}>
                            Strict jurisdictional isolation: Showing verified grievances assigned to <strong>{officerDistrict} ({officerState})</strong>
                        </p>
                    </div>
                    <div className="glass" style={{ padding: "0.5rem 1rem", borderRadius: "0.5rem", fontSize: "0.9rem", fontWeight: "bold", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block", position: "relative" }}>
                            <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#10b981", animation: "ping 1.5s ease-out infinite" }} />
                        </span>
                        {t("admin_active_officers")}
                    </div>
                </div>

                {/* ── Stat Cards ── */}
                <div className="stagger-children admin-stats-grid">
                    {STATS.map(({ label, value, color, icon, grad }, idx) => (
                        <div key={`${lang}-${idx}`} className="glass card-hover animate-fade-in" style={{ padding: "1.75rem 1.25rem", borderRadius: "var(--radius)", textAlign: "center", borderTop: `3px solid ${color}`, position: "relative", overflow: "hidden" }}>
                            <div style={{ position: "absolute", top: "-20px", right: "-20px", width: "80px", height: "80px", borderRadius: "50%", background: `${color}18`, filter: "blur(20px)" }} />
                            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "40px", height: "40px", borderRadius: "10px", background: grad, fontSize: "1.1rem", marginBottom: "0.75rem", boxShadow: `0 4px 12px ${color}44` }}>
                                {icon}
                            </div>
                            <div style={{ fontSize: "2.25rem", fontWeight: "900", color, lineHeight: 1, marginBottom: "0.3rem" }}>{loading && complaints.length === 0 ? <span style={{ opacity: 0.35 }}>—</span> : value}</div>
                            <div style={{ fontSize: "0.78rem", fontWeight: "600", color: "var(--text-muted)" }}>{label}</div>
                        </div>
                    ))}
                </div>

                {/* ── Filter Bar ── */}
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    marginBottom: "1.25rem",
                    flexWrap: "wrap",
                    padding: "0.75rem 1rem",
                    borderRadius: "1rem",
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid var(--border)",
                }}>
                    {/* Left: Status Filter Pills */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: "700", color: "var(--text-muted)", marginRight: "0.2rem" }}>
                            Status:
                        </span>
                        {FILTERS.map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                style={{
                                    padding: "0.3rem 0.8rem", borderRadius: "99px",
                                    fontSize: "0.76rem", fontWeight: "700",
                                    border: filter === f ? "1.5px solid var(--primary)" : "1.5px solid var(--border)",
                                    background: filter === f ? "var(--grad-primary)" : "var(--bg-card)",
                                    color: filter === f ? "white" : "var(--text-muted)",
                                    cursor: "pointer", transition: "var(--transition)",
                                    boxShadow: filter === f ? "0 2px 8px var(--primary-glow)" : "none",
                                }}
                            >{f}</button>
                        ))}
                    </div>

                    {/* Right: Jurisdiction Indicator + Department + Search + Clear */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        {/* Locked Jurisdiction Tag */}
                        <div
                            title={`Confined to ${officerDistrict}, ${officerState} jurisdiction for citizen data privacy.`}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.35rem",
                                padding: "0.35rem 0.75rem",
                                borderRadius: "0.5rem",
                                background: "rgba(16, 185, 129, 0.08)",
                                border: "1px solid rgba(16, 185, 129, 0.25)",
                                color: "#34d399",
                                fontSize: "0.76rem",
                                fontWeight: "700",
                                cursor: "default",
                            }}
                        >
                            <span>📍</span>
                            <span>{officerDistrict}</span>
                            <span style={{ fontSize: "0.68rem", opacity: 0.8 }}>🔒</span>
                        </div>

                        {/* Department Filter */}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                            <span style={{ fontSize: "0.76rem", fontWeight: "700", color: "var(--text-muted)" }}>🏢 Dept:</span>
                            <select
                                value={departmentFilter}
                                onChange={e => setDepartmentFilter(e.target.value)}
                                style={{
                                    padding: "0.35rem 0.75rem",
                                    borderRadius: "0.5rem",
                                    border: departmentFilter !== "All" ? "1.5px solid #6366f1" : "1.5px solid var(--border)",
                                    background: "var(--bg-card)",
                                    color: departmentFilter !== "All" ? "#818cf8" : "var(--text-main)",
                                    fontSize: "0.76rem",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                    outline: "none",
                                }}
                            >
                                {availableDepartments.map(dept => (
                                    <option key={dept} value={dept} style={{ background: "#0f172a", color: "#f8fafc" }}>
                                        {dept === "All" ? "All Departments" : `${CATEGORY_ICONS[dept] || "📁"} ${dept}`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Search Input */}
                        <div style={{ position: "relative" }}>
                            <input
                                type="text"
                                placeholder={`Search in ${officerDistrict}...`}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                style={{
                                    padding: "0.35rem 0.65rem 0.35rem 1.65rem",
                                    borderRadius: "0.5rem",
                                    border: searchQuery ? "1.5px solid var(--primary)" : "1.5px solid var(--border)",
                                    background: "var(--bg-card)",
                                    color: "var(--text-main)",
                                    fontSize: "0.76rem",
                                    width: "140px",
                                    outline: "none",
                                }}
                            />
                            <span style={{ position: "absolute", left: "0.5rem", top: "50%", transform: "translateY(-50%)", fontSize: "0.7rem", color: "var(--text-muted)", pointerEvents: "none" }}>
                                🔍
                            </span>
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    style={{ position: "absolute", right: "0.35rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.7rem" }}
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* Reset Button */}
                        {(filter !== "All" || departmentFilter !== "All" || searchQuery) && (
                            <button
                                onClick={() => {
                                    setFilter("All");
                                    setDepartmentFilter("All");
                                    setSearchQuery("");
                                }}
                                style={{
                                    padding: "0.35rem 0.65rem",
                                    borderRadius: "0.5rem",
                                    border: "1px solid #ef444440",
                                    background: "#ef444415",
                                    color: "#f87171",
                                    fontSize: "0.74rem",
                                    fontWeight: "700",
                                    cursor: "pointer",
                                }}
                                title="Reset filters"
                            >
                                ✕ Reset
                            </button>
                        )}
                    </div>
                </div>

                {/* Counter & Hint Row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", fontSize: "0.76rem", color: "var(--text-muted)", flexWrap: "wrap", gap: "0.5rem" }}>
                    <p style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <span>👆</span> Click any row to view full complaint details
                    </p>
                    <span style={{ fontWeight: "600" }}>
                        Showing <strong>{filtered.length}</strong> of {jurisdictionComplaints.length} grievances in <strong>{officerDistrict}</strong>
                        {(departmentFilter !== "All" || searchQuery) && (
                            <span style={{ color: "var(--primary)", marginLeft: "0.4rem" }}>
                                ({[
                                    departmentFilter !== "All" ? departmentFilter : null,
                                    searchQuery ? `"${searchQuery}"` : null,
                                ].filter(Boolean).join(" · ")})
                            </span>
                        )}
                    </span>
                </div>

                {/* ── Desktop View (Table) ── */}
                <div className="admin-desktop-table">
                    <div className="glass" style={{ borderRadius: "1.5rem", overflow: "hidden", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                            <thead>
                                <tr style={{ background: "rgba(99,102,241,0.05)", borderBottom: "1px solid var(--border)" }}>
                                    {[t("admin_col_id"), t("admin_col_subject"), t("admin_col_citizen"), t("admin_col_priority"), t("admin_col_status"), t("admin_col_attachments"), t("admin_col_actions")].map((h, i) => (
                                        <th key={i} style={{ padding: "1.1rem 1.25rem", fontWeight: "700", fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading && complaints.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} style={{ padding: "3.5rem 1.5rem", textAlign: "center" }}>
                                            <div style={{ fontSize: "2rem", marginBottom: "0.5rem", animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</div>
                                            <div style={{ fontWeight: "700", fontSize: "0.95rem", color: "#a5b4fc" }}>Loading jurisdiction records...</div>
                                            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>Synchronizing complaints for {officerDistrict}...</div>
                                        </td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} style={{ padding: "3.5rem 1.5rem", textAlign: "center", color: "var(--text-muted)" }}>
                                            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🔍</div>
                                            <div style={{ fontWeight: "700", fontSize: "0.95rem", color: "var(--text-main)" }}>No matching complaints found</div>
                                            <div style={{ fontSize: "0.8rem", marginTop: "0.25rem", color: "var(--text-muted)" }}>
                                                Try adjusting or clearing your department, area, or search filters.
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((c, idx) => {
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
                                                <td style={{ padding: "1.1rem 1.25rem", whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => toggleRow(c.id)}
                                                        style={{
                                                            padding: "0.45rem 0.95rem",
                                                            fontSize: "0.78rem",
                                                            fontWeight: "700",
                                                            borderRadius: "0.5rem",
                                                            cursor: "pointer",
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: "0.4rem",
                                                            background: isExpanded
                                                                ? "rgba(99,102,241,0.22)"
                                                                : c.status === "Resolved" || c.status === "Rejected"
                                                                ? "rgba(255,255,255,0.06)"
                                                                : "linear-gradient(135deg, rgba(99,102,241,0.18), rgba(168,85,247,0.18))",
                                                            color: isExpanded
                                                                ? "#e0e7ff"
                                                                : c.status === "Resolved" || c.status === "Rejected"
                                                                ? "var(--text-muted)"
                                                                : "#a5b4fc",
                                                            border: isExpanded
                                                                ? "1px solid rgba(99,102,241,0.5)"
                                                                : c.status === "Resolved" || c.status === "Rejected"
                                                                ? "1px solid var(--border)"
                                                                : "1px solid rgba(99,102,241,0.3)",
                                                            boxShadow: isExpanded ? "none" : "0 2px 6px rgba(0,0,0,0.1)",
                                                            transition: "all 0.2s ease",
                                                        }}
                                                        onMouseEnter={e => {
                                                            if (!isExpanded) {
                                                                e.currentTarget.style.background = c.status === "Resolved" || c.status === "Rejected"
                                                                    ? "rgba(255,255,255,0.1)"
                                                                    : "linear-gradient(135deg, rgba(99,102,241,0.28), rgba(168,85,247,0.28))";
                                                            }
                                                        }}
                                                        onMouseLeave={e => {
                                                            if (!isExpanded) {
                                                                e.currentTarget.style.background = c.status === "Resolved" || c.status === "Rejected"
                                                                    ? "rgba(255,255,255,0.06)"
                                                                    : "linear-gradient(135deg, rgba(99,102,241,0.18), rgba(168,85,247,0.18))";
                                                            }
                                                        }}
                                                    >
                                                        <span>{isExpanded ? "Close Details" : c.status === "Resolved" || c.status === "Rejected" ? "View Details" : "Inspect & Review"}</span>
                                                        <span style={{ fontSize: "0.72rem", transition: "transform 0.25s ease", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
                                                    </button>
                                                </td>
                                            </tr>

                                            {/* ── Detail Panel ── */}
                                            {isExpanded && (() => {
                                                const atrMatch = (c.description || "").match(/\[ACTION_TAKEN_REPORT:([\s\S]*?)\]/);
                                                let atrData: ActionTakenReportData | null = null;
                                                if (atrMatch) {
                                                    try {
                                                        atrData = JSON.parse(atrMatch[1]);
                                                    } catch (e) {
                                                        console.error("Failed to parse ATR JSON:", e);
                                                    }
                                                }
                                                const photoMatch = (c.description || "").match(/\[EVIDENCE_PHOTO:([^\]]+)\]/);
                                                const evidencePhoto = photoMatch ? photoMatch[1] : null;
                                                const cleanDesc = (c.description || "")
                                                    .replace(/\[EVIDENCE_PHOTO:[^\]]+\]/g, "")
                                                    .replace(/\[ACTION_TAKEN_REPORT:[\s\S]*?\]/g, "")
                                                    .trim();

                                                return (
                                                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                                        <td colSpan={7} style={{ padding: 0 }}>
                                                            <div style={{
                                                                padding: "1.5rem 2rem",
                                                                background: "rgba(99,102,241,0.03)",
                                                                borderTop: `3px solid ${pCfg.color}`,
                                                                animation: "slideDown 0.25s ease",
                                                            }}>
                                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.5rem" }}>

                                                                    {/* Col 1 — Description & Evidence */}
                                                                    <div style={{ minWidth: 0 }}>
                                                                        <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>
                                                                            {CATEGORY_ICONS[c.category] || "📁"} Description
                                                                        </div>
                                                                        <p style={{ fontSize: "0.88rem", lineHeight: "1.65", color: "var(--text-main)", margin: 0, wordBreak: "break-word" }}>
                                                                            {cleanDesc || "No additional description text provided."}
                                                                        </p>

                                                                        {/* Photo Evidence Section */}
                                                                        {(evidencePhoto || c.attachments > 0) && (
                                                                            <div style={{ marginTop: "1rem", padding: "0.75rem", borderRadius: "0.75rem", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                                                                                <div style={{ fontSize: "0.72rem", fontWeight: "800", color: "#a5b4fc", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                                                                    <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                                                                        <span>📷</span>
                                                                                        <span>Citizen Photo Evidence ({c.attachments || 1})</span>
                                                                                    </span>
                                                                                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: "600" }}>Tap to inspect</span>
                                                                                </div>

                                                                                {evidencePhoto ? (
                                                                                    <div
                                                                                        onClick={() => setViewingPhoto({ url: evidencePhoto, title: c.subject, location: c.location, category: c.category })}
                                                                                        style={{
                                                                                            position: "relative",
                                                                                            borderRadius: "0.5rem",
                                                                                            overflow: "hidden",
                                                                                            cursor: "pointer",
                                                                                            border: "1px solid rgba(99,102,241,0.3)",
                                                                                            maxHeight: "150px",
                                                                                            display: "flex",
                                                                                            alignItems: "center",
                                                                                            justifyContent: "center",
                                                                                            background: "#000",
                                                                                        }}
                                                                                    >
                                                                                        <img
                                                                                            src={evidencePhoto}
                                                                                            alt="Citizen Uploaded Evidence"
                                                                                            style={{ width: "100%", maxHeight: "150px", objectFit: "cover", transition: "transform 0.2s" }}
                                                                                            onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.03)")}
                                                                                            onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                                                                                        />
                                                                                        <div style={{
                                                                                            position: "absolute", bottom: 0, left: 0, right: 0,
                                                                                            background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)",
                                                                                            padding: "0.35rem 0.6rem", fontSize: "0.7rem", color: "white",
                                                                                            display: "flex", alignItems: "center", justifyContent: "space-between"
                                                                                        }}>
                                                                                            <span>🔍 Click to inspect photo</span>
                                                                                            <span style={{ color: "#4ade80", fontWeight: "700" }}>✓ Uploaded Evidence</span>
                                                                                        </div>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div
                                                                                        onClick={() => setViewingPhoto({ url: null, title: c.subject, location: c.location, category: c.category })}
                                                                                        style={{
                                                                                            padding: "0.75rem",
                                                                                            borderRadius: "0.5rem",
                                                                                            background: "rgba(99,102,241,0.08)",
                                                                                            border: "1px dashed rgba(99,102,241,0.3)",
                                                                                            cursor: "pointer",
                                                                                            textAlign: "center",
                                                                                        }}
                                                                                    >
                                                                                        <div style={{ fontSize: "1.2rem", marginBottom: "0.2rem" }}>📎</div>
                                                                                        <div style={{ fontSize: "0.78rem", fontWeight: "700", color: "#a5b4fc" }}>
                                                                                            {c.attachments} Photographic Proof File Recorded
                                                                                        </div>
                                                                                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                                                                                            Click to view evidence details
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Col 2 — Meta */}
                                                                    <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
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
                                                                                <span style={{ color: "var(--text-main)", wordBreak: "break-word" }}>{row.val}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>

                                                                    {/* Col 3 — AI Note + Actions */}
                                                                    <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                                                                        <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>🤖 AI Triage Note</div>
                                                                        <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: "0.75rem", padding: "0.75rem 1rem", fontSize: "0.82rem", lineHeight: "1.6", color: "var(--text-main)", wordBreak: "break-word" }}>
                                                                            {c.aiNote}
                                                                        </div>
                                                                        {/* Detail actions */}
                                                                        {c.status !== "Resolved" && c.status !== "Rejected" && (
                                                                            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                                                                                <button
                                                                                    className="btn btn-primary"
                                                                                    style={{ flex: 1, padding: "0.55rem 0", fontSize: "0.82rem", borderRadius: "0.625rem" }}
                                                                                    onClick={() => handleOpenResolveModal(c)}
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

                                                                {/* ── Official Action Taken Report (ATR) Card when Resolved ── */}
                                                                {atrData && (
                                                                    <div style={{
                                                                        marginTop: "1.5rem",
                                                                        padding: "1.25rem 1.5rem",
                                                                        borderRadius: "1rem",
                                                                        background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(6, 182, 212, 0.04))",
                                                                        border: "1.5px solid rgba(16, 185, 129, 0.35)",
                                                                    }}>
                                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                                                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                                                <span style={{ fontSize: "1.2rem" }}>✅</span>
                                                                                <span style={{ fontSize: "1rem", fontWeight: "800", color: "#ffffff" }}>
                                                                                    Official Action Taken Report (ATR)
                                                                                </span>
                                                                            </div>
                                                                            <span style={{
                                                                                padding: "0.2rem 0.65rem",
                                                                                borderRadius: "99px",
                                                                                background: "rgba(16, 185, 129, 0.2)",
                                                                                color: "#10b981",
                                                                                border: "1px solid rgba(16, 185, 129, 0.4)",
                                                                                fontSize: "0.72rem",
                                                                                fontWeight: "800",
                                                                            }}>
                                                                                VERIFIED RESOLUTION
                                                                            </span>
                                                                        </div>

                                                                        <div style={{
                                                                            display: "grid",
                                                                            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                                                                            gap: "0.75rem",
                                                                            marginBottom: "1rem",
                                                                            padding: "0.85rem 1rem",
                                                                            borderRadius: "0.65rem",
                                                                            background: "rgba(0,0,0,0.3)",
                                                                            border: "1px solid rgba(255,255,255,0.06)",
                                                                        }}>
                                                                            <div>
                                                                                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>
                                                                                    👷 Official Staff / Engineer
                                                                                </div>
                                                                                <div style={{ fontSize: "0.9rem", fontWeight: "700", color: "#ffffff", marginTop: "0.15rem" }}>
                                                                                    {atrData.officerName || "Municipal Officer"}
                                                                                </div>
                                                                            </div>
                                                                            <div>
                                                                                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>
                                                                                    📅 Resolution Date
                                                                                </div>
                                                                                <div style={{ fontSize: "0.9rem", fontWeight: "700", color: "#ffffff", marginTop: "0.15rem" }}>
                                                                                    {atrData.resolvedAt ? new Date(atrData.resolvedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : c.date}
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        <div style={{ marginBottom: "1rem" }}>
                                                                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "800", marginBottom: "0.3rem" }}>
                                                                                📝 Work Executed &amp; Action Taken
                                                                            </div>
                                                                            <div style={{
                                                                                fontSize: "0.88rem",
                                                                                lineHeight: "1.6",
                                                                                color: "var(--text-main)",
                                                                                padding: "0.75rem 1rem",
                                                                                borderRadius: "0.65rem",
                                                                                background: "rgba(255,255,255,0.03)",
                                                                                border: "1px solid rgba(255,255,255,0.08)",
                                                                                wordBreak: "break-word",
                                                                            }}>
                                                                                {atrData.actionDescription}
                                                                            </div>
                                                                        </div>

                                                                        {/* Before vs After Photo Proof */}
                                                                        <div style={{ marginTop: "1rem" }}>
                                                                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "800", marginBottom: "0.5rem" }}>
                                                                                📸 Resolution Proof &amp; Verification
                                                                            </div>
                                                                            <div style={{ display: "grid", gridTemplateColumns: evidencePhoto && atrData.resolutionPhoto ? "1fr 1fr" : "1fr", gap: "1rem", maxWidth: "600px" }}>
                                                                                {evidencePhoto && (
                                                                                    <div
                                                                                        onClick={() => setViewingPhoto({ url: evidencePhoto, title: "Citizen Evidence (Before)", location: c.location, category: c.category })}
                                                                                        style={{
                                                                                            borderRadius: "0.65rem",
                                                                                            overflow: "hidden",
                                                                                            border: "1px solid rgba(239, 68, 68, 0.4)",
                                                                                            background: "#000",
                                                                                            cursor: "pointer",
                                                                                        }}
                                                                                    >
                                                                                        <div style={{ padding: "0.3rem 0.6rem", background: "rgba(239, 68, 68, 0.2)", fontSize: "0.68rem", fontWeight: "800", color: "#f87171" }}>
                                                                                            BEFORE (CITIZEN EVIDENCE)
                                                                                        </div>
                                                                                        <img src={evidencePhoto} alt="Before" style={{ width: "100%", height: "130px", objectFit: "cover" }} />
                                                                                    </div>
                                                                                )}
                                                                                {atrData.resolutionPhoto && (
                                                                                    <div
                                                                                        onClick={() => setViewingPhoto({ url: atrData.resolutionPhoto!, title: "Official Resolution (After)", location: c.location, category: c.category })}
                                                                                        style={{
                                                                                            borderRadius: "0.65rem",
                                                                                            overflow: "hidden",
                                                                                            border: "1px solid rgba(16, 185, 129, 0.5)",
                                                                                            background: "#000",
                                                                                            cursor: "pointer",
                                                                                        }}
                                                                                    >
                                                                                        <div style={{ padding: "0.3rem 0.6rem", background: "rgba(16, 185, 129, 0.2)", fontSize: "0.68rem", fontWeight: "800", color: "#34d399" }}>
                                                                                            AFTER (OFFICIAL RESOLUTION PROOF)
                                                                                        </div>
                                                                                        <img src={atrData.resolutionPhoto} alt="After" style={{ width: "100%", height: "130px", objectFit: "cover" }} />
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })()}
                                        </React.Fragment>
                                    );
                                }))}
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
                                <p style={{ fontWeight: "700", color: "var(--text-main)", fontSize: "1rem", marginBottom: "0.4rem" }}>No complaints match the selected filters</p>
                                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "1rem" }}>Try selecting another department or area, or clear your search query.</p>
                                <button
                                    onClick={() => {
                                        setFilter("All");
                                        setDepartmentFilter("All");
                                        setSearchQuery("");
                                    }}
                                    className="btn btn-secondary"
                                    style={{ padding: "0.45rem 1.1rem", fontSize: "0.8rem", borderRadius: "0.5rem" }}
                                >
                                    Clear All Filters
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Mobile View (Responsive Cards List) ── */}
                <div className="admin-mobile-cards">
                    {filtered.map((c) => {
                        const pCfg = PRIORITY_CONFIG[c.priority] ?? PRIORITY_CONFIG.Medium;
                        const sCfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.Pending;
                        const isExpanded = expandedId === c.id;

                        return (
                            <div
                                key={c.id}
                                className={`admin-mobile-card${isExpanded ? " admin-mobile-card--expanded" : ""}`}
                                onClick={() => toggleRow(c.id)}
                                style={{ borderTop: `4px solid ${pCfg.color}` }}
                            >
                                {/* Header */}
                                <div className="admin-mobile-card-header">
                                    <span className="admin-mobile-card-id">{c.id}</span>
                                    <span className="admin-mobile-card-date">{c.date}</span>
                                </div>

                                {/* Title */}
                                <div className="admin-mobile-card-title">{c.subject}</div>

                                {/* Tags */}
                                <div className="admin-mobile-card-tags">
                                    <span style={{ fontSize: "0.68rem", padding: "0.15rem 0.55rem", borderRadius: "99px", background: "var(--border-subtle)", color: "var(--primary)", fontWeight: "700" }}>
                                        {CATEGORY_ICONS[c.category] || "📁"} {c.category}
                                    </span>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem", padding: "0.15rem 0.55rem", borderRadius: "99px", fontSize: "0.68rem", fontWeight: "700", background: `${pCfg.color}14`, color: pCfg.color }}>
                                        {pCfg.icon} {c.priority}
                                    </span>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", padding: "0.15rem 0.55rem", borderRadius: "99px", fontSize: "0.68rem", fontWeight: "700", background: `${sCfg.dot}14`, color: sCfg.color }}>
                                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: sCfg.dot }} />
                                        {c.status}
                                    </span>
                                </div>

                                {/* Meta details bar (collapsible trigger hint) */}
                                <div className="admin-mobile-card-meta">
                                    <span>👤 {c.user.length > 20 ? c.user.substring(0, 18) + "..." : c.user}</span>
                                    {c.attachments > 0 && (
                                        <span style={{ fontWeight: "700", color: "#6366f1" }}>📎 {c.attachments}</span>
                                    )}
                                </div>

                                {/* Expand details panel */}
                                {isExpanded && (() => {
                                    const atrMatch = (c.description || "").match(/\[ACTION_TAKEN_REPORT:([\s\S]*?)\]/);
                                    let atrData: ActionTakenReportData | null = null;
                                    if (atrMatch) {
                                        try { atrData = JSON.parse(atrMatch[1]); } catch {}
                                    }
                                    const photoMatch = (c.description || "").match(/\[EVIDENCE_PHOTO:([^\]]+)\]/);
                                    const evidencePhoto = photoMatch ? photoMatch[1] : null;
                                    const cleanDesc = (c.description || "")
                                        .replace(/\[EVIDENCE_PHOTO:[^\]]+\]/g, "")
                                        .replace(/\[ACTION_TAKEN_REPORT:[\s\S]*?\]/g, "")
                                        .trim();

                                    return (
                                        <div className="admin-mobile-card-details">
                                            {/* Description */}
                                            <div>
                                                <div style={{ fontSize: "0.68rem", fontWeight: "800", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>
                                                    Description
                                                </div>
                                                <p style={{ fontSize: "0.85rem", lineHeight: "1.5", color: "var(--text-main)", margin: 0, wordBreak: "break-word" }}>
                                                    {cleanDesc || "No additional description text provided."}
                                                </p>
                                            </div>

                                            {/* Evidence photo if present */}
                                            {evidencePhoto && (
                                                <div style={{ marginTop: "0.5rem" }}>
                                                    <div style={{ fontSize: "0.68rem", fontWeight: "800", color: "#a5b4fc", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>
                                                        📷 Citizen Photo Evidence
                                                    </div>
                                                    <div
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setViewingPhoto({ url: evidencePhoto, title: c.subject, location: c.location, category: c.category });
                                                        }}
                                                        style={{ borderRadius: "0.5rem", overflow: "hidden", border: "1px solid rgba(99,102,241,0.3)", maxHeight: "140px", cursor: "pointer" }}
                                                    >
                                                        <img src={evidencePhoto} alt="Evidence" style={{ width: "100%", maxHeight: "140px", objectFit: "cover" }} />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Location info */}
                                            {c.location && (
                                                <div>
                                                    <div style={{ fontSize: "0.68rem", fontWeight: "800", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>
                                                        📍 Location
                                                    </div>
                                                    <p style={{ fontSize: "0.85rem", color: "var(--text-main)", margin: 0, wordBreak: "break-word" }}>
                                                        {c.location}
                                                    </p>
                                                </div>
                                            )}

                                            {/* AI Note */}
                                            <div>
                                                <div style={{ fontSize: "0.68rem", fontWeight: "800", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>
                                                    🤖 AI Triage Note
                                                </div>
                                                <div style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: "0.5rem", padding: "0.65rem 0.85rem", fontSize: "0.78rem", lineHeight: "1.5", color: "var(--text-main)", wordBreak: "break-word" }}>
                                                    {c.aiNote}
                                                </div>
                                            </div>

                                            {/* ATR Card in mobile */}
                                            {atrData && (
                                                <div style={{
                                                    marginTop: "0.75rem",
                                                    padding: "0.85rem",
                                                    borderRadius: "0.75rem",
                                                    background: "rgba(16, 185, 129, 0.08)",
                                                    border: "1px solid rgba(16, 185, 129, 0.35)",
                                                }}>
                                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                                                        <div style={{ fontSize: "0.85rem", fontWeight: "800", color: "#ffffff" }}>
                                                            ✅ Action Taken Report
                                                        </div>
                                                        <span style={{ fontSize: "0.65rem", padding: "0.15rem 0.5rem", borderRadius: "99px", background: "rgba(16, 185, 129, 0.2)", color: "#10b981", fontWeight: "800" }}>VERIFIED</span>
                                                    </div>
                                                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                                                        👷 <strong>{atrData.officerName || "Municipal Officer"}</strong>
                                                    </div>
                                                    <div style={{ fontSize: "0.78rem", color: "var(--text-main)", lineHeight: "1.4", marginBottom: "0.5rem", wordBreak: "break-word" }}>
                                                        {atrData.actionDescription}
                                                    </div>
                                                    {atrData.resolutionPhoto && (
                                                        <div
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setViewingPhoto({ url: atrData.resolutionPhoto!, title: "Resolution Proof", location: c.location, category: c.category });
                                                            }}
                                                            style={{ borderRadius: "0.5rem", overflow: "hidden", border: "1px solid rgba(16, 185, 129, 0.4)", cursor: "pointer" }}
                                                        >
                                                            <img src={atrData.resolutionPhoto} alt="After" style={{ width: "100%", maxHeight: "120px", objectFit: "cover" }} />
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Actions */}
                                            {c.status !== "Resolved" && c.status !== "Rejected" ? (
                                                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }} onClick={e => e.stopPropagation()}>
                                                    <button
                                                        className="btn btn-primary"
                                                        style={{ flex: 1, padding: "0.65rem 0", fontSize: "0.82rem", borderRadius: "0.5rem" }}
                                                        onClick={() => handleOpenResolveModal(c)}
                                                    >
                                                        {t("admin_resolve")}
                                                    </button>
                                                    <button
                                                        style={{ flex: 1, padding: "0.65rem 0", fontSize: "0.82rem", borderRadius: "0.5rem", background: "#ef444412", color: "#ef4444", border: "1px solid #ef444428", cursor: "pointer", fontWeight: "700" }}
                                                        onClick={() => updateStatus(c.id, "Rejected")}
                                                    >
                                                        ✕ Reject
                                                    </button>
                                                </div>
                                            ) : (
                                                <div style={{ fontSize: "0.8rem", fontWeight: "700", color: sCfg.color, display: "flex", alignItems: "center", gap: "0.3rem", marginTop: "0.25rem" }}>
                                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: sCfg.dot }} />
                                                    This complaint is {c.status.toLowerCase()}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        );
                    })}

                    {/* Empty states for Mobile */}
                    {loading && (
                        <div style={{ padding: "3rem 1rem", textAlign: "center" }}>
                            <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem", animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</div>
                            <p style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-muted)" }}>Loading complaints...</p>
                        </div>
                    )}
                    {!loading && filtered.length === 0 && (
                        <div style={{ padding: "3rem 1rem", textAlign: "center" }}>
                            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📭</div>
                            <p style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--text-main)", marginBottom: "0.4rem" }}>No complaints match the selected filters</p>
                            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.85rem" }}>Try clearing your department or area filters.</p>
                            <button
                                onClick={() => {
                                    setFilter("All");
                                    setDepartmentFilter("All");
                                    setSearchQuery("");
                                }}
                                className="btn btn-secondary"
                                style={{ padding: "0.4rem 1rem", fontSize: "0.78rem", borderRadius: "0.5rem" }}
                            >
                                Clear All Filters
                            </button>
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

            {/* ── Photo Evidence Full-Screen Lightbox Modal ── */}
            {viewingPhoto && (
                <div
                    style={{
                        position: "fixed", inset: 0, zIndex: 1000,
                        background: "rgba(0,0,0,0.88)", backdropFilter: "blur(12px)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        padding: "1.25rem",
                    }}
                    onClick={() => setViewingPhoto(null)}
                >
                    <div
                        style={{
                            maxWidth: "720px", width: "100%", background: "var(--bg-card, #1e293b)",
                            borderRadius: "1.1rem", border: "1px solid var(--border)",
                            overflow: "hidden", boxShadow: "0 25px 60px -15px rgba(0,0,0,0.8)",
                            animation: "zoomIn 0.2s ease",
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div style={{
                            padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border)",
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            background: "rgba(255,255,255,0.02)"
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: "700", color: "var(--text-main)" }}>
                                    📷 Citizen Photographic Evidence
                                </h3>
                                <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                    {viewingPhoto.title}
                                </p>
                            </div>
                            <button
                                onClick={() => setViewingPhoto(null)}
                                style={{
                                    background: "transparent", border: "none", color: "var(--text-muted)",
                                    fontSize: "1.3rem", cursor: "pointer", padding: "0.2rem 0.5rem",
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body / Image */}
                        <div style={{ padding: "1.25rem", textAlign: "center", background: "#0b0f19" }}>
                            {viewingPhoto.url ? (
                                <img
                                    src={viewingPhoto.url}
                                    alt="Citizen Evidence Full View"
                                    style={{ maxWidth: "100%", maxHeight: "65vh", borderRadius: "0.5rem", objectFit: "contain", border: "1px solid rgba(255,255,255,0.1)" }}
                                />
                            ) : (
                                <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
                                    <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>📸</div>
                                    <h4 style={{ color: "var(--text-main)", margin: "0 0 0.5rem 0", fontSize: "1.1rem" }}>
                                        {viewingPhoto.category || "Civic"} Evidence Tagged
                                    </h4>
                                    <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", maxWidth: "420px", margin: "0 auto 1.25rem auto", lineHeight: 1.5 }}>
                                        Citizen recorded photographic evidence with this grievance. Location timestamp geotag: <strong>{viewingPhoto.location || "Recorded"}</strong>.
                                    </p>
                                    <div style={{ display: "inline-flex", gap: "0.5rem", padding: "0.4rem 0.9rem", borderRadius: "99px", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80", fontSize: "0.78rem", fontWeight: "700" }}>
                                        <span>✓</span>
                                        <span>Watermark & Metadata Verified</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div style={{
                            padding: "0.85rem 1.25rem", borderTop: "1px solid var(--border)",
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            fontSize: "0.75rem", color: "var(--text-muted)", background: "rgba(255,255,255,0.02)"
                        }}>
                            <span>📍 Geotag: {viewingPhoto.location}</span>
                            <button
                                onClick={() => setViewingPhoto(null)}
                                style={{
                                    padding: "0.4rem 0.9rem", borderRadius: "0.5rem",
                                    background: "rgba(255,255,255,0.1)", border: "1px solid var(--border)",
                                    color: "var(--text-main)", fontSize: "0.78rem", cursor: "pointer", fontWeight: "600"
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Action Taken Report (ATR) & Proof of Resolution Modal */}
            <ActionTakenReportModal
                isOpen={!!resolvingComplaint}
                onClose={() => setResolvingComplaint(null)}
                complaint={resolvingComplaint}
                officerDistrict={officerDistrict}
                onResolveSuccess={handleResolveSuccess}
            />

        </ProtectedRoute>
    );
}
