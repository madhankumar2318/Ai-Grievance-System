"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import ComplaintMap from "@/components/ComplaintMap";
import { useLang } from "@/context/LanguageContext";
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

export const MOCK_COMPLAINTS = [
    { id: "GRV-12044", subject: "Street Light Failure", category: "Infrastructure", priority: "Critical" as const, status: "Pending" as const, user: "John Doe", location: "Sector 12", date: "2026-02-18" },
    { id: "GRV-88291", subject: "Potable Water Contamination", category: "Environment", priority: "Critical" as const, status: "In Progress" as const, user: "Jane Smith", location: "Ward 7", date: "2026-02-19" },
    { id: "GRV-33102", subject: "Illegal Parking in Zone B", category: "Safety", priority: "Low" as const, status: "Resolved" as const, user: "Robert Brown", location: "Zone B", date: "2026-02-15" },
    { id: "GRV-40019", subject: "Public Hospital Staff Shortage", category: "Public Health", priority: "High" as const, status: "Pending" as const, user: "Alice Green", location: "City Hospital", date: "2026-02-20" },
    { id: "GRV-55678", subject: "Road Pothole Danger", category: "Infrastructure", priority: "High" as const, status: "In Progress" as const, user: "Ravi Kumar", location: "NH-48", date: "2026-02-17" },
    { id: "GRV-72190", subject: "Air Pollution from Factory", category: "Environment", priority: "Critical" as const, status: "Pending" as const, user: "Meena Patel", location: "Industrial Area", date: "2026-02-21" },
];

const CATEGORY_COLORS: Record<string, string> = {
    Infrastructure: "#6366f1", Environment: "#10b981", Safety: "#f59e0b",
    "Public Health": "#ef4444", Administrative: "#8b5cf6",
};
const PRIORITY_COLORS: Record<string, string> = {
    Critical: "#ef4444", High: "#f97316", Medium: "#f59e0b", Low: "#10b981",
};
const STATUS_DOT: Record<string, string> = {
    Resolved: "#10b981", "In Progress": "#6366f1", Pending: "#f59e0b",
};

// ── Chart Data ───────────────────────────────────────────────
const TREND_DATA = [
    { day: "Feb 15", complaints: 2, resolved: 1 },
    { day: "Feb 16", complaints: 3, resolved: 2 },
    { day: "Feb 17", complaints: 5, resolved: 2 },
    { day: "Feb 18", complaints: 4, resolved: 3 },
    { day: "Feb 19", complaints: 6, resolved: 2 },
    { day: "Feb 20", complaints: 8, resolved: 4 },
    { day: "Feb 21", complaints: 6, resolved: 3 },
];

const TOOLTIP_STYLE = {
    background: "rgba(15,15,26,0.95)",
    border: "1px solid rgba(99,102,241,0.3)",
    borderRadius: "0.75rem",
    color: "#e2e8f0",
    fontSize: "0.82rem",
    padding: "0.6rem 1rem",
};

const STAT_GRADS: Record<string, string> = {
    "#6366f1": "linear-gradient(135deg,#6366f1,#8b5cf6)",
    "#f59e0b": "linear-gradient(135deg,#f59e0b,#f97316)",
    "#10b981": "linear-gradient(135deg,#10b981,#06b6d4)",
    "#ef4444": "linear-gradient(135deg,#ef4444,#f97316)",
};

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number | string; color: string }) {
    const grad = STAT_GRADS[color] || `linear-gradient(135deg,${color},${color}aa)`;
    return (
        <div className="glass card-hover print-stat animate-fade-in" style={{ padding: "1.75rem 1.25rem", borderRadius: "var(--radius)", textAlign: "center", borderTop: `3px solid ${color}`, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: "-20px", right: "-20px", width: "80px", height: "80px", borderRadius: "50%", background: `${color}18`, filter: "blur(20px)" }} />
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "42px", height: "42px", borderRadius: "12px", background: grad, fontSize: "1.2rem", marginBottom: "0.75rem", boxShadow: `0 4px 12px ${color}44` }}>{icon}</div>
            <div style={{ fontSize: "2.25rem", fontWeight: "900", color, lineHeight: 1, marginBottom: "0.25rem" }}>{value}</div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: "600" }}>{label}</div>
        </div>
    );
}

