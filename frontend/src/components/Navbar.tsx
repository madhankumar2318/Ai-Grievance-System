"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useLang, LANGUAGE_NAMES, Language } from "@/context/LanguageContext";
import { useState, useEffect, Suspense } from "react";
import { getOfficerNotificationsServerAction } from "@/app/actions/complaintActions";

const ROLE_BADGE = {
    user: { label: "Citizen", labelKey: "role_citizen" as const, color: "#6366f1", bg: "#6366f115" },
    authority: { label: "Authority", labelKey: "role_authority" as const, color: "#f97316", bg: "#f9731615" },
    chief: { label: "Chief", labelKey: "role_chief" as const, color: "#ec4899", bg: "#ec489915" },
};

function getInitials(username: string) {
    return username.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function NavbarContent() {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentTab = searchParams?.get("tab");
    const { user, isLoggedIn, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { lang, setLang, t } = useLang();
    const [showLangMenu, setShowLangMenu] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showNotifMenu, setShowNotifMenu] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);
    const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; time: string; icon: string; link?: string; unread: boolean; }[]>([]);

    useEffect(() => {
        if (!isLoggedIn || !user) {
            setNotifications([]);
            setHasUnread(false);
            return;
        }

        let isMounted = true;

        const loadNotifications = async () => {
            const notifs: { id: string; title: string; message: string; time: string; icon: string; link?: string; unread: boolean; }[] = [];
            let unreadFound = false;

            if (user.role === "user") {
                if (typeof window !== "undefined") {
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
                                if (idx === 0) unreadFound = true;
                            });
                        }
                    } catch {}
                }
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
                if (isMounted) {
                    setNotifications(notifs);
                    setHasUnread(unreadFound);
                }
            } else if (user.role === "authority") {
                const officerEmail = (user.email || "").toLowerCase().trim();
                const officerKey = `officer_notifications_${officerEmail}`;

                // 1. Fast-path: Synchronously load locally cached assignments for instant 0ms render
                if (typeof window !== "undefined") {
                    try {
                        const localCached = JSON.parse(localStorage.getItem(officerKey) || "[]");
                        if (Array.isArray(localCached) && localCached.length > 0) {
                            localCached.forEach((item: any) => {
                                notifs.push(item);
                                if (item.unread) unreadFound = true;
                            });
                        }
                    } catch {}
                }

                // Default district baseline info
                const baseNotifs = [
                    {
                        id: "auth-district",
                        title: "🛡️ District Queue Active",
                        message: `Assigned to ${user.district || "Tiruchirappalli"} District queue. New complaints will appear automatically.`,
                        time: "Live",
                        icon: "🏛️",
                        link: "/admin",
                        unread: false,
                    },
                    {
                        id: "auth-triage",
                        title: "⚡ AI Triage Engine",
                        message: "Complaints are automatically prioritized (Critical, High, Medium, Low).",
                        time: "System",
                        icon: "🤖",
                        link: "/admin",
                        unread: false,
                    }
                ];

                if (isMounted && notifs.length > 0) {
                    setNotifications([...notifs, ...baseNotifs]);
                    setHasUnread(unreadFound);
                }

                // 2. Fetch live from server action (scans database for Collector assignments & directives)
                try {
                    const res = await getOfficerNotificationsServerAction();
                    if (isMounted && res.success && res.notifications) {
                        const serverNotifs = res.notifications.map(n => ({
                            id: n.id,
                            title: n.title,
                            message: n.message,
                            time: n.time,
                            icon: n.icon,
                            link: n.link,
                            unread: n.unread,
                        }));

                        // Save fresh notifications to local cache
                        if (typeof window !== "undefined") {
                            try {
                                localStorage.setItem(officerKey, JSON.stringify(serverNotifs));
                            } catch {}
                        }

                        const combined = [...serverNotifs, ...baseNotifs];
                        setNotifications(combined);
                        setHasUnread(res.hasUnread || serverNotifs.some(n => n.unread));
                    }
                } catch (err) {
                    console.error("Error loading live officer notifications:", err);
                    if (isMounted && notifs.length === 0) {
                        setNotifications(baseNotifs);
                    }
                }
            } else if (user.role === "chief") {
                notifs.push({
                    id: "chief-oversight",
                    title: "⭐ Chief Oversight Dashboard",
                    message: "System-wide analytics, department resolution rates, and SLA metrics are synced.",
                    time: "Live",
                    icon: "📊",
                    link: "/chief",
                    unread: true,
                });
                if (isMounted) {
                    setNotifications(notifs);
                    setHasUnread(true);
                }
            }
        };

        loadNotifications();

        // Listen for realtime assignment & update events
        const handleOfficerAssigned = () => {
            loadNotifications();
        };

        const handleStorageChange = (e: StorageEvent) => {
            if (e.key && (e.key.startsWith("officer_notifications") || e.key === "last_officer_assignment" || e.key === "cached_admin_complaints")) {
                loadNotifications();
            }
        };

        window.addEventListener("officer_assigned_notification", handleOfficerAssigned);
        window.addEventListener("complaints_updated", handleOfficerAssigned);
        window.addEventListener("storage", handleStorageChange);
        window.addEventListener("focus", loadNotifications);

        const pollTimer = setInterval(loadNotifications, 12000);

        return () => {
            isMounted = false;
            window.removeEventListener("officer_assigned_notification", handleOfficerAssigned);
            window.removeEventListener("complaints_updated", handleOfficerAssigned);
            window.removeEventListener("storage", handleStorageChange);
            window.removeEventListener("focus", loadNotifications);
            clearInterval(pollTimer);
        };
    }, [isLoggedIn, user]);

    useEffect(() => {
        setShowNotifMenu(false);
        setShowLangMenu(false);
        setShowUserMenu(false);
    }, [pathname]);

    const handleLogout = () => { logout(); router.push("/login"); };
    const isActive = (href: string) => pathname === href;

    const roleStr = `${user?.authorityRole || ""} ${user?.department || ""} ${user?.username || ""} ${user?.email || ""}`.toLowerCase();
    const isDistrictHead =
        roleStr.includes("collector") ||
        roleStr.includes("magistrate") ||
        roleStr.includes("commissioner") ||
        user?.role === "chief";

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
                        <div className="desktop-nav-links" style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
                            {user?.role === "authority" && (
                                <>
                                    <NavLink href="/admin" active={isActive("/admin")}>🛡️ {t("nav_authority_portal")}</NavLink>
                                    {isDistrictHead && (
                                        <NavLink href="/admin/officers" active={isActive("/admin/officers")}>👥 {t("nav_district_officers")}</NavLink>
                                    )}
                                </>
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
                                <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                                    🔔
                                    {/* Badge */}
                                    {hasUnread && (
                                        <span style={{
                                            position: "absolute", top: "-1px", right: "-1px",
                                            width: "8px", height: "8px", borderRadius: "50%",
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
                                </span>
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
                                            <span style={{ fontWeight: "700", fontSize: "0.9rem", color: "var(--text-main)" }}>{t("nav_notifications")}</span>
                                            {hasUnread && (
                                                <span style={{
                                                    background: "#ef4444", color: "white", fontSize: "0.65rem",
                                                    padding: "0.1rem 0.45rem", borderRadius: "999px", fontWeight: "700"
                                                }}>
                                                    {t("nav_new")}
                                                </span>
                                            )}
                                        </div>
                                        {hasUnread && (
                                            <button
                                                onClick={() => {
                                                    setHasUnread(false);
                                                    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
                                                    if (typeof window !== "undefined" && user?.email) {
                                                        try {
                                                            const officerKey = `officer_notifications_${user.email.toLowerCase().trim()}`;
                                                            const cached = JSON.parse(localStorage.getItem(officerKey) || "[]");
                                                            const updated = cached.map((n: any) => ({ ...n, unread: false }));
                                                            localStorage.setItem(officerKey, JSON.stringify(updated));
                                                        } catch {}
                                                    }
                                                }}
                                                style={{
                                                    background: "transparent", border: "none", color: "var(--primary)",
                                                    fontSize: "0.72rem", cursor: "pointer", fontWeight: "600",
                                                    padding: "0.2rem 0.4rem", borderRadius: "0.35rem",
                                                }}
                                            >
                                                {t("nav_mark_all_read")}
                                            </button>
                                        )}
                                    </div>

                                    {/* Notification List */}
                                    <div style={{ maxHeight: "320px", overflowY: "auto", display: "flex", flexDirection: "column" }}>
                                        {notifications.length === 0 ? (
                                            <div style={{ padding: "2rem 1rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                                                <span style={{ fontSize: "1.5rem", display: "block", marginBottom: "0.4rem" }}>📭</span>
                                                {t("nav_no_notifications")}
                                            </div>
                                        ) : (
                                            notifications.map((item) => (
                                                <div
                                                    key={item.id}
                                                    onClick={() => {
                                                        setShowNotifMenu(false);
                                                        setNotifications(prev => {
                                                            const updated = prev.map(n => n.id === item.id ? { ...n, unread: false } : n);
                                                            if (!updated.some(n => n.unread)) {
                                                                setHasUnread(false);
                                                            }
                                                            return updated;
                                                        });
                                                        if (typeof window !== "undefined" && user?.email) {
                                                            try {
                                                                const officerKey = `officer_notifications_${user.email.toLowerCase().trim()}`;
                                                                const cached = JSON.parse(localStorage.getItem(officerKey) || "[]");
                                                                const updated = cached.map((n: any) => n.id === item.id ? { ...n, unread: false } : n);
                                                                localStorage.setItem(officerKey, JSON.stringify(updated));
                                                            } catch {}
                                                        }
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
                                            <span>{user?.role === "user" ? (lang === "ta" ? "அனைத்து புகார்களையும் கண்காணிக்கவும்" : "Track All Grievances") : (lang === "ta" ? "டாஷ்போர்டு வரிசையைக் காண்க" : "View Dashboard Queue")}</span>
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

                    {/* User Avatar + Unified Navigation Dropdown */}
                    {isLoggedIn && user ? (
                        <div style={{ position: "relative" }}>
                            <button
                                onClick={() => setShowUserMenu(p => !p)}
                                style={{
                                    display: "flex", alignItems: "center", gap: "0.5rem",
                                    padding: "0.3rem 0.45rem 0.3rem 0.3rem",
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
                                    fontSize: "0.72rem", fontWeight: "800", color: "white",
                                    flexShrink: 0,
                                }}>
                                    {getInitials(user.username)}
                                </div>
                                <span className="nav-btn-text" style={{ fontSize: "0.8rem", fontWeight: "700", color: ROLE_BADGE[user.role].color, paddingRight: "0.25rem" }}>
                                    {t(ROLE_BADGE[user.role].labelKey)}
                                </span>
                                <span style={{ fontSize: "0.6rem", color: "var(--text-muted)", paddingRight: "0.25rem" }}>▾</span>
                            </button>

                            {showUserMenu && (
                                <>
                                    <div className="glass animate-fade-in" style={{
                                        position: "absolute", top: "calc(100% + 0.5rem)", right: 0,
                                        minWidth: "220px", borderRadius: "0.875rem",
                                        border: "1px solid var(--border)",
                                        boxShadow: "var(--shadow-xl)", zIndex: 200,
                                        overflow: "hidden",
                                        background: "var(--bg-card)",
                                    }}>
                                        {/* User info header */}
                                        <div style={{ padding: "0.875rem 1rem", borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
                                            <div style={{ fontWeight: "800", fontSize: "0.9rem", color: "var(--text-main)" }}>{user.username}</div>
                                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.15rem", wordBreak: "break-all" }}>{user.email}</div>
                                            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", marginTop: "0.4rem", padding: "0.15rem 0.5rem", borderRadius: "99px", background: `${ROLE_BADGE[user.role].color}18`, color: ROLE_BADGE[user.role].color, fontSize: "0.7rem", fontWeight: "700", border: `1px solid ${ROLE_BADGE[user.role].color}30` }}>
                                                {t(ROLE_BADGE[user.role].labelKey)}
                                            </div>
                                        </div>

                                        {/* Navigation Links */}
                                        <div style={{ padding: "0.35rem 0", borderBottom: "1px solid var(--border)" }}>
                                            {user.role === "user" && (
                                                <>
                                                    {/* My Profile */}
                                                    <Link
                                                        href="/profile"
                                                        onClick={() => setShowUserMenu(false)}
                                                        style={{
                                                            display: "flex", alignItems: "center", gap: "0.6rem",
                                                            padding: "0.6rem 1rem", textDecoration: "none",
                                                            fontSize: "0.85rem", fontWeight: pathname === "/profile" ? "700" : "600",
                                                            color: pathname === "/profile" ? "var(--primary)" : "var(--text-main)",
                                                            background: pathname === "/profile" ? "rgba(99,102,241,0.12)" : "transparent",
                                                            transition: "background 0.15s",
                                                        }}
                                                        onMouseEnter={e => { if (pathname !== "/profile") (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
                                                        onMouseLeave={e => { if (pathname !== "/profile") (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                                                    >
                                                        <span>👤</span>
                                                        <span>{t("nav_my_profile")}</span>
                                                    </Link>

                                                    {/* File Complaint */}
                                                    <Link
                                                        href="/"
                                                        onClick={() => setShowUserMenu(false)}
                                                        style={{
                                                            display: "flex", alignItems: "center", gap: "0.6rem",
                                                            padding: "0.6rem 1rem", textDecoration: "none",
                                                            fontSize: "0.85rem", fontWeight: pathname === "/" ? "700" : "600",
                                                            color: pathname === "/" ? "var(--primary)" : "var(--text-main)",
                                                            background: pathname === "/" ? "rgba(99,102,241,0.12)" : "transparent",
                                                            transition: "background 0.15s",
                                                        }}
                                                        onMouseEnter={e => { if (pathname !== "/") (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
                                                        onMouseLeave={e => { if (pathname !== "/") (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                                                    >
                                                        <span>📝</span>
                                                        <span>{t("nav_home")}</span>
                                                    </Link>

                                                    {/* Track */}
                                                    <Link
                                                        href="/track"
                                                        onClick={() => setShowUserMenu(false)}
                                                        style={{
                                                            display: "flex", alignItems: "center", gap: "0.6rem",
                                                            padding: "0.6rem 1rem", textDecoration: "none",
                                                            fontSize: "0.85rem", fontWeight: pathname === "/track" ? "700" : "600",
                                                            color: pathname === "/track" ? "var(--primary)" : "var(--text-main)",
                                                            background: pathname === "/track" ? "rgba(99,102,241,0.12)" : "transparent",
                                                            transition: "background 0.15s",
                                                        }}
                                                        onMouseEnter={e => { if (pathname !== "/track") (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
                                                        onMouseLeave={e => { if (pathname !== "/track") (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                                                    >
                                                        <span>🔍</span>
                                                        <span>{t("nav_track")}</span>
                                                    </Link>

                                                    {/* My Grievances */}
                                                    <Link
                                                        href="/my-grievances"
                                                        onClick={() => setShowUserMenu(false)}
                                                        style={{
                                                            display: "flex", alignItems: "center", gap: "0.6rem",
                                                            padding: "0.6rem 1rem", textDecoration: "none",
                                                            fontSize: "0.85rem", fontWeight: pathname === "/my-grievances" ? "700" : "600",
                                                            color: pathname === "/my-grievances" ? "var(--primary)" : "var(--text-main)",
                                                            background: pathname === "/my-grievances" ? "rgba(99,102,241,0.12)" : "transparent",
                                                            transition: "background 0.15s",
                                                        }}
                                                        onMouseEnter={e => { if (pathname !== "/my-grievances") (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
                                                        onMouseLeave={e => { if (pathname !== "/my-grievances") (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                                                    >
                                                        <span>📋</span>
                                                        <span>{t("nav_my_grievances")}</span>
                                                    </Link>
                                                </>
                                            )}

                                            {user.role === "authority" && (
                                                <>
                                                    <Link
                                                        href="/profile"
                                                        onClick={() => setShowUserMenu(false)}
                                                        style={{
                                                            display: "flex", alignItems: "center", gap: "0.6rem",
                                                            padding: "0.6rem 1rem", textDecoration: "none",
                                                            fontSize: "0.85rem", fontWeight: pathname === "/profile" ? "700" : "600",
                                                            color: pathname === "/profile" ? "var(--primary)" : "var(--text-main)",
                                                            background: pathname === "/profile" ? "rgba(99,102,241,0.12)" : "transparent",
                                                            transition: "background 0.15s",
                                                        }}
                                                    >
                                                        <span>👤</span>
                                                        <span>{t("nav_my_profile")}</span>
                                                    </Link>

                                                    <Link
                                                        href="/admin"
                                                        className="mobile-only-control"
                                                        onClick={() => setShowUserMenu(false)}
                                                        style={{
                                                            alignItems: "center", gap: "0.6rem",
                                                            padding: "0.6rem 1rem", textDecoration: "none",
                                                            fontSize: "0.85rem", fontWeight: pathname === "/admin" ? "700" : "600",
                                                            color: pathname === "/admin" ? "var(--primary)" : "var(--text-main)",
                                                            background: pathname === "/admin" ? "rgba(99,102,241,0.12)" : "transparent",
                                                            transition: "background 0.15s",
                                                        }}
                                                    >
                                                        <span>🛡️</span>
                                                        <span>{t("nav_authority_portal")}</span>
                                                    </Link>
                                                    {isDistrictHead && (
                                                        <Link
                                                            href="/admin/officers"
                                                            className="mobile-only-control"
                                                            onClick={() => setShowUserMenu(false)}
                                                            style={{
                                                                alignItems: "center", gap: "0.6rem",
                                                                padding: "0.6rem 1rem", textDecoration: "none",
                                                                fontSize: "0.85rem", fontWeight: pathname === "/admin/officers" ? "700" : "600",
                                                                color: pathname === "/admin/officers" ? "var(--primary)" : "var(--text-main)",
                                                                background: pathname === "/admin/officers" ? "rgba(99,102,241,0.12)" : "transparent",
                                                                transition: "background 0.15s",
                                                            }}
                                                        >
                                                            <span>👥</span>
                                                            <span>{t("nav_district_officers")}</span>
                                                        </Link>
                                                    )}
                                                </>
                                            )}

                                            {user.role === "chief" && (
                                                <>
                                                    <Link
                                                        href="/profile"
                                                        onClick={() => setShowUserMenu(false)}
                                                        style={{
                                                            display: "flex", alignItems: "center", gap: "0.6rem",
                                                            padding: "0.6rem 1rem", textDecoration: "none",
                                                            fontSize: "0.85rem", fontWeight: pathname === "/profile" ? "700" : "600",
                                                            color: pathname === "/profile" ? "var(--primary)" : "var(--text-main)",
                                                            background: pathname === "/profile" ? "rgba(99,102,241,0.12)" : "transparent",
                                                            transition: "background 0.15s",
                                                        }}
                                                    >
                                                        <span>👤</span>
                                                        <span>{t("nav_my_profile")}</span>
                                                    </Link>

                                                    <Link
                                                        href="/chief"
                                                        className="mobile-only-control"
                                                        onClick={() => setShowUserMenu(false)}
                                                        style={{
                                                            alignItems: "center", gap: "0.6rem",
                                                            padding: "0.6rem 1rem", textDecoration: "none",
                                                            fontSize: "0.85rem", fontWeight: pathname === "/chief" ? "700" : "600",
                                                            color: pathname === "/chief" ? "var(--primary)" : "var(--text-main)",
                                                            background: pathname === "/chief" ? "rgba(99,102,241,0.12)" : "transparent",
                                                            transition: "background 0.15s",
                                                        }}
                                                    >
                                                        <span>⭐</span>
                                                        <span>{t("nav_chief")}</span>
                                                    </Link>
                                                </>
                                            )}
                                        </div>

                                        {/* Logout Button */}
                                        <button
                                            onClick={() => { setShowUserMenu(false); handleLogout(); }}
                                            style={{
                                                width: "100%", padding: "0.7rem 1rem",
                                                border: "none", background: "transparent",
                                                textAlign: "left", cursor: "pointer",
                                                fontSize: "0.85rem", fontWeight: "600",
                                                color: "#ef4444", display: "flex", alignItems: "center", gap: "0.6rem",
                                                transition: "background 0.15s",
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.background = "#ef444412"; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                                        >
                                            <span>🚪</span>
                                            <span>{t("nav_logout")}</span>
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
            padding: "0.4rem 0.8rem", borderRadius: "0.55rem",
            fontWeight: "600", fontSize: "0.825rem", textDecoration: "none",
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

export default function Navbar() {
    return (
        <Suspense fallback={<nav style={{ height: "64px" }} />}>
            <NavbarContent />
        </Suspense>
    );
}
