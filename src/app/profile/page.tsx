"use client";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Link from "next/link";
import { useState, useEffect } from "react";

const ROLE_CONFIG = {
    user: { label: "Citizen", icon: "👤", color: "#6366f1", gradient: "linear-gradient(135deg,#6366f1,#8b5cf6)" },
    authority: { label: "Authority Officer", icon: "🏛️", color: "#f97316", gradient: "linear-gradient(135deg,#f97316,#fb923c)" },
    chief: { label: "Chief Commissioner", icon: "⭐", color: "#ec4899", gradient: "linear-gradient(135deg,#ec4899,#f43f5e)" },
};

function getInitials(name: string) {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
    return (
        <div className="glass" style={{ padding: "1.25rem", borderRadius: "var(--radius)", textAlign: "center", border: `1px solid ${color}25` }}>
            <div style={{ fontSize: "1.75rem", marginBottom: "0.4rem" }}>{icon}</div>
            <div style={{ fontSize: "1.5rem", fontWeight: "800", color }}>{value}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: "600", marginTop: "0.2rem" }}>{label}</div>
        </div>
    );
}

export default function ProfilePage() {
    const { user } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [joinedDate] = useState(() => {
        if (typeof window === "undefined") return "—";
        try {
            const users = JSON.parse(localStorage.getItem("gs_registered_users") || "[]");
            const found = users.find((u: { email: string }) => (u.email || "").toLowerCase() === (user?.email || "").toLowerCase());
            return found ? new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "Demo Account";
        } catch { return "Demo Account"; }
    });

    const [complaints, setComplaints] = useState<{ id: string; subject: string; status: string; date: string }[]>([]);
    const [editName, setEditName] = useState(false);
    const [displayName, setDisplayName] = useState(user?.username || "");

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const stored = JSON.parse(localStorage.getItem("grievance_complaints") || "[]");
            const mine = stored.filter((c: { userEmail: string }) => (c.userEmail || "").toLowerCase() === (user?.email || "").toLowerCase());
            setComplaints(mine.slice(-5).reverse());
        } catch { /* ignore */ }
    }, [user?.email]);

    if (!user) return null;
    const cfg = ROLE_CONFIG[user.role];
    const resolved = complaints.filter(c => c.status === "Resolved").length;
    const pending = complaints.filter(c => c.status === "Pending").length;

    const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
        Resolved: { bg: "#10b98118", color: "#10b981" },
        Pending: { bg: "#f59e0b18", color: "#f59e0b" },
        "In Progress": { bg: "#6366f118", color: "#6366f1" },
        Rejected: { bg: "#ef444418", color: "#ef4444" },
    };

    return (
        <ProtectedRoute>
            <main style={{ minHeight: "100vh", padding: "2rem 1rem" }}>
                <div className="container" style={{ maxWidth: "720px", margin: "0 auto" }}>

                    {/* Back button */}
                    <Link href={user.role === "user" ? "/" : user.role === "authority" ? "/admin" : "/chief"}
                        style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.875rem", color: "var(--text-muted)", textDecoration: "none", marginBottom: "1.5rem", fontWeight: "600" }}
                    >← Back to Dashboard</Link>

                    {/* Profile Card */}
                    <div className="glass animate-slide-up" style={{ borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-lg)", marginBottom: "1.5rem" }}>

                        {/* Banner */}
                        <div style={{ height: "120px", background: cfg.gradient, position: "relative" }}>
                            <div style={{ position: "absolute", inset: 0, background: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.06'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
                            {/* Theme toggle on banner */}
                            <button onClick={toggleTheme} title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
                                style={{ position: "absolute", top: "1rem", right: "1rem", width: "36px", height: "36px", borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}
                            >{theme === "light" ? "🌙" : "☀️"}</button>
                        </div>

                        {/* Avatar + info */}
                        <div style={{ padding: "0 2rem 2rem", position: "relative" }}>
                            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "1rem" }}>
                                <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: cfg.gradient, border: "4px solid var(--bg-card)", marginTop: "-40px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", fontWeight: "900", color: "white", boxShadow: `0 8px 24px ${cfg.color}44` }}>
                                    {getInitials(user.username)}
                                </div>
                                <div style={{ display: "flex", gap: "0.5rem", paddingBottom: "0.5rem" }}>
                                    <span style={{ padding: "0.3rem 0.75rem", borderRadius: "99px", background: `${cfg.color}18`, color: cfg.color, fontSize: "0.72rem", fontWeight: "800", border: `1px solid ${cfg.color}30` }}>
                                        {cfg.icon} {cfg.label}
                                    </span>
                                </div>
                            </div>

                            {/* Name row */}
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.35rem" }}>
                                {editName ? (
                                    <input
                                        autoFocus
                                        value={displayName}
                                        onChange={e => setDisplayName(e.target.value)}
                                        onBlur={() => setEditName(false)}
                                        onKeyDown={e => e.key === "Enter" && setEditName(false)}
                                        style={{ fontWeight: "800", fontSize: "1.4rem", border: `2px solid ${cfg.color}`, borderRadius: "0.5rem", background: "var(--bg-card)", color: "var(--text-main)", padding: "0.2rem 0.5rem", outline: "none", maxWidth: "280px" }}
                                    />
                                ) : (
                                    <h1 style={{ fontWeight: "800", fontSize: "1.4rem", margin: 0 }}>{displayName}</h1>
                                )}
                                <button onClick={() => setEditName(e => !e)} title="Edit display name"
                                    style={{ fontSize: "0.85rem", background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "0.2rem" }}
                                >{editName ? "✅" : "✏️"}</button>
                            </div>

                            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", margin: "0 0 1.5rem" }}>{user.email}</p>

                            {/* Info grid */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                                {[
                                    { icon: "📧", label: "Email", value: user.email },
                                    { icon: "🎭", label: "Role", value: cfg.label },
                                    { icon: "📅", label: "Member Since", value: joinedDate },
                                    { icon: "🔐", label: "Account Status", value: "Active ✅" },
                                ].map(item => (
                                    <div key={item.label} style={{ padding: "0.875rem", borderRadius: "0.75rem", background: "var(--bg-main)", border: "1px solid var(--border)" }}>
                                        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>{item.icon} {item.label}</div>
                                        <div style={{ fontSize: "0.875rem", fontWeight: "700", color: "var(--text-main)" }}>{item.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    {user.role === "user" && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
                            <StatCard label="Total Filed" value={complaints.length} icon="📋" color="#6366f1" />
                            <StatCard label="Resolved" value={resolved} icon="✅" color="#10b981" />
                            <StatCard label="Pending" value={pending} icon="⏳" color="#f59e0b" />
                        </div>
                    )}

                    {/* Recent Complaints */}
                    {user.role === "user" && (
                        <div className="glass animate-slide-up" style={{ borderRadius: "var(--radius-lg)", padding: "1.5rem", boxShadow: "var(--shadow-lg)" }}>
                            <h2 style={{ fontWeight: "800", fontSize: "1rem", marginBottom: "1rem" }}>📋 Recent Complaints</h2>
                            {complaints.length === 0 ? (
                                <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                                    <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📭</div>
                                    <p style={{ fontSize: "0.875rem" }}>No complaints filed yet.</p>
                                    <Link href="/" style={{ color: cfg.color, fontWeight: "700", fontSize: "0.875rem" }}>File your first complaint →</Link>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                    {complaints.map(c => {
                                        const s = STATUS_STYLES[c.status] || STATUS_STYLES.Pending;
                                        return (
                                            <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.875rem 1rem", borderRadius: "0.75rem", background: "var(--bg-main)", border: "1px solid var(--border)" }}>
                                                <div>
                                                    <div style={{ fontWeight: "700", fontSize: "0.9rem" }}>{c.subject}</div>
                                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "monospace", marginTop: "0.2rem" }}>{c.id} · {c.date}</div>
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                                    <span style={{ padding: "0.25rem 0.6rem", borderRadius: "99px", background: s.bg, color: s.color, fontSize: "0.7rem", fontWeight: "700" }}>{c.status}</span>
                                                    <Link href={`/track?id=${c.id}`} style={{ fontSize: "0.75rem", color: cfg.color, fontWeight: "700", textDecoration: "none" }}>Track →</Link>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </ProtectedRoute>
    );
}
