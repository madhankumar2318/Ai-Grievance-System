"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function MobileBottomNav() {
    const pathname = usePathname();
    const { isLoggedIn, user } = useAuth();

    if (!isLoggedIn || !user) return null;

    const isActive = (href: string) => pathname === href;

    const tabs =
        user.role === "user"
            ? [
                { href: "/", icon: "📝", label: "File" },
                { href: "/track", icon: "🔍", label: "Track" },
            ]
            : user.role === "authority"
            ? [{ href: "/admin", icon: "🏛️", label: "Admin" }]
            : user.role === "chief"
            ? [
                { href: "/admin", icon: "🏛️", label: "Admin" },
                { href: "/chief", icon: "⭐", label: "Chief" },
            ]
            : [];

    if (tabs.length === 0) return null;

    return (
        <nav
            className="mobile-bottom-nav"
            aria-label="Mobile navigation"
        >
            {tabs.map((tab) => (
                <Link
                    key={tab.href}
                    href={tab.href}
                    className={`mobile-tab${isActive(tab.href) ? " mobile-tab--active" : ""}`}
                >
                    <span className="mobile-tab__icon">{tab.icon}</span>
                    <span className="mobile-tab__label">{tab.label}</span>
                    {isActive(tab.href) && <span className="mobile-tab__indicator" />}
                </Link>
            ))}
        </nav>
    );
}
