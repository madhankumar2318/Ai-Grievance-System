"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

import { getVerifiedSessionServerAction, logoutServerAction } from "@/app/actions/authActions";

export type UserRole = "user" | "authority" | "chief";

export interface AuthUser {
    username: string;
    email: string;
    role: UserRole;
    state?: string;
    district?: string;
    authorityRole?: string;
    serviceId?: string;
    workingPlace?: string;
    phone?: string;
    department?: string;
}

interface AuthContextType {
    user: AuthUser | null;
    isLoggedIn: boolean;
    isLoading: boolean;
    login: (user: AuthUser) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Authenticate with server-signed HTTP-only cookie as authoritative source of truth
        getVerifiedSessionServerAction()
            .then((res) => {
                if (res.authenticated && res.user) {
                    setUser(res.user);
                    localStorage.setItem("grievance_user", JSON.stringify(res.user));
                } else {
                    setUser(null);
                    localStorage.removeItem("grievance_user");
                }
            })
            .catch(() => {
                // Fallback to cached metadata if offline, but without elevated privilege minting
                const stored = localStorage.getItem("grievance_user");
                if (stored) {
                    try {
                        const parsed = JSON.parse(stored);
                        if (parsed && parsed.role) setUser(parsed);
                    } catch {
                        localStorage.removeItem("grievance_user");
                    }
                }
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, []);

    const login = (authUser: AuthUser) => {
        setUser(authUser);
        // Store full non-sensitive metadata (no passwords)
        localStorage.setItem("grievance_user", JSON.stringify(authUser));
    };

    const logout = async () => {
        try {
            await logoutServerAction();
        } catch (err) {
            console.error("Error clearing auth cookie:", err);
        }
        try {
            await fetch("/api/auth/logout", { method: "POST" });
        } catch {}
        setUser(null);
        localStorage.removeItem("grievance_user");
    };

    return (
        <AuthContext.Provider value={{ user, isLoggedIn: !!user, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
