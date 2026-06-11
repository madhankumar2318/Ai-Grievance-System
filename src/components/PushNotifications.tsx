"use client";

import { useState, useEffect, useCallback } from "react";
import { useLang } from "@/context/LanguageContext";

export function usePushNotifications() {
    const [permission, setPermission] = useState<NotificationPermission>("default");
    const [swRegistered, setSwRegistered] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined" && "Notification" in window) {
            setTimeout(() => {
                setPermission(Notification.permission);
            }, 0);
        }
        // Register service worker
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker
                .register("/sw.js")
                .then((reg) => {
                    setSwRegistered(true);
                    console.log("[SW] Registered:", reg.scope);
                })
                .catch((err) => console.warn("[SW] Registration failed:", err));
        }
    }, []);

    const requestPermission = useCallback(async () => {
        if (!("Notification" in window)) return false;
        const result = await Notification.requestPermission();
        setPermission(result);
        return result === "granted";
    }, []);

    const sendLocalNotification = useCallback((title: string, body: string, url = "/track") => {
        if (permission !== "granted") return;
        if ("serviceWorker" in navigator && swRegistered) {
            navigator.serviceWorker.ready.then((reg) => {
                reg.showNotification(title, {
                    body,
                    icon: "/favicon.ico",
                    tag: "grievance-update-" + Date.now(),
                    data: { url },
                });
            });
        } else {
            new Notification(title, { body, icon: "/favicon.ico" });
        }
    }, [permission, swRegistered]);

    return { permission, requestPermission, sendLocalNotification };
}

/* ── Banner component shown on complaint & track pages ── */
export function NotificationBanner({ complaintId }: { complaintId?: string }) {
    const { t } = useLang();
    const { permission, requestPermission, sendLocalNotification } = usePushNotifications();
    const [dismissed, setDismissed] = useState(false);
    const [requesting, setRequesting] = useState(false);
    const [justEnabled, setJustEnabled] = useState(false);

    if (dismissed || permission === "denied") return null;

    const handleEnable = async () => {
        setRequesting(true);
        const granted = await requestPermission();
        setRequesting(false);
        if (granted) {
            setJustEnabled(true);
            // Fire a demo notification
            setTimeout(() => {
                sendLocalNotification(
                    t("notif_title"),
                    complaintId
                        ? `Your complaint ${complaintId} is now being reviewed by our team.`
                        : "You will now receive real-time updates on your grievances.",
                    "/track"
                );
            }, 1500);
        }
    };

    if (permission === "granted") {
        if (!justEnabled) return null;
        return (
            <div className="animate-fade-in" style={{
                padding: "0.7rem 1.2rem", borderRadius: "0.75rem",
                background: "#10b98115", border: "1px solid #10b98144",
                display: "flex", alignItems: "center", gap: "0.6rem",
                fontSize: "0.82rem", color: "#10b981", fontWeight: "600",
                marginBottom: "1rem",
            }}>
                ✅ Notifications enabled! You&apos;ll be alerted on status changes.
                <button onClick={() => setJustEnabled(false)} style={{ marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer", color: "#10b981", fontSize: "1rem" }}>✕</button>
            </div>
        );
    }

    return (
        <div className="animate-fade-in" style={{
            padding: "0.8rem 1.2rem", borderRadius: "0.75rem",
            background: "linear-gradient(135deg, #6366f115, #ec489915)",
            border: "1px solid #6366f133",
            display: "flex", alignItems: "center", gap: "0.75rem",
            flexWrap: "wrap", marginBottom: "1rem",
        }}>
            <span style={{ fontSize: "1.1rem" }}>🔔</span>
            <span style={{ fontSize: "0.82rem", color: "var(--text-main)", fontWeight: "600", flex: 1 }}>
                Get instant alerts when your complaint status changes
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                    onClick={handleEnable}
                    disabled={requesting}
                    style={{
                        padding: "0.4rem 1rem", borderRadius: "0.5rem",
                        background: "linear-gradient(135deg, #6366f1, #ec4899)",
                        border: "none", cursor: "pointer", color: "white",
                        fontWeight: "700", fontSize: "0.8rem", opacity: requesting ? 0.7 : 1,
                    }}
                >
                    {requesting ? "Enabling…" : t("notif_enable")}
                </button>
                <button onClick={() => setDismissed(true)}
                    style={{ padding: "0.4rem 0.6rem", borderRadius: "0.5rem", background: "transparent", border: "1px solid var(--border)", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.8rem" }}
                >
                    Later
                </button>
            </div>
        </div>
    );
}
