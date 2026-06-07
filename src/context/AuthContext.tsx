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

// Mock credentials for demo
export const MOCK_CREDENTIALS = [
    { email: "user@demo.com", password: "user123", username: "Rahul Sharma", role: "user" as UserRole },
    { email: "authority@demo.com", password: "auth123", username: "Officer Priya", role: "authority" as UserRole },
    { email: "chief@demo.com", password: "chief123", username: "Chief Kumar", role: "chief" as UserRole },
];

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
        localStorage.setItem("grievance_user", JSON.stringify(authUser));
    };

    const logout = () => {
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
