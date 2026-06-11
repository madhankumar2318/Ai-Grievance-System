"use client";

import { useState, useRef, useEffect } from "react";
import { useLang } from "@/context/LanguageContext";

interface Message {
    role: "user" | "bot";
    text: string;
}

const BOT_RESPONSES: Record<string, string> = {
    water: "🚰 For water-related issues (contamination, supply shortage, leakage), please file under **Environment** category. Include your exact location and photos if possible. These are treated as High priority.",
    pothole: "🚧 Potholes fall under **Infrastructure** category. GPS photo evidence is very helpful! Our AI auto-assigns it to the Road Maintenance dept.",
    light: "💡 Street light issues go under **Infrastructure**. Mention the exact pole number or nearby landmark for faster resolution.",
    garbage: "🗑️ Garbage/waste issues fall under **Environment**. Include photos and GPS location. Usually resolved within 48 hours.",
    parking: "🚗 Illegal parking complaints go under **Safety**. Note the vehicle numbers and location with time.",
    hospital: "🏥 Hospital and healthcare issues are categorized as **Public Health** — these are given High/Critical priority immediately.",
    noise: "🔊 Noise pollution complaints go under **Environment**. Note the time and source of noise.",
    status: "📋 To check your complaint status, click **Track** in the navigation, then enter your GRV tracking ID. You'll see a full timeline of your complaint.",
    long: "⏱️ Resolution times vary by priority: Critical (24-48 hrs), High (3-5 days), Medium (7-10 days), Low (14+ days). You'll get browser notifications on status changes.",
    file: "📝 To file a complaint:\n1️⃣ Fill the Subject field\n2️⃣ Describe the issue in detail\n3️⃣ Add your location or use GPS Camera\n4️⃣ Upload photos/videos (optional)\n5️⃣ Click Submit — AI will triage it instantly!",
    voice: "🎙️ Yes! Click the **Voice Input** button on the complaint form, speak your issue, and the text will be filled automatically. No typing needed!",
    photo: "📸 Click **AI Analyze Photo** after uploading an image. Our AI will read what's in the photo and auto-fill the Subject and Category fields!",
    track: "🔍 Use your GRV- tracking ID (shown after submission) on the Track page. You can also enable browser notifications to get automatic status alerts.",
    login: "🔐 Demo credentials:\n• Citizen: user@demo.com / user123\n• Officer: authority@demo.com / auth123\n• Chief: chief@demo.com / chief123",
    hi: "👋 Hello! I'm here to help you with grievance filing. You can ask me about filing complaints, tracking status, or any category-specific info!",
    hello: "👋 Hello! I'm here to help you with grievance filing. You can ask me about filing complaints, tracking status, or any category-specific info!",
    namaste: "🙏 Namaste! I'm here to help you. Ask me about filing complaints, tracking status, or how our AI system works!",
};

function getBotReply(input: string): string {
    const lower = input.toLowerCase();
    for (const [keyword, reply] of Object.entries(BOT_RESPONSES)) {
        if (lower.includes(keyword)) return reply;
    }
    if (lower.includes("air") || lower.includes("pollution") || lower.includes("smoke")) {
        return "🏭 Air pollution complaints go under **Environment — Critical**. Include factory name/location and time of occurrence. Our AI escalates these immediately.";
    }
    if (lower.includes("road") || lower.includes("accident")) {
        return "🚦 Road safety issues fall under **Infrastructure** or **Safety** categories. Include exact location (GPS photo recommended) and time.";
    }
    if (lower.includes("electric") || lower.includes("power") || lower.includes("current")) {
        return "⚡ Power/electricity issues go under **Infrastructure**. Mention your area, consumer number if possible, and duration of the outage.";
    }
    return "🤔 I'm not sure about that specific query. Try asking about:\n• How to file a complaint\n• Water/road/hospital/pollution issues\n• Tracking your complaint status\n• Voice input or photo analysis features\n• Login credentials";
}

