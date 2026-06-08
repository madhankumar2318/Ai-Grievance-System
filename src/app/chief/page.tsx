"use client";

import { useState, useEffect, useMemo } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import ComplaintMap from "@/components/ComplaintMap";
import { useLang } from "@/context/LanguageContext";
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

/* ── Constants ────────────────────────────────────────────────────────────── */
const CATEGORY_COLORS: Record<string, string> = {
    Infrastructure: "#6366f1",
    Environment: "#10b981",
    Safety: "#f59e0b",
    "Public Health": "#ef4444",
    Administrative: "#8b5cf6",
    Other: "#06b6d4",
};
const PRIORITY_COLORS: Record<string, string> = {
    Critical: "#ef4444",
    High: "#f97316",
    Medium: "#f59e0b",
    Low: "#10b981",
};
const STATUS_DOT: Record<string, string> = {
    Resolved: "#10b981",
    "In Progress": "#6366f1",
    Pending: "#f59e0b",
    Rejected: "#ef4444",
};
const STAT_GRADS: Record<string, string> = {
    "#6366f1": "linear-gradient(135deg,#6366f1,#8b5cf6)",
    "#f59e0b": "linear-gradient(135deg,#f59e0b,#f97316)",
    "#10b981": "linear-gradient(135deg,#10b981,#06b6d4)",
    "#ef4444": "linear-gradient(135deg,#ef4444,#f97316)",
    "#06b6d4": "linear-gradient(135deg,#06b6d4,#6366f1)",
};
const TOOLTIP_STYLE = {
    background: "rgba(15,15,26,0.95)",
    border: "1px solid rgba(99,102,241,0.3)",
    borderRadius: "0.75rem",
    color: "#e2e8f0",
    fontSize: "0.82rem",
    padding: "0.6rem 1rem",
};

/* ── Helpers ──────────────────────────────────────────────────────────────── */
// Returns last N day labels (e.g. ["Jun 02", "Jun 03", ...])
function lastNDays(n: number): string[] {
    return Array.from({ length: n }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (n - 1 - i));
        return d.toLocaleDateString("en-IN", { month: "short", day: "2-digit" });
    });
}

function formatDayKey(isoDate: string): string {
    return new Date(isoDate).toLocaleDateString("en-IN", { month: "short", day: "2-digit" });
}

/* ── Sub-components ───────────────────────────────────────────────────────── */
function StatCard({ icon, label, value, color, sub }: {
    icon: string; label: string; value: number | string; color: string; sub?: string;
}) {
    const grad = STAT_GRADS[color] || `linear-gradient(135deg,${color},${color}aa)`;
    return (
        <div className="glass card-hover print-stat animate-fade-in" style={{
            padding: "1.75rem 1.25rem", borderRadius: "var(--radius)", textAlign: "center",
            borderTop: `3px solid ${color}`, position: "relative", overflow: "hidden",
        }}>
            <div style={{ position: "absolute", top: "-20px", right: "-20px", width: "80px", height: "80px", borderRadius: "50%", background: `${color}18`, filter: "blur(20px)" }} />
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "42px", height: "42px", borderRadius: "12px", background: grad, fontSize: "1.2rem", marginBottom: "0.75rem", boxShadow: `0 4px 12px ${color}44` }}>
                {icon}
            </div>
            <div style={{ fontSize: "2.25rem", fontWeight: "900", color, lineHeight: 1, marginBottom: "0.25rem" }}>{value}</div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: "600" }}>{label}</div>
            {sub && <div style={{ fontSize: "0.7rem", color: "var(--text-faint)", marginTop: "0.25rem" }}>{sub}</div>}
        </div>
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={TOOLTIP_STYLE}>
            <div style={{ fontWeight: "700", marginBottom: "0.3rem", color: "#a5b4fc" }}>{label}</div>
            {payload.map((p: { name: string; value: number; color: string }) => (
                <div key={p.name} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, display: "inline-block" }} />
                    <span style={{ color: "#94a3b8" }}>{p.name}:</span>
                    <span style={{ fontWeight: "700", color: "#e2e8f0" }}>{p.value}</span>
                </div>
            ))}
        </div>
    );
};

