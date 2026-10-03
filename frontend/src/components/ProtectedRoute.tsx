"use client";

import { useAuth, UserRole } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, ReactNode } from "react";
import Link from "next/link";

interface ProtectedRouteProps {
    children: ReactNode;
    allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
    const { isLoggedIn, isLoading, user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (isLoading) return;

        if (!isLoggedIn) {
            router.replace("/login");
            return;
        }

        if (allowedRoles && user && !allowedRoles.includes(user.role)) {
            if (user.role === "authority") router.replace("/admin");
            else if (user.role === "chief") router.replace("/chief");
            else router.replace("/");
        }
    }, [isLoading, isLoggedIn, user, allowedRoles, router]);

    if (isLoading) {
        return (
            <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
                <div style={{ fontSize: "2rem", animation: "spin 1s linear infinite" }}>🔄</div>
                <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", fontWeight: "600" }}>Verifying access credentials...</p>
            </div>
        );
    }

    if (!isLoggedIn) {
        return null;
    }

    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
        return (
            <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", textAlign: "center", padding: "2rem" }}>
                <div style={{ fontSize: "2.5rem" }}>🛡️</div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: "800" }}>Redirecting to Your Portal...</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", maxWidth: "400px" }}>
                    You are logged in as <strong>{user.username}</strong> ({user.role}). Taking you to your dashboard now.
                </p>
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                    {user.role === "authority" && (
                        <Link href="/admin" className="btn btn-primary" style={{ textDecoration: "none", padding: "0.5rem 1.25rem", borderRadius: "0.5rem", fontSize: "0.85rem" }}>
                            Go to Authority Portal →
                        </Link>
                    )}
                    {user.role === "chief" && (
                        <Link href="/chief" className="btn btn-primary" style={{ textDecoration: "none", padding: "0.5rem 1.25rem", borderRadius: "0.5rem", fontSize: "0.85rem" }}>
                            Go to Chief Admin Portal →
                        </Link>
                    )}
                    {user.role === "user" && (
                        <Link href="/" className="btn btn-primary" style={{ textDecoration: "none", padding: "0.5rem 1.25rem", borderRadius: "0.5rem", fontSize: "0.85rem" }}>
                            Go to Citizen Portal →
                        </Link>
                    )}
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
