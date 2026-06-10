"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type UserRole = "user" | "authority" | "chief";

interface AuthUser {
    username: string;
    email: string;
    role: UserRole;
}

interface AuthContextType {
    user: AuthUser | null;
    isLoggedIn: boolean;
    login: (user: AuthUser) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);

    useEffect(() => {
        const stored = localStorage.getItem("grievance_user");
        if (stored) {
            try {
                setUser(JSON.parse(stored));
            } catch {
                localStorage.removeItem("grievance_user");
            }
        }
    }, []);

    const login = (authUser: AuthUser) => {
        setUser(authUser);
        // Only store safe metadata — NO passwords ever stored here
        localStorage.setItem("grievance_user", JSON.stringify({
            username: authUser.username,
            email: authUser.email,
            role: authUser.role,
        }));
    };

    const logout = async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST" });
        } catch (err) {
            console.error("Error clearing session cookie:", err);
        }
        setUser(null);
        localStorage.removeItem("grievance_user");
    };

    return (
        <AuthContext.Provider value={{ user, isLoggedIn: !!user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
