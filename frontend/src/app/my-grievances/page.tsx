"use client";

import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Link from "next/link";
import { useState, useEffect } from "react";
import { getUserComplaintsServerAction } from "@/app/actions/complaintActions";

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
    return (
        <div className="glass" style={{ padding: "1.25rem", borderRadius: "var(--radius)", textAlign: "center", border: `1px solid ${color}25` }}>
            <div style={{ fontSize: "1.75rem", marginBottom: "0.4rem" }}>{icon}</div>
            <div style={{ fontSize: "1.5rem", fontWeight: "800", color }}>{value}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: "600", marginTop: "0.2rem" }}>{label}</div>
        </div>
    );
}

export default function MyGrievancesPage() {
    const { user } = useAuth();
    const { lang, t } = useLang();

    const [complaints, setComplaints] = useState<{ id: string; subject: string; status: string; date: string }[]>([]);
    const [loadingComplaints, setLoadingComplaints] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>("All");

    useEffect(() => {
        if (!user?.email) return;

        const cacheKey = `gs_profile_complaints_${user.email.toLowerCase()}`;
        let hasCache = false;
        try {
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed)) {
                    setComplaints(parsed);
                    hasCache = true;
                }
            }
        } catch {}

        if (!hasCache) setLoadingComplaints(true);
        getUserComplaintsServerAction().then(res => {
            if (res.success && res.complaints) {
                const mapped = res.complaints.map((c: any) => ({
                    id: c.id,
                    subject: c.subject,
                    status: c.status || "Pending",
                    date: c.created_at
                        ? new Date(c.created_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                          })
                        : new Date().toLocaleDateString("en-IN"),
                }));
                setComplaints(mapped);
                try {
                    sessionStorage.setItem(cacheKey, JSON.stringify(mapped));
                } catch {}
            }
            setLoadingComplaints(false);
        }).catch(() => setLoadingComplaints(false));
    }, [user?.email]);

    if (!user) return null;

    const resolved = complaints.filter(c => c.status === "Resolved").length;
    const pending = complaints.filter(c => c.status === "Pending").length;
    const inProgress = complaints.filter(c => c.status === "In Progress").length;

    const filteredComplaints = statusFilter === "All"
        ? complaints
        : complaints.filter(c => c.status === statusFilter);

    const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
        Resolved: { bg: "#10b98118", color: "#10b981" },
        Pending: { bg: "#f59e0b18", color: "#f59e0b" },
        "In Progress": { bg: "#6366f118", color: "#6366f1" },
        Rejected: { bg: "#ef444418", color: "#ef4444" },
    };

    return (
        <ProtectedRoute>
            <main style={{ minHeight: "100vh", padding: "2rem 1rem" }}>
                <div className="container" style={{ maxWidth: "780px", margin: "0 auto" }}>

                    {/* Top Row: Back button + New Complaint Action Button */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                        <Link
                            href="/"
                            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.875rem", color: "var(--text-muted)", textDecoration: "none", fontWeight: "600" }}
                        >
                            {t("profile_back_citizen")}
                        </Link>

                        <Link
                            href="/"
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.4rem",
                                padding: "0.5rem 1.1rem",
                                borderRadius: "0.6rem",
                                fontSize: "0.85rem",
                                fontWeight: "700",
                                background: "linear-gradient(135deg, #ec4899, #f43f5e)",
                                color: "white",
                                textDecoration: "none",
                                boxShadow: "0 4px 12px rgba(236,72,153,0.3)",
                                transition: "all 0.2s ease",
                            }}
                        >
                            <span>{t("btn_new_complaint")}</span>
                        </Link>
                    </div>

                    {/* Dedicated Page Header: Standalone Grievance Redressal Dashboard */}
                    <div style={{ marginBottom: "1.5rem" }}>
                        <h1 style={{ fontWeight: "800", fontSize: "1.6rem", margin: "0 0 0.35rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span>📋</span>
                            <span>{t("tab_grievances")}</span>
                        </h1>
                        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>
                            {lang === "ta" ? "உங்கள் புகார்களின் நேரலை நிலை மற்றும் தீர்வு வரலாற்றைக் கண்காணிக்கவும்." : "Track the real-time status and redressal history of all your filed grievances."}
                        </p>
                    </div>

                    {/* Stat Cards */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
                        <StatCard label={t("profile_total_filed")} value={loadingComplaints ? "—" : complaints.length} icon="📋" color="#6366f1" />
                        <StatCard label={t("profile_resolved")} value={loadingComplaints ? "—" : resolved} icon="✅" color="#10b981" />
                        <StatCard label={t("profile_pending")} value={loadingComplaints ? "—" : pending} icon="⏳" color="#f59e0b" />
                    </div>

                    {/* Status Filter Buttons */}
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        marginBottom: "1rem",
                        flexWrap: "wrap",
                    }}>
                        {[
                            { key: "All", label: t("filter_all"), count: complaints.length, icon: "📋" },
                            { key: "Pending", label: t("admin_pending"), count: pending, icon: "⏳" },
                            { key: "In Progress", label: t("admin_in_progress"), count: inProgress, icon: "⚙️" },
                            { key: "Resolved", label: t("admin_resolved"), count: resolved, icon: "✅" },
                        ].map(filter => {
                            const isSelected = statusFilter === filter.key;
                            return (
                                <button
                                    key={filter.key}
                                    type="button"
                                    onClick={() => setStatusFilter(filter.key)}
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "0.4rem",
                                        padding: "0.4rem 0.85rem",
                                        borderRadius: "99px",
                                        fontSize: "0.78rem",
                                        fontWeight: "700",
                                        cursor: "pointer",
                                        transition: "all 0.2s ease",
                                        border: isSelected ? "1px solid var(--primary)" : "1px solid var(--border)",
                                        background: isSelected ? "var(--primary)" : "var(--bg-card)",
                                        color: isSelected ? "#ffffff" : "var(--text-muted)",
                                    }}
                                >
                                    <span>{filter.icon}</span>
                                    <span>{filter.label}</span>
                                    <span style={{
                                        padding: "0.1rem 0.4rem",
                                        borderRadius: "99px",
                                        fontSize: "0.68rem",
                                        background: isSelected ? "rgba(255,255,255,0.25)" : "var(--bg-main)",
                                        color: isSelected ? "#ffffff" : "var(--text-muted)",
                                        fontWeight: "800",
                                    }}>
                                        {filter.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Complaints List Container */}
                    <div className="glass animate-slide-up" style={{ borderRadius: "var(--radius-lg)", padding: "1.5rem", boxShadow: "var(--shadow-lg)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                            <h2 style={{ fontWeight: "800", fontSize: "1rem", margin: 0 }}>
                                {t("profile_recent_complaints")}
                            </h2>
                            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: "600" }}>
                                {filteredComplaints.length} {lang === "ta" ? "புகார்கள்" : "grievances"}
                            </span>
                        </div>

                        {loadingComplaints ? (
                            <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--text-muted)" }}>
                                <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>⏳</div>
                                <p style={{ fontSize: "0.875rem" }}>{t("profile_loading_complaints")}</p>
                            </div>
                        ) : filteredComplaints.length === 0 ? (
                            <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--text-muted)" }}>
                                <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📭</div>
                                <p style={{ fontSize: "0.9rem", fontWeight: "600", marginBottom: "0.75rem" }}>
                                    {statusFilter === "All" ? t("profile_no_complaints") : (lang === "ta" ? "இந்த நிலையில் புகார்கள் எதுவும் இல்லை" : `No grievances found under ${statusFilter} status.`)}
                                </p>
                                <Link
                                    href="/"
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "0.4rem",
                                        padding: "0.5rem 1.1rem",
                                        borderRadius: "0.5rem",
                                        background: "linear-gradient(135deg, #ec4899, #f43f5e)",
                                        color: "white",
                                        fontWeight: "700",
                                        fontSize: "0.82rem",
                                        textDecoration: "none",
                                    }}
                                >
                                    {t("btn_new_complaint")}
                                </Link>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                {filteredComplaints.map(c => {
                                    const s = STATUS_STYLES[c.status] || STATUS_STYLES.Pending;
                                    return (
                                        <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.875rem 1rem", borderRadius: "0.75rem", background: "var(--bg-main)", border: "1px solid var(--border)", transition: "transform 0.15s ease", gap: "0.75rem" }}>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontWeight: "700", fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.subject}</div>
                                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "monospace", marginTop: "0.2rem" }}>{c.id} · {c.date}</div>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
                                                <span style={{ padding: "0.25rem 0.6rem", borderRadius: "99px", background: s.bg, color: s.color, fontSize: "0.7rem", fontWeight: "700" }}>{c.status}</span>
                                                <Link href={`/track?id=${c.id}`} style={{ fontSize: "0.75rem", color: "#ec4899", fontWeight: "700", textDecoration: "none" }}>{t("profile_track_btn")}</Link>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </ProtectedRoute>
    );
}