// Skeleton loader card
function SkeletonCard() {
    return (
        <div className="glass" style={{ padding: "1.75rem 1.25rem", borderRadius: "var(--radius)", textAlign: "center", borderTop: "3px solid var(--border)" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "var(--border)", margin: "0 auto 0.75rem", animation: "pulse 1.5s ease infinite" }} />
            <div style={{ width: "60%", height: "2rem", background: "var(--border)", borderRadius: "0.5rem", margin: "0 auto 0.5rem", animation: "pulse 1.5s ease infinite" }} />
            <div style={{ width: "80%", height: "0.75rem", background: "var(--border)", borderRadius: "0.5rem", margin: "0 auto", animation: "pulse 1.5s ease infinite" }} />
        </div>
    );
}

/* ── Main Component ───────────────────────────────────────────────────────── */
export default function ChiefDashboard() {
    const { t } = useLang();
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [complaints, setComplaints] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

    /* ── Fetch from Supabase ────────────────────────────────────────────── */
    const fetchComplaints = async () => {
        setLoading(true);
        try {
            const { supabase, isConfigured } = await import("@/lib/supabase");
            if (!isConfigured) { setLoading(false); return; }

            const { data, error } = await supabase
                .from("complaints")
                .select("*")
                .order("created_at", { ascending: false });

            if (!error && data) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setComplaints(data.map((c: any) => ({
                    id: c.id,
                    subject: c.subject,
                    category: c.category || "Other",
                    priority: c.priority || "Medium",
                    status: c.status || "Pending",
                    user: c.user_email || "Anonymous",
                    location: c.location || "—",
                    date: new Date(c.created_at).toLocaleDateString("en-IN"),
                    created_at: c.created_at,
                    updated_at: c.updated_at,
                })));
                setLastRefresh(new Date());
            }
        } catch (err) {
            console.error("Chief dashboard fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchComplaints(); }, []);

    /* ── Derived Stats ──────────────────────────────────────────────────── */
    const total       = complaints.length;
    const pending     = complaints.filter(c => c.status === "Pending").length;
    const resolved    = complaints.filter(c => c.status === "Resolved").length;
    const inProgress  = complaints.filter(c => c.status === "In Progress").length;
    const critical    = complaints.filter(c => c.priority === "Critical").length;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    const categoryCounts = useMemo(() =>
        complaints.reduce<Record<string, number>>((acc, c) => {
            acc[c.category] = (acc[c.category] || 0) + 1; return acc;
        }, {}),
    [complaints]);

    const pieData = useMemo(() =>
        Object.entries(categoryCounts).map(([name, value]) => ({ name, value })),
    [categoryCounts]);

    const priorityBarData = useMemo(() =>
        Object.entries(PRIORITY_COLORS).map(([name]) => ({
            name,
            count: complaints.filter(c => c.priority === name).length,
        })),
    [complaints]);

    /* ── Build real 7-day trend from actual complaint timestamps ───────── */
    const trendData = useMemo(() => {
        const days = lastNDays(7);
        const filedMap: Record<string, number> = {};
        const resolvedMap: Record<string, number> = {};
        days.forEach(d => { filedMap[d] = 0; resolvedMap[d] = 0; });

        complaints.forEach(c => {
            const filedKey = formatDayKey(c.created_at);
            if (filedKey in filedMap) filedMap[filedKey]++;

            if (c.status === "Resolved" && c.updated_at) {
                const resolvedKey = formatDayKey(c.updated_at);
                if (resolvedKey in resolvedMap) resolvedMap[resolvedKey]++;
            }
        });

        return days.map(day => ({
            day,
            Filed: filedMap[day],
            Resolved: resolvedMap[day],
        }));
    }, [complaints]);

    /* ── Render ─────────────────────────────────────────────────────────── */
    const statusLabel = (s: string) =>
        s === "Pending" ? t("status_pending") : s === "In Progress" ? t("status_in_progress") : s === "Resolved" ? t("status_resolved") : s;
    const priorityLabel = (p: string) =>
        p === "Critical" ? t("priority_critical") : p === "High" ? t("priority_high") : p === "Medium" ? t("priority_medium") : t("priority_low");

    return (
        <ProtectedRoute allowedRoles={["chief"]}>
            <main className="container section">

                {/* ── Header ── */}
                <div style={{ marginBottom: "2.5rem", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
                            <span style={{ fontSize: "2.5rem" }}>⭐</span>
                            <h1 className="gradient-text" style={{ fontSize: "2.5rem" }}>{t("chief_title")}</h1>
                        </div>
                        <p style={{ color: "var(--text-muted)", marginLeft: "3.5rem" }}>{t("chief_subtitle")}</p>
                        {lastRefresh && (
                            <p style={{ color: "var(--text-faint)", marginLeft: "3.5rem", fontSize: "0.75rem", marginTop: "0.25rem" }}>
                                🔄 Live data · Last synced {lastRefresh.toLocaleTimeString("en-IN")}
                            </p>
                        )}
                    </div>
                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                        {/* Refresh button */}
                        <button
                            onClick={fetchComplaints}
                            disabled={loading}
                            style={{
                                display: "flex", alignItems: "center", gap: "0.5rem",
                                padding: "0.75rem 1.25rem", borderRadius: "0.75rem",
                                background: "var(--bg-card)", color: "var(--text-main)",
                                border: "1px solid var(--border)", cursor: loading ? "not-allowed" : "pointer",
                                fontWeight: "700", fontSize: "0.85rem", transition: "var(--transition)",
                                opacity: loading ? 0.6 : 1,
                            }}
                        >
                            {loading ? "⏳" : "🔄"} Refresh
                        </button>
                        {/* Export PDF */}
                        <button
                            onClick={() => window.print()}
                            className="no-print btn"
                            style={{
                                display: "flex", alignItems: "center", gap: "0.6rem",
                                padding: "0.75rem 1.5rem", borderRadius: "0.75rem",
                                background: "linear-gradient(135deg, #ef4444, #f97316)",
                                color: "white", border: "none", cursor: "pointer",
                                fontWeight: "700", fontSize: "0.9rem",
                                boxShadow: "0 4px 20px rgba(239,68,68,0.4)", transition: "var(--transition)",
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 28px rgba(239,68,68,0.5)"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(239,68,68,0.4)"; }}
                        >
                            📄 {t("chief_export_pdf")}
                        </button>
                    </div>
                </div>

                {/* Print-only header */}
                <div className="print-only" style={{ display: "none", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "2px solid #000" }}>
                    <h2 style={{ fontSize: "1.5rem" }}>⭐ AI Grievance System — Chief Report</h2>
                    <p style={{ fontSize: "0.85rem", color: "#666" }}>Generated on: {new Date().toLocaleString("en-IN")}</p>
                </div>

                {/* ── Stat Cards ── */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "1.25rem", marginBottom: "3rem" }}>
                    {loading ? (
                        Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
                    ) : (
                        <>
                            <StatCard icon="📋" label={t("chief_total")}       value={total}         color="#6366f1" />
                            <StatCard icon="⏳" label={t("chief_pending")}     value={pending}       color="#f59e0b" />
                            <StatCard icon="🔄" label={t("chief_in_progress")} value={inProgress}    color="#6366f1" />
                            <StatCard icon="✅" label={t("chief_resolved")}    value={resolved}      color="#10b981" />
                            <StatCard icon="🚨" label={t("chief_critical")}    value={critical}      color="#ef4444" />
                            <StatCard icon="📈" label="Resolution Rate"        value={`${resolutionRate}%`} color="#06b6d4"
                                sub={total > 0 ? `${resolved} of ${total} resolved` : "No data yet"} />
                        </>
                    )}
                </div>

                {/* ── Analytics Charts ── */}
                {!loading && total > 0 && (
                    <div style={{ marginBottom: "3rem" }}>
                        <h2 style={{ fontSize: "1.5rem", fontWeight: "800", marginBottom: "1.5rem" }}>
                            📊 <span className="gradient-text">Analytics Overview</span>
                        </h2>

                        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
                            {/* Area Chart — Real 7-day Trend */}
                            <div className="glass card-hover" style={{ padding: "1.75rem", borderRadius: "1.25rem" }}>
                                <div style={{ fontWeight: "700", marginBottom: "0.3rem" }}>📈 Complaints Over Time</div>
                                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "1.25rem" }}>
                                    Last 7 days — filed vs resolved (live data)
                                </div>
                                <ResponsiveContainer width="100%" height={220}>
                                    <AreaChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="gradFiled" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="gradResolved" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                        <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area type="monotone" dataKey="Filed"    stroke="#6366f1" strokeWidth={2.5} fill="url(#gradFiled)"    dot={{ fill: "#6366f1", r: 4 }} activeDot={{ r: 6 }} />
                                        <Area type="monotone" dataKey="Resolved" stroke="#10b981" strokeWidth={2.5} fill="url(#gradResolved)" dot={{ fill: "#10b981", r: 4 }} activeDot={{ r: 6 }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Pie Chart — Category Breakdown */}
                            <div className="glass card-hover" style={{ padding: "1.75rem", borderRadius: "1.25rem" }}>
                                <div style={{ fontWeight: "700", marginBottom: "0.3rem" }}>🍩 Category Breakdown</div>
                                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "1rem" }}>Distribution by complaint type</div>
                                {pieData.length > 0 ? (
                                    <>
                                        <ResponsiveContainer width="100%" height={160}>
                                            <PieChart>
                                                <Pie
                                                    data={pieData} cx="50%" cy="50%"
                                                    innerRadius={40} outerRadius={70}
                                                    dataKey="value" paddingAngle={3}
                                                    onMouseEnter={(_, index) => setActiveIndex(index)}
                                                    onMouseLeave={() => setActiveIndex(null)}
                                                >
                                                    {pieData.map((entry, index) => (
                                                        <Cell
                                                            key={entry.name}
                                                            fill={CATEGORY_COLORS[entry.name] || "#6366f1"}
                                                            opacity={activeIndex === null || activeIndex === index ? 1 : 0.5}
                                                            stroke="none"
                                                        />
                                                    ))}
                                                </Pie>
                                                <Tooltip content={<CustomTooltip />} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.5rem" }}>
                                            {pieData.map(entry => (
                                                <div key={entry.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.75rem" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: CATEGORY_COLORS[entry.name] || "#6366f1", display: "inline-block" }} />
                                                        <span style={{ color: "var(--text-muted)" }}>{entry.name}</span>
                                                    </div>
                                                    <span style={{ fontWeight: "700", color: CATEGORY_COLORS[entry.name] || "#6366f1" }}>{entry.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ textAlign: "center", color: "var(--text-muted)", paddingTop: "2rem" }}>No data yet</div>
                                )}
                            </div>
                        </div>

                        {/* Bar Chart — Priority Distribution */}
                        <div className="glass" style={{ padding: "1.75rem", borderRadius: "1.25rem" }}>
                            <div style={{ fontWeight: "700", marginBottom: "0.3rem" }}>📊 Priority Distribution</div>
                            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "1.25rem" }}>Complaints grouped by urgency level (live)</div>
                            <ResponsiveContainer width="100%" height={180}>
                                <BarChart data={priorityBarData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="count" name="Complaints" radius={[6, 6, 0, 0]} maxBarSize={60}>
                                        {priorityBarData.map(entry => (
                                            <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* ── Empty state (no complaints yet) ── */}
                {!loading && total === 0 && (
                    <div className="glass animate-fade-in" style={{ padding: "4rem 2rem", borderRadius: "1.5rem", textAlign: "center", marginBottom: "3rem" }}>
                        <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>📭</div>
                        <h2 style={{ marginBottom: "0.75rem" }}>No Complaints Yet</h2>
                        <p style={{ color: "var(--text-muted)" }}>When citizens submit grievances, live stats and charts will appear here.</p>
                    </div>
                )}

                {/* ── Interactive Complaint Map ── */}
                <div className="glass no-print" style={{ padding: "2rem", borderRadius: "1.5rem", marginBottom: "3rem" }}>
                    <ComplaintMap title={t("map_title")} subtitle={t("map_subtitle")} />
                </div>

                {/* ── Category + Officers Row ── */}
                {total > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "3rem" }}>
                        {/* Category Breakdown progress bars */}
                        <div className="glass" style={{ padding: "2rem", borderRadius: "var(--radius)" }}>
                            <h3 style={{ marginBottom: "1.5rem" }}>{t("chief_category_breakdown")}</h3>
                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                {Object.entries(categoryCounts).length > 0 ? (
                                    Object.entries(categoryCounts)
                                        .sort(([, a], [, b]) => b - a)
                                        .map(([cat, count]) => (
                                            <div key={cat}>
                                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                                                    <span style={{ fontWeight: "600", fontSize: "0.875rem" }}>{cat}</span>
                                                    <span style={{ fontWeight: "700", color: CATEGORY_COLORS[cat] || "#6366f1" }}>
                                                        {count} <span style={{ color: "var(--text-faint)", fontWeight: "400", fontSize: "0.75rem" }}>({Math.round((count / total) * 100)}%)</span>
                                                    </span>
                                                </div>
                                                <div style={{ height: "6px", borderRadius: "99px", background: "var(--border)" }}>
                                                    <div style={{
                                                        height: "100%", borderRadius: "99px",
                                                        background: CATEGORY_COLORS[cat] || "#6366f1",
                                                        width: `${(count / total) * 100}%`,
                                                        transition: "width 0.8s ease",
                                                    }} />
                                                </div>
                                            </div>
                                        ))
                                ) : (
                                    <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>No categories yet.</p>
                                )}
                            </div>
                        </div>

                        {/* Authority Status — workload based on real complaints */}
                        <div className="glass" style={{ padding: "2rem", borderRadius: "var(--radius)" }}>
                            <h3 style={{ marginBottom: "0.5rem" }}>{t("chief_authority_status")}</h3>
                            <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginBottom: "1.25rem" }}>
                                Active case load from live complaints
                            </p>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                                {[
                                    { name: "Officer Priya",  dept: "Environment",   category: "Environment" },
                                    { name: "Officer Singh",  dept: "Infrastructure", category: "Infrastructure" },
                                    { name: "Officer Reddy",  dept: "Public Health",  category: "Public Health" },
                                    { name: "Officer Meera",  dept: "Safety",         category: "Safety" },
                                ].map(officer => {
                                    const load = complaints.filter(c =>
                                        c.category === officer.category &&
                                        (c.status === "Pending" || c.status === "In Progress")
                                    ).length;
                                    const status = load === 0 ? "Available" : load <= 3 ? "Active" : "Busy";
                                    const statusColor = status === "Available" ? "#10b981" : status === "Active" ? "#6366f1" : "#ef4444";
                                    const color = CATEGORY_COLORS[officer.category] || "#6366f1";
                                    const initials = officer.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
                                    return (
                                        <div
                                            key={officer.name}
                                            style={{ display: "flex", alignItems: "center", gap: "0.875rem", padding: "0.875rem 1rem", borderRadius: "0.75rem", background: "var(--bg-main)", transition: "var(--transition)" }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${color}22`; (e.currentTarget as HTMLElement).style.transform = "translateX(4px)"; }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.transform = "translateX(0)"; }}
                                        >
                                            <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: `linear-gradient(135deg,${color},${color}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: "800", color: "white", flexShrink: 0 }}>
                                                {initials}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: "700", fontSize: "0.875rem", marginBottom: "0.1rem" }}>{officer.name}</div>
                                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                                    {officer.dept} · {load} active {load === 1 ? "case" : "cases"}
                                                </div>
                                            </div>
                                            <span style={{ padding: "0.25rem 0.65rem", borderRadius: "99px", fontSize: "0.7rem", fontWeight: "700", background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}30`, flexShrink: 0 }}>
                                                {status}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── All Complaints Table ── */}
                <div className="glass" style={{ borderRadius: "1.5rem", overflow: "hidden", border: "1px solid var(--border)" }}>
                    <div style={{ padding: "1.5rem 2rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h3>{t("chief_all_grievances")}</h3>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                            {loading ? "Loading..." : `${total} ${t("chief_complaints_total")}`}
                        </span>
                    </div>

                    {loading && (
                        <div style={{ padding: "4rem 2rem", textAlign: "center" }}>
                            <div style={{ fontSize: "2rem", marginBottom: "0.75rem", display: "inline-block", animation: "spin 1s linear infinite" }}>⏳</div>
                            <p style={{ color: "var(--text-muted)", fontWeight: "600" }}>Loading complaints from Supabase...</p>
                        </div>
                    )}

                    {!loading && total === 0 && (
                        <div style={{ padding: "4rem 2rem", textAlign: "center" }}>
                            <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>📭</div>
                            <p style={{ color: "var(--text-muted)", fontWeight: "600" }}>No complaints in the system yet.</p>
                        </div>
                    )}

                    {!loading && total > 0 && (
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                                <thead style={{ background: "rgba(99,102,241,0.05)", borderBottom: "1px solid var(--border)" }}>
                                    <tr>
                                        {[
                                            t("chief_col_id"), t("chief_col_subject"), t("chief_col_citizen"),
                                            t("chief_col_location"), t("chief_col_priority"), t("chief_col_status"), t("chief_col_date"),
                                        ].map(h => (
                                            <th key={h} style={{ padding: "1rem 1.25rem", fontWeight: "700", fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {complaints.map((c, idx) => (
                                        <tr
                                            key={c.id}
                                            className="animate-fade-in"
                                            style={{ borderBottom: "1px solid var(--border)", animationDelay: `${idx * 30}ms`, transition: "background 0.15s ease" }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.03)"; }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                                        >
                                            <td style={{ padding: "1rem 1.25rem", fontWeight: "700", fontFamily: "monospace", fontSize: "0.82rem", color: "#6366f1", whiteSpace: "nowrap" }}>{c.id}</td>
                                            <td style={{ padding: "1rem 1.25rem" }}>
                                                <div style={{ fontWeight: "600", marginBottom: "0.2rem", fontSize: "0.9rem" }}>{c.subject}</div>
                                                <span style={{ fontSize: "0.7rem", padding: "0.15rem 0.5rem", borderRadius: "99px", background: `${CATEGORY_COLORS[c.category] || "#6366f1"}22`, color: CATEGORY_COLORS[c.category] || "#6366f1", fontWeight: "700" }}>
                                                    {c.category}
                                                </span>
                                            </td>
                                            <td style={{ padding: "1rem 1.25rem", fontSize: "0.85rem", color: "var(--text-muted)", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.user}</td>
                                            <td style={{ padding: "1rem 1.25rem", fontSize: "0.82rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>📍 {c.location}</td>
                                            <td style={{ padding: "1rem 1.25rem" }}>
                                                <span style={{ padding: "0.2rem 0.7rem", borderRadius: "99px", fontSize: "0.75rem", fontWeight: "700", background: `${PRIORITY_COLORS[c.priority] || "#f59e0b"}22`, color: PRIORITY_COLORS[c.priority] || "#f59e0b", border: `1px solid ${PRIORITY_COLORS[c.priority] || "#f59e0b"}44`, whiteSpace: "nowrap" }}>
                                                    {priorityLabel(c.priority)}
                                                </span>
                                            </td>
                                            <td style={{ padding: "1rem 1.25rem" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: STATUS_DOT[c.status] || "#f59e0b", flexShrink: 0 }} />
                                                    <span style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}>{statusLabel(c.status)}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: "1rem 1.25rem", fontSize: "0.8rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{c.date}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </main>

            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50%       { opacity: 0.4; }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to   { transform: rotate(360deg); }
                }
            `}</style>
        </ProtectedRoute>
    );
}