// ── Custom Tooltip ───────────────────────────────────────────
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

export default function ChiefDashboard() {
    const { t } = useLang();
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [complaints, setComplaints] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchComplaints = async () => {
        try {
            const { supabase } = await import("@/lib/supabase");
            const { data } = await supabase
                .from("complaints")
                .select("*")
                .order("created_at", { ascending: false });
            if (data) {
                const mapped = data.map((c: any) => ({
                    id: c.id,
                    subject: c.subject,
                    category: c.category,
                    priority: c.priority,
                    status: c.status,
                    user: c.user_email || "Anonymous",
                    location: c.location || "",
                    date: new Date(c.created_at).toLocaleDateString("en-IN"),
                }));
                setComplaints(mapped);
            }
        } catch (err) {
            console.error("Error fetching chief complaints:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchComplaints();
    }, []);

    const total = complaints.length;
    const pending = complaints.filter(c => c.status === "Pending").length;
    const resolved = complaints.filter(c => c.status === "Resolved").length;
    const critical = complaints.filter(c => c.priority === "Critical").length;
    const inProgress = complaints.filter(c => c.status === "In Progress").length;

    const categoryCounts = complaints.reduce<Record<string, number>>((acc, c) => {
        acc[c.category] = (acc[c.category] || 0) + 1; return acc;
    }, {});

    const pieData = Object.entries(categoryCounts).map(([name, value]) => ({ name, value }));
    const priorityBarData = Object.entries(PRIORITY_COLORS).map(([name]) => ({
        name,
        count: complaints.filter(c => c.priority === name).length,
    }));

    const statusLabel = (s: string) =>
        s === "Pending" ? t("status_pending") : s === "In Progress" ? t("status_in_progress") : t("status_resolved");
    const priorityLabel = (p: string) =>
        p === "Critical" ? t("priority_critical") : p === "High" ? t("priority_high") : p === "Medium" ? t("priority_medium") : t("priority_low");
    const officerStatusLabel = (s: string) =>
        s === "Active" ? t("chief_active") : s === "Busy" ? t("chief_busy") : t("chief_available");

    const handleExportPDF = () => window.print();

    return (
        <ProtectedRoute allowedRoles={["chief"]}>
            <main className="container section">
                {/* Header */}
                <div style={{ marginBottom: "3rem", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
                            <span style={{ fontSize: "2.5rem" }}>⭐</span>
                            <h1 className="gradient-text" style={{ fontSize: "2.5rem" }}>{t("chief_title")}</h1>
                        </div>
                        <p style={{ color: "var(--text-muted)", marginLeft: "3.5rem" }}>{t("chief_subtitle")}</p>
                    </div>
                    <button
                        onClick={handleExportPDF}
                        className="no-print btn"
                        style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.75rem 1.5rem", borderRadius: "0.75rem", background: "linear-gradient(135deg, #ef4444, #f97316)", color: "white", border: "none", cursor: "pointer", fontWeight: "700", fontSize: "0.9rem", boxShadow: "0 4px 20px rgba(239,68,68,0.4)", transition: "var(--transition)", overflow: "hidden", position: "relative" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 28px rgba(239,68,68,0.5)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(239,68,68,0.4)"; }}
                    >
                        📄 {t("chief_export_pdf")}
                    </button>
                </div>

                {/* Print-only header */}
                <div className="print-only" style={{ display: "none", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "2px solid #000" }}>
                    <h2 style={{ fontSize: "1.5rem" }}>⭐ AI Grievance System — Chief Report</h2>
                    <p style={{ fontSize: "0.85rem", color: "#666" }}>Generated on: {new Date().toLocaleString("en-IN")}</p>
                </div>

                {/* Stats Row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1.25rem", marginBottom: "3rem" }}>
                    <StatCard icon="📋" label={t("chief_total")} value={total} color="#6366f1" />
                    <StatCard icon="⏳" label={t("chief_pending")} value={pending} color="#f59e0b" />
                    <StatCard icon="🔄" label={t("chief_in_progress")} value={inProgress} color="#6366f1" />
                    <StatCard icon="✅" label={t("chief_resolved")} value={resolved} color="#10b981" />
                    <StatCard icon="🚨" label={t("chief_critical")} value={critical} color="#ef4444" />
                </div>

                {/* ── Analytics Charts Section ─────────────────────── */}
                <div style={{ marginBottom: "3rem" }}>
                    <h2 style={{ fontSize: "1.5rem", fontWeight: "800", marginBottom: "1.5rem" }}>
                        📊 <span className="gradient-text">Analytics Overview</span>
                    </h2>

                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
                        {/* Line / Area Chart — Complaints Over Time */}
                        <div className="glass card-hover" style={{ padding: "1.75rem", borderRadius: "1.25rem", transition: "var(--transition)" }}>
                            <div style={{ fontWeight: "700", marginBottom: "0.3rem" }}>📈 Complaints Over Time</div>
                            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "1.25rem" }}>Last 7 days — filed vs resolved</div>
                            <ResponsiveContainer width="100%" height={220}>
                                <AreaChart data={TREND_DATA} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="gradComplaints" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="gradResolved" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: "0.78rem", paddingTop: "0.75rem" }} />
                                    <Area type="monotone" dataKey="complaints" name="Filed" stroke="#6366f1" strokeWidth={2.5} fill="url(#gradComplaints)" dot={{ fill: "#6366f1", r: 4 }} activeDot={{ r: 6 }} />
                                    <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#10b981" strokeWidth={2.5} fill="url(#gradResolved)" dot={{ fill: "#10b981", r: 4 }} activeDot={{ r: 6 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Donut / Pie Chart — Category Breakdown */}
                        <div className="glass card-hover" style={{ padding: "1.75rem", borderRadius: "1.25rem", transition: "var(--transition)" }}>
                            <div style={{ fontWeight: "700", marginBottom: "0.3rem" }}>🍩 Category Breakdown</div>
                            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "1rem" }}>Distribution by complaint type</div>
                            <ResponsiveContainer width="100%" height={180}>
                                <PieChart>
                                    <Pie
                                        data={pieData} cx="50%" cy="50%"
                                        innerRadius={45} outerRadius={80}
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
                            {/* Legend */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.5rem" }}>
                                {pieData.map((entry) => (
                                    <div key={entry.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.75rem" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: CATEGORY_COLORS[entry.name] || "#6366f1", display: "inline-block" }} />
                                            <span style={{ color: "var(--text-muted)" }}>{entry.name}</span>
                                        </div>
                                        <span style={{ fontWeight: "700", color: CATEGORY_COLORS[entry.name] || "#6366f1" }}>{entry.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Bar Chart — Priority Distribution */}
                    <div className="glass" style={{ padding: "1.75rem", borderRadius: "1.25rem" }}>
                        <div style={{ fontWeight: "700", marginBottom: "0.3rem" }}>📊 Priority Distribution</div>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "1.25rem" }}>Complaints grouped by urgency level</div>
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={priorityBarData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="count" name="Complaints" radius={[6, 6, 0, 0]} maxBarSize={60}>
                                    {priorityBarData.map((entry) => (
                                        <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Interactive Complaint Map */}
                <div className="glass no-print" style={{ padding: "2rem", borderRadius: "1.5rem", marginBottom: "3rem" }}>
                    <ComplaintMap title={t("map_title")} subtitle={t("map_subtitle")} />
                </div>

                {/* Category + Authority row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "3rem" }}>
                    <div className="glass" style={{ padding: "2rem", borderRadius: "var(--radius)" }}>
                        <h3 style={{ marginBottom: "1.5rem" }}>{t("chief_category_breakdown")}</h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            {Object.entries(categoryCounts).map(([cat, count]) => (
                                <div key={cat}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                                        <span style={{ fontWeight: "600", fontSize: "0.875rem" }}>{cat}</span>
                                        <span style={{ fontWeight: "700", color: CATEGORY_COLORS[cat] || "#6366f1" }}>{count}</span>
                                    </div>
                                    <div style={{ height: "6px", borderRadius: "99px", background: "var(--border)" }}>
                                        <div style={{ height: "100%", borderRadius: "99px", background: CATEGORY_COLORS[cat] || "#6366f1", width: `${(count / total) * 100}%`, transition: "width 0.5s ease" }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="glass" style={{ padding: "2rem", borderRadius: "var(--radius)" }}>
                        <h3 style={{ marginBottom: "1.5rem" }}>{t("chief_authority_status")}</h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                            {[
                                { name: "Officer Priya", dept: "Environment", load: 2, status: "Active", color: "#6366f1" },
                                { name: "Officer Singh", dept: "Infrastructure", load: 2, status: "Active", color: "#6366f1" },
                                { name: "Officer Reddy", dept: "Public Health", load: 1, status: "Busy", color: "#ef4444" },
                                { name: "Officer Meera", dept: "Safety", load: 0, status: "Available", color: "#10b981" },
                            ].map((officer) => {
                                const statusColor = officer.status === "Available" ? "#10b981" : officer.status === "Busy" ? "#ef4444" : "#6366f1";
                                const initials = officer.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
                                return (
                                    <div key={officer.name} style={{ display: "flex", alignItems: "center", gap: "0.875rem", padding: "0.875rem 1rem", borderRadius: "0.75rem", background: "var(--bg-main)", transition: "var(--transition)" }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${officer.color}22`; (e.currentTarget as HTMLElement).style.transform = "translateX(4px)"; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.transform = "translateX(0)"; }}
                                    >
                                        {/* Avatar */}
                                        <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: `linear-gradient(135deg, ${officer.color}, ${officer.color}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: "800", color: "white", flexShrink: 0 }}>{initials}</div>
                                        {/* Info */}
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: "700", fontSize: "0.875rem", marginBottom: "0.1rem" }}>{officer.name}</div>
                                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{officer.dept} · {officer.load} {t("chief_active_cases")}</div>
                                        </div>
                                        {/* Status badge */}
                                        <span style={{ padding: "0.25rem 0.65rem", borderRadius: "99px", fontSize: "0.7rem", fontWeight: "700", background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}30`, flexShrink: 0 }}>
                                            {officerStatusLabel(officer.status)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* All Complaints Table */}
                <div className="glass" style={{ borderRadius: "1.5rem", overflow: "hidden", border: "1px solid var(--border)" }}>
                    <div style={{ padding: "1.5rem 2rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h3>{t("chief_all_grievances")}</h3>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{total} {t("chief_complaints_total")}</span>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                        <thead style={{ background: "rgba(0,0,0,0.03)", borderBottom: "1px solid var(--border)" }}>
                            <tr>
                                {[
                                    t("chief_col_id"), t("chief_col_subject"), t("chief_col_citizen"),
                                    t("chief_col_location"), t("chief_col_priority"), t("chief_col_status"), t("chief_col_date"),
                                ].map(h => (
                                    <th key={h} style={{ padding: "1rem 1.25rem", fontWeight: "700", fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {complaints.map((c) => (
                                <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                                    <td style={{ padding: "1rem 1.25rem", fontWeight: "700", fontFamily: "monospace", fontSize: "0.82rem", color: "#6366f1" }}>{c.id}</td>
                                    <td style={{ padding: "1rem 1.25rem" }}>
                                        <div style={{ fontWeight: "600", marginBottom: "0.2rem", fontSize: "0.9rem" }}>{c.subject}</div>
                                        <span style={{ fontSize: "0.7rem", padding: "0.15rem 0.5rem", borderRadius: "99px", background: `${CATEGORY_COLORS[c.category] || "#6366f1"}22`, color: CATEGORY_COLORS[c.category] || "#6366f1", fontWeight: "700" }}>{c.category}</span>
                                    </td>
                                    <td style={{ padding: "1rem 1.25rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>{c.user}</td>
                                    <td style={{ padding: "1rem 1.25rem", fontSize: "0.82rem", color: "var(--text-muted)" }}>📍 {c.location}</td>
                                    <td style={{ padding: "1rem 1.25rem" }}>
                                        <span style={{ padding: "0.2rem 0.7rem", borderRadius: "99px", fontSize: "0.75rem", fontWeight: "700", background: `${PRIORITY_COLORS[c.priority]}22`, color: PRIORITY_COLORS[c.priority], border: `1px solid ${PRIORITY_COLORS[c.priority]}44` }}>
                                            {priorityLabel(c.priority)}
                                        </span>
                                    </td>
                                    <td style={{ padding: "1rem 1.25rem" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: STATUS_DOT[c.status] }} />
                                            <span style={{ fontSize: "0.85rem" }}>{statusLabel(c.status)}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: "1rem 1.25rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>{c.date}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>
        </ProtectedRoute>
    );
}