export default function ChatbotAssistant() {
    const { t } = useLang();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [hasNew, setHasNew] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setTimeout(() => {
                setMessages([{ role: "bot", text: t("chat_greeting") }]);
            }, 0);
        }
        if (isOpen) {
            setTimeout(() => {
                setHasNew(false);
            }, 0);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, messages.length, t]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    const sendMessage = () => {
        const text = input.trim();
        if (!text) return;
        setMessages((prev) => [...prev, { role: "user", text }]);
        setInput("");
        setIsTyping(true);
        setTimeout(() => {
            const reply = getBotReply(text);
            setMessages((prev) => [...prev, { role: "bot", text: reply }]);
            setIsTyping(false);
            if (!isOpen) setHasNew(true);
        }, 800 + Math.random() * 500);
    };

    const renderText = (text: string) => {
        return text.split("\n").map((line, i) => (
            <span key={i}>
                {line.split(/\*\*(.*?)\*\*/g).map((part, j) =>
                    j % 2 === 1 ? <strong key={j}>{part}</strong> : part
                )}
                {i < text.split("\n").length - 1 && <br />}
            </span>
        ));
    };

    const quickChips = ["How to file?", "Track status", "Water issue", "Login help"];

    return (
        <>
            {/* Floating Bubble */}
            <button
                onClick={() => setIsOpen((p) => !p)}
                style={{
                    position: "fixed", bottom: "2rem", right: "2rem", zIndex: 9999,
                    width: "64px", height: "64px", borderRadius: "50%",
                    background: "linear-gradient(135deg, #6366f1, #ec4899)",
                    border: "none", cursor: "pointer",
                    boxShadow: isOpen ? "0 8px 30px rgba(99,102,241,0.4)" : "0 8px 32px rgba(99,102,241,0.6), 0 0 0 4px rgba(99,102,241,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1.6rem", transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
                    transform: isOpen ? "scale(0.9) rotate(90deg)" : "scale(1)",
                }}
                onMouseEnter={(e) => { if (!isOpen) { e.currentTarget.style.transform = "scale(1.12)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(99,102,241,0.7), 0 0 0 6px rgba(99,102,241,0.2)"; } }}
                onMouseLeave={(e) => { if (!isOpen) { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(99,102,241,0.6), 0 0 0 4px rgba(99,102,241,0.15)"; } }}
                title="AI Assistant"
            >
                {isOpen ? "✕" : "🤖"}
                {hasNew && !isOpen && (
                    <span style={{
                        position: "absolute", top: "2px", right: "2px",
                        width: "16px", height: "16px", borderRadius: "50%",
                        background: "#ef4444", border: "2px solid white",
                        fontSize: "0.6rem", display: "flex", alignItems: "center", justifyContent: "center",
                        color: "white", fontWeight: "800",
                    }}>1</span>
                )}
            </button>

            {/* Pulse rings — double layer */}
            {!isOpen && (<>
                <div style={{
                    position: "fixed", bottom: "2rem", right: "2rem", zIndex: 9997,
                    width: "64px", height: "64px", borderRadius: "50%",
                    border: "2px solid rgba(99,102,241,0.5)", animation: "chatPulse 2s ease-out infinite",
                    pointerEvents: "none",
                }} />
                <div style={{
                    position: "fixed", bottom: "2rem", right: "2rem", zIndex: 9996,
                    width: "64px", height: "64px", borderRadius: "50%",
                    border: "2px solid rgba(236,72,153,0.3)", animation: "chatPulse 2s ease-out 0.5s infinite",
                    pointerEvents: "none",
                }} />
            </>)}

            {/* Chat Window */}
            {isOpen && (
                <div className="animate-fade-in" style={{
                    position: "fixed", bottom: "6.5rem", right: "2rem", zIndex: 9998,
                    width: "min(380px, calc(100vw - 2rem))",
                    borderRadius: "1.25rem", overflow: "hidden",
                    boxShadow: "0 25px 60px rgba(0,0,0,0.25)",
                    border: "1px solid var(--border)",
                    display: "flex", flexDirection: "column",
                    maxHeight: "520px",
                }}>
                    {/* Header */}
                    <div style={{
                        background: "linear-gradient(135deg, #6366f1, #ec4899)",
                        padding: "1rem 1.25rem",
                        display: "flex", alignItems: "center", gap: "0.75rem",
                    }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem", backdropFilter: "blur(4px)" }}>🤖</div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: "700", color: "white", fontSize: "0.95rem" }}>{t("chat_title")}</div>
                            <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.85)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", display: "inline-block", boxShadow: "0 0 6px #4ade80", animation: "chatPulse 2s ease-out infinite" }} />
                                Online · Powered by AI
                            </div>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="glass" style={{
                        flex: 1, overflowY: "auto", padding: "1rem",
                        display: "flex", flexDirection: "column", gap: "0.75rem",
                        maxHeight: "320px",
                    }}>
                        {messages.map((msg, i) => (
                            <div key={i} style={{
                                display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                            }}>
                                {msg.role === "bot" && (
                                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #ec4899)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", flexShrink: 0, marginRight: "0.5rem", alignSelf: "flex-end" }}>🤖</div>
                                )}
                                <div style={{
                                    maxWidth: "78%",
                                    padding: "0.6rem 0.9rem",
                                    borderRadius: msg.role === "user" ? "1rem 1rem 0.25rem 1rem" : "1rem 1rem 1rem 0.25rem",
                                    fontSize: "0.83rem", lineHeight: "1.5",
                                    background: msg.role === "user"
                                        ? "linear-gradient(135deg, #6366f1, #ec4899)"
                                        : "var(--bg-main)",
                                    color: msg.role === "user" ? "white" : "var(--text-main)",
                                    border: msg.role === "bot" ? "1px solid var(--border)" : "none",
                                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                                }}>
                                    {renderText(msg.text)}
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem" }}>
                                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #ec4899)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem" }}>🤖</div>
                                <div style={{ padding: "0.6rem 0.9rem", borderRadius: "1rem 1rem 1rem 0.25rem", background: "var(--bg-main)", border: "1px solid var(--border)", display: "flex", gap: "4px", alignItems: "center" }}>
                                    {[0, 1, 2].map((i) => (
                                        <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366f1", animation: `chatDot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                                    ))}
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick chips */}
                    <div className="glass" style={{ padding: "0.5rem 1rem", display: "flex", gap: "0.4rem", flexWrap: "wrap", borderTop: "1px solid var(--border)" }}>
                        {quickChips.map((chip) => (
                            <button key={chip} onClick={() => { setInput(chip); setTimeout(sendMessage, 10); }}
                                style={{ padding: "0.25rem 0.7rem", borderRadius: "99px", fontSize: "0.72rem", fontWeight: "600", background: "var(--bg-main)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--text-muted)", transition: "all 0.2s" }}
                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.color = "#6366f1"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
                            >
                                {chip}
                            </button>
                        ))}
                    </div>

                    {/* Input */}
                    <div className="glass" style={{ padding: "0.75rem 1rem", display: "flex", gap: "0.5rem", borderTop: "1px solid var(--border)" }}>
                        <input
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                            placeholder={t("chat_placeholder")}
                            style={{ flex: 1, padding: "0.6rem 0.9rem", fontSize: "0.85rem", borderRadius: "0.75rem" }}
                        />
                        <button onClick={sendMessage}
                            style={{ padding: "0.6rem 1rem", borderRadius: "0.75rem", background: "linear-gradient(135deg, #6366f1, #ec4899)", border: "none", cursor: "pointer", color: "white", fontWeight: "700", fontSize: "0.85rem" }}
                        >→</button>
                    </div>
                </div>
            )}

            <style>{`
        @keyframes chatPulse { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(1.6); opacity: 0; } }
        @keyframes chatDot { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }
      `}</style>
        </>
    );
}
