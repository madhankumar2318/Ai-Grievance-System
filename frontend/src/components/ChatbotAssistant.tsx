"use client";

import { useState, useRef, useEffect } from "react";
import { useLang } from "@/context/LanguageContext";

interface Message {
    role: "user" | "bot";
    text: string;
}

// ── Domain Security Guardrails ──────────────────────────────────────────────
const OFF_TOPIC_REGEX = /\b(cricket|football|fifa|ipl|world cup|messi|ronaldo|match|score|sports|movie|cinema|actor|actress|hollywood|bollywood|song|lyrics|joke|story|recipe|cooking|president|election|bitcoin|crypto|stock market|shares|astrology|horoscope|weather tomorrow|forecast)\b/i;

const OFFICER_PRIVACY_REGEX = /\b(officer phone|officer number|chief phone|chief number|collector phone|collector number|officer contact|chief contact|officer personal|officer salary|officer address|collector address|officer home|passphrase|secret key|admin password|database password|internal credential)\b/i;

function getBotReply(rawInput: string): string {
    const text = (rawInput || "").trim().toLowerCase();

    // 1. Officer & Chief Safety Guardrail (Strict PII Protection)
    if (OFFICER_PRIVACY_REGEX.test(text)) {
        return "🔒 **Official Protocol Notice:**\nFor administrative security and officer safety, personal contact numbers, private addresses, and internal credentials of Field Officers and the District Collector are confidential.\n\n• All verified action updates, officer directives, and resolution proof photos are logged directly on your **Track** page (`/track`).\n• For urgent administrative inquiries, please contact the **District Public Grievance Helpline at 📞 1913** (Toll-Free, 24/7).";
    }

    // 2. Strict Off-Topic Guardrail (Domain Boundary Shield)
    if (OFF_TOPIC_REGEX.test(text)) {
        return "⛔ **Civic Portal Notice:**\nI am the dedicated Civic Grievance Assistant for this portal. I can only answer questions related to:\n• Filing civic grievances (text, voice, photo)\n• Tracking complaints & resolution deadlines (SLAs)\n• Account settings & password management\n• Civic department issues (Water, Roads, Garbage, Streetlights)\n\nPlease ask any question related to our civic portal!";
    }

    // 3. Greetings
    if (/^(hi|hello|hey|namaste|vanakkam|good morning|good afternoon|good evening|yo)\b/i.test(text)) {
        return "👋 **Hello & Welcome!**\nI'm your official Civic Grievance Assistant. I can help you:\n\n• 📝 **File a complaint** using text, voice, or photos\n• 🔍 **Track your grievance** with your GRV-ID\n• ⏱️ **Check resolution deadlines** (24h to 14 days)\n• 🔑 **Change your password** or update your profile\n• 🆘 **Find official emergency helplines**\n\nHow can I help you today? You can type your question or tap any topic chip above!";
    }

    // 4. Filing Complaints & Voice / Photo Features
    if (/\b(how to file|file complaint|lodge complaint|submit complaint|raise complaint|report problem|voice input|voice typing|speak|mic|audio|photo|ai analyze|scanner|camera|duplicate)\b/i.test(text) || text.includes("how to file")) {
        return "📝 **How to File a Civic Grievance:**\n\n1️⃣ **Open Form:** Go to the home page (`/`) to access the grievance form.\n2️⃣ **Subject & Category:** Enter a clear title (e.g. *\"Broken Drinking Water Pipe\"*) and choose your department (Environment, Infrastructure, Safety, etc.).\n3️⃣ **Description & Voice Input:** Type details or click **🎙️ Voice Input** to speak your complaint in Tamil or English without typing!\n4️⃣ **Location & Geotag:** Click **📍 Auto-Detect GPS** or choose your district from the dropdown.\n5️⃣ **Photos & AI Scanner:** Upload photo evidence and click **📸 AI Analyze Photo** to automatically recognize the problem and auto-fill details!\n6️⃣ **Submit:** Click **Submit Grievance**. You'll instantly receive your unique tracking ID (`GRV-XXXXX`)!";
    }

    // 5. Tracking Grievance & GRV-ID
    if (/\b(track|tracking id|grv|check status|status meaning|progress|where is my complaint|ticket id)\b/i.test(text) || text.includes("track status")) {
        return "🔍 **How to Track Your Grievance:**\n\n1️⃣ Click **Track** in the top menu (or go to `/track`).\n2️⃣ Enter your **Tracking ID** (e.g. `GRV-49033`).\n3️⃣ Click **Track Grievance** to see real-time status:\n\n• ⏳ **Pending:** Awaiting department triage and officer dispatch.\n• ⚙️ **In Progress:** Assigned field officer is actively resolving on-site.\n• ✅ **Resolved:** Repair complete with verified before & after photos!\n• ❌ **Rejected:** Out-of-jurisdiction with AI Advocate appeal options.\n\n💡 *Tip: Your tracking ID was shown on-screen right after filing and saved in 'My Grievances'!*";
    }

    // 6. Deadlines & Resolution Time Limits (SLAs)
    if (/\b(deadline|time limit|how long|how many days|sla|resolution time|when will it be resolved|urgent|urgency|priority|critical|high priority)\b/i.test(text) || text.includes("time limits")) {
        return "⏱️ **Official Resolution Deadlines (SLAs):**\n\nOur system categorizes complaints into 4 priority tiers with strict time limits:\n\n🔴 **Critical Priority (24 – 48 Hours):**\nDrinking water contamination, open high-voltage live wires, hospital hazards, or severe road collapses.\n\n🟠 **High Priority (3 – 5 Days):**\nMajor road potholes, overflowing garbage dumps, broken streetlights on main avenues.\n\n🟡 **Medium Priority (7 – 10 Days):**\nPublic park maintenance, drainage odor, non-functional public signage.\n\n🟢 **Low Priority (14+ Days):**\nGeneral administrative requests and routine civic improvements.\n\n🏛️ *Note: If a deadline passes, the complaint is auto-flagged as 'Overdue' and escalated to the District Collector's Executive Directive dashboard.*";
    }

    // 7. Password & Account Profile Management
    if (/\b(password|change password|reset password|forgot password|profile|update profile|edit profile|phone number|ward|district|pincode|resident badge|verified resident)\b/i.test(text) || text.includes("change password")) {
        return "🔑 **Account & Profile Guide:**\n\n• **Change Password:**\nClick your **MK Profile** button at the top right → Select **👤 My Profile** → Click the gold **🔑 Change Password** button. Enter your current password and your new password.\n\n• **Update Contact / District:**\nOn your Profile page, click **Edit Profile Details** to update your official name, district, contact phone, or pincode.\n\n• **Verified Resident Badge (🛡️):**\nIndicates you are a registered resident with verified civic representation in your municipal ward.";
    }

    // 8. My Grievances History Page
    if (/\b(my grievances|past complaints|history|previous complaint|view my|all complaints)\b/i.test(text)) {
        return "📋 **My Grievances Portal (`/my-grievances`):**\n\nClick **My Grievances** in your profile menu to:\n• View every grievance you have ever filed.\n• Filter by status (**All**, **Pending**, **In Progress**, **Resolved**).\n• Click **Track →** on any complaint card to view its live redressal timeline and official repair proof.";
    }

    // 9. Water & Drainage Issues
    if (/\b(water|drinking water|leakage|pipe|contamination|drainage|water supply|sewage|borewell)\b/i.test(text) || text.includes("water")) {
        return "🚰 **Water & Drainage Issues:**\n\n• **Department:** Handled by the **Environment & Water Redressing Division**.\n• **Contaminated Water:** Treated as **🔴 Critical Priority (24-Hour SLA)** due to public health risks.\n• **Leakages & Low Pressure:** Treated as **🟠 High Priority (3-5 Days)**.\n• **Filing Tip:** Upload a photo of the leaking pipe or discolored water and mention your ward/street number.";
    }

    // 10. Roads, Potholes & Infrastructure
    if (/\b(road|pothole|street|tar|asphalt|traffic light|signal|speed breaker|bridge|culvert)\b/i.test(text) || text.includes("roads") || text.includes("potholes")) {
        return "🚧 **Roads & Potholes:**\n\n• **Department:** Handled by the **Infrastructure (Public Works / Highways) Division**.\n• **Major Potholes & Collapses:** Classified as **🟠 High** or **🔴 Critical Priority**.\n• **Filing Tip:** Take a photo from 5–10 feet away showing the road context. The system automatically tags GPS coordinates to dispatch the nearest asphalt repair team.";
    }

    // 11. Streetlights & Pole Issues
    if (/\b(street light|streetlight|light|lamp|pole|dark street|bulb)\b/i.test(text)) {
        return "💡 **Streetlight Complaints:**\n\n• **Department:** Handled by the **Infrastructure (Electrical Division)**.\n• **Timeline:** Fixed within **3 to 5 business days**.\n• **Filing Tip:** Mention the **Pole Number** (stenciled in yellow/white on the pole) or the nearest house landmark. This helps the lineman locate the exact light immediately!";
    }

    // 12. Garbage, Waste & Sanitation
    if (/\b(garbage|trash|waste|dump|litter|cleaning|sanitation|stray animal|dog|mosquito|debris)\b/i.test(text) || text.includes("garbage") || text.includes("waste")) {
        return "🗑️ **Garbage & Sanitation:**\n\n• **Department:** Handled by the **Environment (Solid Waste Management) Division**.\n• **Timeline:** Routine bin overflows cleared within **24 to 48 hours**.\n• **Filing Tip:** Take a photo of the overflowing container or uncollected pile with your GPS camera turned on.";
    }

    // 13. Electricity, Live Wires & Power Outages
    if (/\b(electric|power cut|wire|transformer|spark|current|eb|power outage|voltage)\b/i.test(text)) {
        return "⚡ **Electricity & Power Hazards:**\n\n• **Sparking or Hanging Live Wires:** Treated as **🔴 Critical Emergency Priority (Immediate Escalation)**.\n• **Department:** Handled by the **State Electricity Board (EB / TANGEDCO)**.\n• **Emergency Tip:** For immediate live wire emergencies, stay at least 10 meters away and dial the state electricity toll-free emergency number at **📞 1912**.";
    }

    // 14. Hospitals, Healthcare & Medicine
    if (/\b(hospital|health|doctor|clinic|medicine|ambulance|disease|sanitary)\b/i.test(text)) {
        return "🏥 **Public Health & Hospital Grievances:**\n\n• **Department:** Handled by the **Public Health Department**.\n• **Priority:** Escalated to **🔴 Critical / High** immediately.\n• **Issues Handled:** PHC doctor non-availability, essential medicine shortage, unsanitary hospital wards, or emergency ambulance delays.";
    }

    // 15. Collector Executive Directives & ATR Reports
    if (/\b(directive|collector|executive directive|atr|action taken report|collector order|resolution proof|proof photo|inspection)\b/i.test(text)) {
        return "🏛️ **Collector Directives & ATR Reports:**\n\n• **Executive Directive:** When a grievance is urgent or overdue, the District Collector can issue a legally binding directive expediting resolution within a target window (e.g. 24 Hours).\n• **Action Taken Report (ATR):** Once the field officer executes the repair, they must upload an official report with verified **AFTER REPAIR ✓** photo evidence.\n• **Inspect Proof:** You can tap any resolution photo on `/track` to view full-size geotagged evidence!";
    }

    // 16. Rejections & AI Advocate Appeal
    if (/\b(reject|rejected|why rejected|appeal|advocate|ai advocate|false report)\b/i.test(text)) {
        return "⚖️ **Rejected Complaints & Appeal Rights:**\n\n• If an officer rejects a complaint, the rejection reason is clearly stated on your `/track` page.\n• **AI Advocate Card:** For rejected grievances, an AI Advocate button appears with official legal clauses (such as *Article 21 Right to Clean Environment* or *Municipal Corporation Act*) and allows you to submit an official appeal to the District Collectorate.";
    }

    // 17. Official Emergency Helplines
    if (/\b(helpline|emergency|phone number|call|police|fire|contact number|toll free|customer care)\b/i.test(text) || text.includes("emergency") || text.includes("helpline")) {
        return "🆘 **Official Government Civic Helplines:**\n\n🏛️ **Municipal Civic Grievances:** 1913 (Toll-Free)\n⚡ **Electricity Emergency:** 1912\n🚑 **Medical Emergency / Ambulance:** 108\n🚓 **Police Control Room:** 100 / 112\n🚒 **Fire & Rescue Services:** 101\n👩 **Women Helpline:** 1091\n💻 **National Cyber Crime:** 1930\n\n⏰ *District Collectorate Grievance Hall operates Monday to Saturday from 9:30 AM to 5:30 PM.*";
    }

    // 18. Language & Dark/Light Themes
    if (/\b(language|tamil|hindi|english|dark mode|light mode|theme|color)\b/i.test(text)) {
        return "🌐 **Language & Display Settings:**\n\n• **Language Switcher:** Click the Globe 🌐 icon in the top navigation bar to switch between **English**, **தமிழ் (Tamil)**, and **हिन्दी (Hindi)**.\n• **Theme Toggle:** Click the Sun ☀️ / Moon 🌙 icon in the navbar to toggle between Dark Mode and Light Mode anytime.";
    }

    // 19. Roles & Permissions (Citizen vs Officer vs Chief)
    if (/\b(roles|citizen role|officer role|chief role|authority role|admin access)\b/i.test(text)) {
        return "👥 **Portal User Roles:**\n\n• **Citizen (You):** File grievances, track status, view before/after proof, and manage profile.\n• **Field Officer:** Field engineers dispatched to inspect, repair, and submit Action Taken Reports (ATRs).\n• **District Chief (Collector):** Oversees district metrics, issues executive directives, and monitors department clearance rates.";
    }

    // 20. Comprehensive Helpful Fallback
    return "🤔 **I'm here to help you with the Civic Grievance Portal!**\n\nHere are the most common things I can assist you with:\n\n• 📝 **Filing a Complaint** (Voice typing, photo analysis, GPS)\n• 🔍 **Tracking Grievances** (Enter your `GRV-ID` to see live progress)\n• ⏱️ **Resolution Deadlines** (SLA limits from 24 hours to 14 days)\n• 🔑 **Account & Password** (Reset password, update phone or district)\n• 🚰 **Civic Issues** (Water, Potholes, Streetlights, Garbage, Hospitals)\n• 🆘 **Emergency Helplines** (1913, 108, 100, 1091)\n\n💡 *Tip: You can also tap any topic chip above for instant help!*";
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

    const handleSend = (queryText?: string) => {
        const text = (typeof queryText === "string" ? queryText : input).trim();
        if (!text) return;
        setMessages((prev) => [...prev, { role: "user", text }]);
        setInput("");
        setIsTyping(true);
        setTimeout(() => {
            const reply = getBotReply(text);
            setMessages((prev) => [...prev, { role: "bot", text: reply }]);
            setIsTyping(false);
            if (!isOpen) setHasNew(true);
        }, 350 + Math.random() * 250);
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

    const quickChips = [
        "📝 How to File",
        "🔍 Track Status",
        "⏱️ Time Limits",
        "🔑 Change Password",
        "🚰 Water Issue",
        "🚧 Roads & Potholes",
        "🗑️ Garbage & Waste",
        "🆘 Helplines"
    ];

    return (
        <>
            {/* Floating Bubble */}
            <button
                onClick={() => setIsOpen((p) => !p)}
                className="chatbot-bubble"
                style={{
                    boxShadow: isOpen ? "0 8px 30px rgba(99,102,241,0.4)" : "0 8px 32px rgba(99,102,241,0.6), 0 0 0 4px rgba(99,102,241,0.15)",
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
                <div className="chatbot-pulse-1" />
                <div className="chatbot-pulse-2" />
            </>)}

            {/* Chat Window */}
            {isOpen && (
                <div className="animate-fade-in chatbot-window">
                    {/* Header */}
                    <div style={{
                        background: "linear-gradient(135deg, #6366f1, #ec4899)",
                        padding: "0.85rem 1.15rem",
                        display: "flex", alignItems: "center", gap: "0.75rem",
                    }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem", backdropFilter: "blur(4px)", flexShrink: 0 }}>🤖</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: "700", color: "white", fontSize: "0.95rem" }}>{t("chat_title")}</div>
                            <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.85)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", display: "inline-block", boxShadow: "0 0 6px #4ade80", animation: "chatPulse 2s ease-out infinite" }} />
                                Online · Powered by AI
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            title="Close chat"
                            style={{
                                width: "28px", height: "28px", borderRadius: "50%",
                                background: "rgba(255,255,255,0.2)", border: "none",
                                color: "white", fontSize: "0.95rem", cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                flexShrink: 0,
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.3)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.2)"; }}
                        >
                            ✕
                        </button>
                    </div>

                    {/* Messages */}
                    <div style={{
                        flex: 1, overflowY: "auto", padding: "1rem",
                        display: "flex", flexDirection: "column", gap: "0.75rem",
                        maxHeight: "340px",
                        background: "var(--bg-card, #0f172a)",
                    }}>
                        {messages.map((msg, i) => (
                            <div key={i} style={{
                                display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                            }}>
                                {msg.role === "bot" && (
                                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #ec4899)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", flexShrink: 0, marginRight: "0.5rem", alignSelf: "flex-end" }}>🤖</div>
                                )}
                                <div style={{
                                    maxWidth: "82%",
                                    padding: "0.6rem 0.9rem",
                                    borderRadius: msg.role === "user" ? "1rem 1rem 0.25rem 1rem" : "1rem 1rem 1rem 0.25rem",
                                    fontSize: "0.83rem", lineHeight: "1.5",
                                    background: msg.role === "user"
                                        ? "linear-gradient(135deg, #6366f1, #ec4899)"
                                        : "var(--bg-main, #1e293b)",
                                    color: msg.role === "user" ? "white" : "var(--text-main)",
                                    border: msg.role === "bot" ? "1px solid var(--border)" : "none",
                                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                                }}>
                                    {renderText(msg.text)}
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem" }}>
                                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #ec4899)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem" }}>🤖</div>
                                <div style={{ padding: "0.6rem 0.9rem", borderRadius: "1rem 1rem 1rem 0.25rem", background: "var(--bg-main, #1e293b)", border: "1px solid var(--border)", display: "flex", gap: "4px", alignItems: "center" }}>
                                    {[0, 1, 2].map((i) => (
                                        <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366f1", animation: `chatDot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                                    ))}
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick chips */}
                    <div style={{ padding: "0.5rem 0.85rem", display: "flex", gap: "0.4rem", flexWrap: "wrap", borderTop: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
                        {quickChips.map((chip) => (
                            <button key={chip} onClick={() => handleSend(chip)}
                                style={{ padding: "0.25rem 0.65rem", borderRadius: "99px", fontSize: "0.72rem", fontWeight: "600", background: "var(--bg-main, #1e293b)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--text-muted)", transition: "all 0.2s" }}
                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.color = "#6366f1"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
                            >
                                {chip}
                            </button>
                        ))}
                    </div>

                    {/* Input */}
                    <div style={{ padding: "0.75rem 0.85rem", display: "flex", gap: "0.5rem", borderTop: "1px solid var(--border)", background: "rgba(255,255,255,0.03)" }}>
                        <input
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSend()}
                            placeholder={t("chat_placeholder")}
                            style={{ flex: 1, padding: "0.6rem 0.85rem", fontSize: "0.85rem", borderRadius: "0.75rem", background: "var(--bg-main, #0b0f19)", border: "1px solid var(--border)", color: "var(--text-main)" }}
                        />
                        <button onClick={() => handleSend()}
                            style={{ padding: "0.6rem 1rem", borderRadius: "0.75rem", background: "linear-gradient(135deg, #6366f1, #ec4899)", border: "none", cursor: "pointer", color: "white", fontWeight: "700", fontSize: "0.85rem" }}
                        >→</button>
                    </div>
                </div>
            )}

            <style>{`
        .chatbot-bubble {
            position: fixed;
            bottom: 1.25rem;
            right: 1.25rem;
            z-index: 9999;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: none;
            cursor: pointer;
            background: linear-gradient(135deg, #6366f1, #ec4899);
            font-size: 1.45rem;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        @media (min-width: 640px) {
            .chatbot-bubble {
                bottom: 2rem;
                right: 2rem;
                width: 64px;
                height: 64px;
                font-size: 1.6rem;
            }
        }

        .chatbot-pulse-1 {
            position: fixed;
            bottom: 1.25rem;
            right: 1.25rem;
            z-index: 9997;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            border: 2px solid rgba(99, 102, 241, 0.5);
            animation: chatPulse 2s ease-out infinite;
            pointer-events: none;
        }
        .chatbot-pulse-2 {
            position: fixed;
            bottom: 1.25rem;
            right: 1.25rem;
            z-index: 9996;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            border: 2px solid rgba(236, 72, 153, 0.3);
            animation: chatPulse 2s ease-out 0.5s infinite;
            pointer-events: none;
        }
        @media (min-width: 640px) {
            .chatbot-pulse-1, .chatbot-pulse-2 {
                bottom: 2rem;
                right: 2rem;
                width: 64px;
                height: 64px;
            }
        }

        .chatbot-window {
            position: fixed;
            bottom: 5.25rem;
            left: 0.85rem;
            right: 0.85rem;
            z-index: 9998;
            border-radius: 1.25rem;
            overflow: hidden;
            box-shadow: 0 25px 60px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.14);
            display: flex;
            flex-direction: column;
            max-height: min(540px, calc(100dvh - 6.75rem));
            background: var(--bg-card, #0f172a);
        }
        @media (min-width: 640px) {
            .chatbot-window {
                bottom: 6.5rem;
                right: 2rem;
                left: auto;
                width: 380px;
                max-height: 540px;
            }
        }

        @keyframes chatPulse { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(1.6); opacity: 0; } }
        @keyframes chatDot { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }
      `}</style>
        </>
    );
}
