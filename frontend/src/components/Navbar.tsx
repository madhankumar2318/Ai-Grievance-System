"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useLang, LANGUAGE_NAMES, Language } from "@/context/LanguageContext";
import { useState, useEffect } from "react";

const ROLE_BADGE = {
    user: { label: "Citizen", color: "#6366f1", bg: "#6366f115" },
    authority: { label: "Authority", color: "#f97316", bg: "#f9731615" },
    chief: { label: "Chief", color: "#ec4899", bg: "#ec489915" },
};

function getInitials(username: string) {
    return username.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function Navbar() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, isLoggedIn, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { lang, setLang, t } = useLang();
    const [showLangMenu, setShowLangMenu] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showNotifMenu, setShowNotifMenu] = useState(false);
    const [hasUnread, setHasUnread] = useState(true);
    const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; time: string; icon: string; link?: string; unread: boolean; }[]>([]);

    useEffect(() => {
        if (!isLoggedIn) return;
        const notifs: { id: string; title: string; message: string; time: string; icon: string; link?: string; unread: boolean; }[] = [];

        if (typeof window !== "undefined" && user?.role === "user") {
            try {
                const stored = JSON.parse(localStorage.getItem("grievance_my_complaints") || "[]");
                if (Array.isArray(stored) && stored.length > 0) {
                    stored.slice(0, 3).forEach((c, idx) => {
                        const statusIcon = c.status === "Resolved" ? "✅" : c.status === "In Progress" ? "🔄" : "📋";
                        notifs.push({
                            id: `complaint-${c.id || idx}`,
                            title: `Grievance #${c.id || "GRV-" + (idx + 1000)}`,
                            message: `Status is currently ${c.status || "Pending"}. Click to view live progress.`,
                            time: idx === 0 ? "Recent" : `${idx + 1}d ago`,
                            icon: statusIcon,
                            link: `/track?id=${c.id}`,
                            unread: idx === 0,
                        });
                    });
                }
            } catch {
                // Ignore json parse error
            }
        }

        if (user?.role === "authority") {
            notifs.push({
                id: "auth-jurisdiction",
                title: "🛡️ Jurisdiction Active",
                message: `Assigned to ${user.district || "Tiruppur"} District queue. New complaints will appear automatically.`,
                time: "Live",
                icon: "🏛️",
                link: "/admin",
                unread: true,
            });
            notifs.push({
                id: "auth-triage",
                title: "⚡ AI Triage Engine",
                message: "Complaints are automatically prioritized (Critical, High, Medium, Low).",
                time: "System",
                icon: "🤖",
                link: "/admin",
                unread: false,
            });
        } else if (user?.role === "chief") {
            notifs.push({
                id: "chief-oversight",
                title: "⭐ Chief Oversight Dashboard",
                message: "System-wide analytics, department resolution rates, and SLA metrics are synced.",
                time: "Live",
                icon: "📊",
                link: "/chief",
                unread: true,
            });
        } else {
            notifs.push({
                id: "sys-welcome",
                title: "👋 Welcome to AI Grievance System",
                message: "You can file civic complaints with photos, voice input, and GPS camera tags.",
                time: "Active",
                icon: "✨",
                link: "/",
                unread: false,
            });
            notifs.push({
                id: "sys-ai",
                title: "🤖 24/7 AI Civic Assistant",
                message: "Need help? Tap the floating assistant icon in the bottom right corner anytime.",
                time: "Tip",
                icon: "💡",
                link: "/",
                unread: false,
            });
        }

        setNotifications(notifs);
    }, [isLoggedIn, user]);

    useEffect(() => {
        setIsMobileMenuOpen(false);
        setShowNotifMenu(false);
        setShowLangMenu(false);
        setShowUserMenu(false);
    }, [pathname]);

    const handleLogout = () => { logout(); router.push("/login"); };
    const isActive = (href: string) => pathname === href;

    return (
        <nav
            className="glass no-print nav-container"
            style={{
                position: "sticky", top: 0, zIndex: 100,
                borderBottom: "1px solid var(--border)",
                backdropFilter: "blur(20px) saturate(180%)",
            }}
        >
            <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "64px", padding: "0" }}>

                {/* Brand */}
                <Link
                    href={isLoggedIn ? (user?.role === "user" ? "/" : user?.role === "authority" ? "/admin" : "/chief") : "/login"}
                    style={{ display: "flex", alignItems: "center", gap: "0.75rem", textDecoration: "none" }}
                >
                    <div style={{
                        width: "34px", height: "34px", borderRadius: "10px",
                        background: "var(--grad-primary)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "white", fontSize: "1rem",
                        boxShadow: "0 4px 12px var(--primary-glow)",
                        transition: "var(--transition)",
                    }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.12) rotate(-5deg)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1) rotate(0deg)"; }}
                    >⚖</div>
                    <span className="brand-name">
                        AI Grievance <span className="gradient-text">System</span>
                    </span>
                </Link>

                {/* Right section */}
                <div className="nav-right" style={{ display: "flex", alignItems: "center" }}>

                    {/* Nav Links — hidden on mobile (bottom nav handles those) */}
                    {isLoggedIn && (
                        <div className="desktop-nav-links" style={{ display: "flex", alignItems: "center", gap: "0.15rem", overflow: "hidden" }}>
                            {user?.role === "user" && (<>
                                <NavLink href="/" active={isActive("/")}>{t("nav_home")}</NavLink>
                                <NavLink href="/track" active={isActive("/track")}>🔍 {t("nav_track")}</NavLink>
                            </>)}
                            {user?.role === "authority" && (
                                <NavLink href="/admin" active={isActive("/admin")}>🛡️ Authority Portal</NavLink>
                            )}
                            {user?.role === "chief" && (
                                <NavLink href="/chief" active={isActive("/chief")}>⭐ {t("nav_chief")}</NavLink>
                            )}
                        </div>
                    )}

                    {/* Notification bell & Interactive Panel */}
                    {isLoggedIn && (
                        <div style={{ position: "relative" }}>
                            <button
                                onClick={() => {
                                    setShowNotifMenu(p => !p);
                                    setShowLangMenu(false);
                                    setShowUserMenu(false);
                                }}
                                style={{
                                    width: "38px", height: "38px", borderRadius: "50%",
                                    border: showNotifMenu ? "1.5px solid var(--primary)" : "1.5px solid var(--border)",
                                    background: showNotifMenu ? "rgba(99,102,241,0.15)" : "var(--bg-card)",
                                    cursor: "pointer", fontSize: "1rem",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    position: "relative", transition: "var(--transition)",
                                    color: showNotifMenu ? "var(--primary)" : "var(--text-muted)",
                                }}
                                title="Notifications"
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--primary)"; (e.currentTarget as HTMLElement).style.color = "var(--primary)"; }}
                                onMouseLeave={e => { if (!showNotifMenu) { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; } }}
                            >
                                🔔
                                {/* Badge */}
                                {hasUnread && (
                                    <span style={{
                                        position: "absolute", top: "4px", right: "4px",
                                        width: "9px", height: "9px", borderRadius: "50%",
                                        background: "#ef4444",
                                        boxShadow: "0 0 0 2px var(--bg-card)",
                                    }}>
                                        <span style={{
                                            position: "absolute", inset: 0, borderRadius: "50%",
                                            background: "#ef4444",
                                            animation: "ping 1.5s ease-out infinite",
                                        }} />
                                    </span>
                                )}
                            </button>

                            {/* Notification Dropdown Panel */}
                            {showNotifMenu && (
                                <div
                                    className="glass animate-fade-in"
                                    style={{
                                        position: "absolute",
                                        top: "calc(100% + 0.6rem)",
                                        right: "-20px",
                                        width: "min(340px, 90vw)",
                                        borderRadius: "1rem",
                                        border: "1px solid var(--border)",
                                        background: "var(--bg-card, #1e293b)",
                                        boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5)",
                                        overflow: "hidden",
                                        zIndex: 250,
                                    }}
                                >
                                    {/* Header */}
                                    <div style={{
                                        padding: "0.85rem 1rem",
                                        borderBottom: "1px solid var(--border)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        background: "rgba(255, 255, 255, 0.02)",
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                                            <span style={{ fontSize: "1rem" }}>🔔</span>
                                            <span style={{ fontWeight: "700", fontSize: "0.9rem", color: "var(--text-main)" }}>Notifications</span>
                                            {hasUnread && (
                                                <span style={{
                                                    background: "#ef4444", color: "white", fontSize: "0.65rem",
                                                    padding: "0.1rem 0.45rem", borderRadius: "999px", fontWeight: "700"
                                                }}>
                                                    New
                                                </span>
                                            )}
                                        </div>
                                        {hasUnread && (
                                            <button
                                                onClick={() => setHasUnread(false)}
                                                style={{
                                                    background: "transparent", border: "none", color: "var(--primary)",
                                                    fontSize: "0.72rem", cursor: "pointer", fontWeight: "600",
                                                    padding: "0.2rem 0.4rem", borderRadius: "0.35rem",
                                                }}
                                            >
                                                Mark all read
                                            </button>
                                        )}
                                    </div>

                                    {/* Notification List */}
                                    <div style={{ maxHeight: "320px", overflowY: "auto", display: "flex", flexDirection: "column" }}>
                                        {notifications.length === 0 ? (
                                            <div style={{ padding: "2rem 1rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                                                <span style={{ fontSize: "1.5rem", display: "block", marginBottom: "0.4rem" }}>📭</span>
                                                No new notifications
                                            </div>
                                        ) : (
                                            notifications.map((item) => (
                                                <div
                                                    key={item.id}
                                                    onClick={() => {
                                                        setShowNotifMenu(false);
                                                        if (item.link) router.push(item.link);
                                                    }}
                                                    style={{
                                                        padding: "0.75rem 1rem",
                                                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                                                        cursor: item.link ? "pointer" : "default",
                                                        display: "flex",
                                                        gap: "0.75rem",
                                                        alignItems: "flex-start",
                                                        transition: "background 0.15s ease",
                                                        background: item.unread && hasUnread ? "rgba(99, 102, 241, 0.06)" : "transparent",
                                                    }}
                                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = item.unread && hasUnread ? "rgba(99, 102, 241, 0.06)" : "transparent"; }}
                                                >
                                                    <div style={{
                                                        width: "32px", height: "32px", borderRadius: "8px",
                                                        background: "rgba(99,102,241,0.15)", display: "flex",
                                                        alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0
                                                    }}>
                                                        {item.icon}
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                                                            <span style={{ fontWeight: "700", fontSize: "0.82rem", color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                                {item.title}
                                                            </span>
                                                            <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", flexShrink: 0 }}>
                                                                {item.time}
                                                            </span>
                                                        </div>
                                                        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "0.2rem 0 0 0", lineHeight: "1.3", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                                            {item.message}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* Footer */}
                                    <div style={{
                                        padding: "0.65rem 1rem",
                                        borderTop: "1px solid var(--border)",
                                        textAlign: "center",
                                        background: "rgba(255, 255, 255, 0.02)",
                                    }}>
                                        <button
                                            onClick={() => {
                                                setShowNotifMenu(false);
                                                router.push(user?.role === "user" ? "/track" : user?.role === "authority" ? "/admin" : "/chief");
                                            }}
                                            style={{
                                                background: "transparent",
                                                border: "none",
                                                color: "var(--primary)",
                                                fontSize: "0.78rem",
                                                fontWeight: "700",
                                                cursor: "pointer",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "0.3rem",
                                            }}
                                        >
                                            <span>{user?.role === "user" ? "Track All Grievances" : "View Dashboard Queue"}</span>
                                            <span>→</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Backdrop to close notification panel when clicking outside */}
                            {showNotifMenu && (
                                <div onClick={() => setShowNotifMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 199 }} />
                            )}
                        </div>
                    )}

                    {/* Language Selector — visible on both desktop & mobile for easy access */}
                    <div style={{ position: "relative" }}>
                        <button
                            onClick={() => setShowLangMenu(p => !p)}
                            style={{
                                padding: "0.35rem 0.5rem", borderRadius: "0.5rem",
                                border: "1px solid var(--border)", background: "var(--bg-card)",
                                cursor: "pointer", fontSize: "0.82rem", fontWeight: "600",
                                display: "flex", alignItems: "center", gap: "0.2rem",
                                color: "var(--text-main)", transition: "var(--transition)",
                                whiteSpace: "nowrap",
                            }}
                            title="Change Language"
                        >
                            🌐 <span className="lang-btn-text">{LANGUAGE_NAMES[lang]}</span>
                            <span style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>▾</span>
                        </button>
                        {showLangMenu && (
                            <div className="glass animate-fade-in" style={{
                                position: "absolute", top: "calc(100% + 0.5rem)", right: 0,
                                minWidth: "160px", borderRadius: "0.875rem",
                                border: "1px solid var(--border)", overflow: "hidden",
                                boxShadow: "var(--shadow-lg)", zIndex: 200,
                            }}>
                                {(Object.keys(LANGUAGE_NAMES) as Language[]).map((l) => (
                                    <button
                                        key={l}
                                        onClick={() => { setLang(l); setShowLangMenu(false); }}
                                        style={{
                                            width: "100%", padding: "0.6rem 1rem",
                                            textAlign: "left", border: "none", cursor: "pointer",
                                            fontSize: "0.85rem", fontWeight: l === lang ? "700" : "500",
                                            background: l === lang ? "linear-gradient(135deg, #6366f115, #ec489915)" : "transparent",
                                            color: l === lang ? "var(--primary)" : "var(--text-main)",
                                            display: "flex", alignItems: "center", justifyContent: "space-between",
                                            transition: "background 0.15s",
                                        }}
                                        onMouseEnter={e => { if (l !== lang) e.currentTarget.style.background = "var(--bg-main)"; }}
                                        onMouseLeave={e => { if (l !== lang) e.currentTarget.style.background = "transparent"; }}
                                    >
                                        {LANGUAGE_NAMES[l]}
                                        {l === lang && <span style={{ color: "var(--primary)" }}>✓</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                        {showLangMenu && (
                            <div onClick={() => setShowLangMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 199 }} />
                        )}
                    </div>

                    {/* Theme Toggle — visible on both desktop & mobile */}
                    <div style={{ display: "flex", alignItems: "center" }}>
                        <button
                            onClick={toggleTheme}
                            style={{
                                width: "38px", height: "38px", borderRadius: "50%",
                                border: "1px solid var(--border)",
                                background: "var(--bg-card)",
                                cursor: "pointer", fontSize: "1rem",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                transition: "var(--transition)",
                            }}
                            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--primary)"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
                        >
                            {theme === "light" ? "🌙" : "☀️"}
                        </button>
                    </div>

                    {/* Hamburger Menu Button — mobile only */}
                    {isLoggedIn && (
                        <button
                            className="mobile-only-control mobile-menu-toggle"
                            onClick={() => setIsMobileMenuOpen(p => !p)}
                            title="Toggle Menu"
                        >
                            {isMobileMenuOpen ? "✕" : "☰"}
                        </button>
                    )}


                    {/* User Avatar + Dropdown */}
                    {isLoggedIn && user ? (
                        <div style={{ position: "relative" }}>
                            <button
                                onClick={() => setShowUserMenu(p => !p)}
                                style={{
                                    display: "flex", alignItems: "center", gap: "0.5rem",
                                    padding: "0.3rem 0.3rem 0.3rem 0.3rem",
                                    borderRadius: "99px", border: "1px solid var(--border)",
                                    background: "var(--bg-card)", cursor: "pointer",
                                    transition: "var(--transition)",
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = ROLE_BADGE[user.role].color; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
                            >
                                {/* Avatar circle */}
                                <div style={{
                                    width: "30px", height: "30px", borderRadius: "50%",
                                    background: `linear-gradient(135deg, ${ROLE_BADGE[user.role].color}, ${ROLE_BADGE[user.role].color}aa)`,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: "0.7rem", fontWeight: "800", color: "white",
                                    flexShrink: 0,
                                }}>
                                    {getInitials(user.username)}
                                </div>
                                <span className="nav-btn-text" style={{ fontSize: "0.8rem", fontWeight: "700", color: ROLE_BADGE[user.role].color, paddingRight: "0.25rem" }}>
                                    {ROLE_BADGE[user.role].label}
                                </span>
                                <span style={{ fontSize: "0.6rem", color: "var(--text-muted)", paddingRight: "0.5rem" }}>▾</span>
                            </button>

                            {showUserMenu && (
                                <>
                                    <div className="glass animate-fade-in" style={{
                                        position: "absolute", top: "calc(100% + 0.5rem)", right: 0,
                                        minWidth: "180px", borderRadius: "0.875rem",
                                        border: "1px solid var(--border)",
                                        boxShadow: "var(--shadow-lg)", zIndex: 200,
                                        overflow: "hidden",
                                    }}>
                                        {/* User info */}
                                        <div style={{ padding: "0.875rem 1rem", borderBottom: "1px solid var(--border)" }}>
                                            <div style={{ fontWeight: "700", fontSize: "0.875rem" }}>{user.username}</div>
                                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>{user.email}</div>
                                        </div>
                                        {user.role === "authority" && (
                                            <Link
                                                href="/admin"
                                                onClick={() => setShowUserMenu(false)}
                                                style={{
                                                    display: "flex", alignItems: "center", gap: "0.5rem",
                                                    padding: "0.65rem 1rem", textDecoration: "none",
                                                    fontSize: "0.85rem", fontWeight: "600", color: "var(--text-main)",
                                                    borderBottom: "1px solid var(--border)",
                                                    transition: "background 0.15s",
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-main)"; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                                            >
                                                🛡️ Authority Dashboard
                                            </Link>
                                        )}
                                        {user.role === "chief" && (
                                            <Link
                                                href="/chief"
                                                onClick={() => setShowUserMenu(false)}
                                                style={{
                                                    display: "flex", alignItems: "center", gap: "0.5rem",
                                                    padding: "0.65rem 1rem", textDecoration: "none",
                                                    fontSize: "0.85rem", fontWeight: "600", color: "var(--text-main)",
                                                    borderBottom: "1px solid var(--border)",
                                                    transition: "background 0.15s",
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-main)"; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                                            >
                                                ⭐ Chief Dashboard
                                            </Link>
                                        )}
                                        {/* Logout */}
                                        <button
                                            onClick={() => { setShowUserMenu(false); handleLogout(); }}
                                            style={{
                                                width: "100%", padding: "0.7rem 1rem",
                                                border: "none", background: "transparent",
                                                textAlign: "left", cursor: "pointer",
                                                fontSize: "0.85rem", fontWeight: "600",
                                                color: "#ef4444", display: "flex", alignItems: "center", gap: "0.5rem",
                                                transition: "background 0.15s",
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.background = "#ef444412"; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                                        >
                                            🚪 {t("nav_logout")}
                                        </button>
                                    </div>
                                    <div onClick={() => setShowUserMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 199 }} />
                                </>
                            )}
                        </div>
                    ) : (
                        (() => {
                            const isAuthRoute = pathname === "/login" || pathname === "/admin-login" || pathname === "/secure-admin-access";
                            return isAuthRoute ? (
                                <Link href="/" style={{
                                    padding: "0.5rem 1.25rem", borderRadius: "0.5rem",
                                    fontWeight: "700", fontSize: "0.85rem", textDecoration: "none",
                                    border: "1px solid var(--border)", background: "var(--bg-card)",
                                    color: "var(--text-main)", transition: "var(--transition)",
                                    boxShadow: "var(--shadow-sm)"
                                }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--primary)"; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
                                >
                                    🏠 <span className="nav-btn-text">Grievance Desk</span>
                                </Link>
                            ) : (
                                <Link href="/login" className="btn btn-primary" style={{ padding: "0.5rem 1.25rem", fontSize: "0.9rem", textDecoration: "none" }}>
                                    {t("nav_login")}
                                </Link>
                            );
                        })()
                    )}
                </div>
            </div>

            {/* Mobile menu drawer */}
            {isMobileMenuOpen && isLoggedIn && user && (
                <div className="mobile-menu-drawer animate-fade-in">
                    {user.role === "user" && (
                        <>
                            <Link
                                href="/"
                                className={`mobile-menu-drawer-item${isActive("/") ? " mobile-menu-drawer-item--active" : ""}`}
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                📝 {t("nav_home")}
                            </Link>
                            <Link
                                href="/track"
                                className={`mobile-menu-drawer-item${isActive("/track") ? " mobile-menu-drawer-item--active" : ""}`}
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                🔍 {t("nav_track")}
                            </Link>
                        </>
                    )}
                    {user.role === "authority" && (
                        <Link
                            href="/admin"
                            className={`mobile-menu-drawer-item${isActive("/admin") ? " mobile-menu-drawer-item--active" : ""}`}
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            🛡️ Authority Portal
                        </Link>
                    )}
                    {user.role === "chief" && (
                        <Link
                            href="/chief"
                            className={`mobile-menu-drawer-item${isActive("/chief") ? " mobile-menu-drawer-item--active" : ""}`}
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            ⭐ {t("nav_chief")}
                        </Link>
                    )}
                </div>
            )}

            <style>{`
                @keyframes ping {
                    0%        { transform: scale(1); opacity: 0.8; }
                    75%, 100% { transform: scale(2.2); opacity: 0; }
                }
            `}</style>
        </nav>
    );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
    return (
        <Link href={href} style={{
            padding: "0.35rem 0.7rem", borderRadius: "0.5rem",
            fontWeight: "600", fontSize: "0.8rem", textDecoration: "none",
            background: active ? "var(--grad-primary)" : "transparent",
            color: active ? "white" : "var(--text-muted)",
            transition: "all 0.2s ease",
            boxShadow: active ? "0 4px 12px var(--primary-glow)" : "none",
            whiteSpace: "nowrap",
        }}
            onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.background = "var(--border-subtle)"; (e.currentTarget as HTMLElement).style.color = "var(--text-main)"; } }}
            onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; } }}
        >
            {children}
        </Link>
    );
}
