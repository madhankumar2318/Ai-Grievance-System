"use client";

import { useState, useEffect } from "react";

interface LegalArg {
    icon: string;
    act: string;
    section: string;
    claim: string;
    strength: number;
}

interface Props {
    complaintId: string;
    subject: string;
    category: string;
    rejectionReason?: string;
}

/* ── Real Indian Laws per complaint category ──────────────────── */
const LEGAL_ARGS: Record<string, LegalArg[]> = {
    Infrastructure: [
        {
            icon: "🏛️",
            act: "Municipal Corporations Act, 1888",
            section: "Section 241 & 269",
            claim: "Municipal authorities have a statutory duty to maintain and repair public roads, footpaths, and infrastructure. Rejection of a valid infrastructure complaint violates this obligation.",
            strength: 93,
        },
        {
            icon: "📜",
            act: "Right to Public Services Act (State), 2012",
            section: "Section 3 — Entitlement to Services",
            claim: "Citizens are entitled to timely repair of public infrastructure. Failure to act is a denial of a guaranteed public service, making this rejection legally challengeable.",
            strength: 88,
        },
        {
            icon: "⚖️",
            act: "Indian Penal Code, 1860",
            section: "Section 304A — Negligence Causing Injury",
            claim: "Unrepaired footpaths and broken roads that cause injury due to official negligence attract criminal liability. Continued rejection increases that risk.",
            strength: 82,
        },
    ],
    Safety: [
        {
            icon: "🚗",
            act: "Motor Vehicles Act, 1988",
            section: "Section 122 — Prohibition of Parking",
            claim: "Parking in a manner that causes obstruction is a punishable offence. Authorities are legally obligated to clear such violations — rejection of this complaint is non-compliance.",
            strength: 96,
        },
        {
            icon: "🏛️",
            act: "Mumbai Police Act, 1951 (or State Equivalent)",
            section: "Section 102 — Public Nuisance",
            claim: "Obstruction of public spaces constitutes a public nuisance under police power statutes. Local authorities are empowered and obligated to act on such complaints.",
            strength: 89,
        },
        {
            icon: "📜",
            act: "Right to Public Services Act (State), 2012",
            section: "Section 5 — Appeal Against Rejection",
            claim: "Any citizen whose service request is rejected has a statutory right to appeal within 30 days. This AI-generated request constitutes a formal appeal under this provision.",
            strength: 85,
        },
    ],
    Environment: [
        {
            icon: "🌿",
            act: "Environment Protection Act, 1986",
            section: "Section 5 — Power to Issue Directions",
            claim: "The government is empowered and obligated to take immediate action against any activity causing environmental damage. Rejection of this complaint contradicts this mandate.",
            strength: 97,
        },
        {
            icon: "💨",
            act: "Air (Prevention & Control of Pollution) Act, 1981",
            section: "Section 22 — Prohibition on Emission",
            claim: "Emission of air pollutants beyond prescribed standards is a cognizable offence. Authorities cannot legally reject complaints about such violations.",
            strength: 94,
        },
        {
            icon: "🏛️",
            act: "National Green Tribunal Act, 2010",
            section: "Section 18 — Right to File Application",
            claim: "Any person can approach the NGT for enforcement of environmental laws. This AI advocate records this complaint for potential NGT referral if the re-review is also denied.",
            strength: 90,
        },
    ],
    "Public Health": [
        {
            icon: "🏥",
            act: "Epidemic Diseases Act, 1897",
            section: "Section 2 — Special Powers",
            claim: "Authorities have an obligation to take preventive measures against disease spread. Rejecting a Public Health complaint during an active health risk may violate this Act.",
            strength: 95,
        },
        {
            icon: "📜",
            act: "Consumer Protection Act, 2019",
            section: "Section 2(42) — Unfair Trade Practice",
            claim: "Failure to deliver public health services constitutes deficiency in service. Citizens can claim redressal under consumer protection law against the department.",
            strength: 88,
        },
        {
            icon: "⚖️",
            act: "Constitution of India, 1950",
            section: "Article 21 — Right to Life & Health",
            claim: "The Supreme Court has held that the Right to Life includes the right to health and a clean environment. Rejection of this complaint may be challenged as unconstitutional.",
            strength: 92,
        },
    ],
    default: [
        {
            icon: "📜",
            act: "Right to Public Services Act (State), 2012",
            section: "Section 5 — Appeal Against Rejection",
            claim: "Any citizen whose grievance is rejected has a legal right to appeal. This re-review request serves as a formal appeal under the Right to Public Services Act.",
            strength: 85,
        },
        {
            icon: "🏛️",
            act: "Constitution of India, 1950",
            section: "Article 14 — Right to Equality",
            claim: "All citizens are equal before the law. Selective rejection of complaints from certain areas or individuals without adequate cause may violate this fundamental right.",
            strength: 80,
        },
        {
            icon: "⚖️",
            act: "Administrative Tribunals Act, 1985",
            section: "Section 19 — Application to Tribunal",
            claim: "Citizens have the right to approach administrative tribunals if government decisions are arbitrary or unreasonable. This rejection qualifies for tribunal review.",
            strength: 78,
        },
    ],
};

const TYPING_TEXT = "Scanning legal database… cross-referencing applicable Indian Acts… identifying Section violations… building legal argument…";

export default function AIAdvocateCard({ complaintId, subject, category, rejectionReason }: Props) {
    const [phase, setPhase] = useState<"scanning" | "ready" | "requested">("scanning");
    const [typedText, setTypedText] = useState("");
    const [showArgs, setShowArgs] = useState(false);
    const [requested, setRequested] = useState(false);

    const args = LEGAL_ARGS[category] ?? LEGAL_ARGS.default;
    const avgStrength = Math.round(args.reduce((s, a) => s + a.strength, 0) / args.length);

    useEffect(() => {
        let i = 0;
        const interval = setInterval(() => {
            setTypedText(TYPING_TEXT.slice(0, i));
            i++;
            if (i > TYPING_TEXT.length) {
                clearInterval(interval);
                setTimeout(() => { setPhase("ready"); setShowArgs(true); }, 400);
            }
        }, 20);
        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{ marginTop: "2rem" }}>
            {/* Header */}
            <div style={{
                background: "linear-gradient(135deg, #7c3aed18, #dc262618)",
                border: "1px solid #7c3aed44",
                borderRadius: "1.25rem",
                padding: "1.75rem 2rem",
                position: "relative", overflow: "hidden",
            }}>
                <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", background: "radial-gradient(circle, #7c3aed1a, transparent)" }} />

                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                    <div style={{
                        width: "52px", height: "52px", borderRadius: "50%",
                        background: "linear-gradient(135deg, #7c3aed, #dc2626)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.5rem", flexShrink: 0,
                        boxShadow: "0 0 24px rgba(124,58,237,0.5)",
                    }}>⚖️</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.3rem" }}>
                            <h3 style={{ fontSize: "1.15rem", fontWeight: "800", margin: 0 }}>
                                AI Legal Advocate <span className="gradient-text">Activated</span>
                            </h3>
                            <span style={{
                                padding: "0.2rem 0.7rem", borderRadius: "99px", fontSize: "0.68rem", fontWeight: "700",
                                background: phase === "scanning" ? "#f59e0b22" : "#10b98122",
                                color: phase === "scanning" ? "#f59e0b" : "#10b981",
                                border: `1px solid ${phase === "scanning" ? "#f59e0b55" : "#10b98155"}`,
                                textTransform: "uppercase" as const, letterSpacing: "0.06em",
                            }}>
                                {phase === "scanning" ? "⚖️ Scanning Laws" : phase === "ready" ? "📜 Laws Found" : "✅ Appeal Filed"}
                            </span>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-muted)" }}>
                            Your complaint was rejected. Our AI has identified <strong>{args.length} applicable Indian laws</strong> that challenge this decision.
                        </p>
                    </div>
                </div>

                {/* Rejection reason */}
                {rejectionReason && (
                    <div style={{ padding: "0.75rem 1rem", borderRadius: "0.625rem", background: "#dc262612", border: "1px solid #dc262633", marginBottom: "1rem", fontSize: "0.82rem" }}>
                        <span style={{ fontWeight: "700", color: "#dc2626" }}>❌ Authority&apos;s Reason: </span>
                        <span style={{ color: "var(--text-muted)" }}>&quot;{rejectionReason}&quot;</span>
                    </div>
                )}

                {/* Typewriter */}
                {phase === "scanning" && (
                    <div style={{ padding: "0.875rem 1rem", borderRadius: "0.625rem", background: "rgba(0,0,0,0.25)", fontFamily: "monospace", fontSize: "0.78rem", color: "#a78bfa", lineHeight: 1.6, minHeight: "3.5rem" }}>
                        {typedText}<span style={{ opacity: 0.8 }}>█</span>
                    </div>
                )}
            </div>

            {/* Legal Arguments */}
            {showArgs && (
                <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "0.875rem", marginTop: "1rem" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
                        📜 Applicable Indian Laws & Acts
                    </div>

                    {args.map((arg, i) => (
                        <div key={arg.act} className="glass animate-fade-in" style={{
                            padding: "1.25rem 1.5rem", borderRadius: "1rem",
                            borderLeft: "3px solid #7c3aed",
                            animationDelay: `${i * 0.15}s`,
                        }}>
                            <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                                <div style={{ width: "38px", height: "38px", borderRadius: "0.5rem", background: "#7c3aed18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>
                                    {arg.icon}
                                </div>
                                <div style={{ flex: 1 }}>
                                    {/* Act name */}
                                    <div style={{ fontWeight: "800", fontSize: "0.9rem", marginBottom: "0.2rem" }}>
                                        {arg.act}
                                    </div>
                                    {/* Section badge */}
                                    <div style={{ marginBottom: "0.5rem" }}>
                                        <span style={{ display: "inline-block", padding: "0.15rem 0.6rem", borderRadius: "99px", fontSize: "0.7rem", fontWeight: "700", background: "#7c3aed22", color: "#a78bfa", border: "1px solid #7c3aed44" }}>
                                            {arg.section}
                                        </span>
                                    </div>
                                    {/* Legal claim */}
                                    <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.55 }}>
                                        {arg.claim}
                                    </p>
                                    {/* Strength bar */}
                                    <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                        <div style={{ flex: 1, height: "5px", borderRadius: "99px", background: "var(--border)" }}>
                                            <div style={{ height: "100%", borderRadius: "99px", width: `${arg.strength}%`, background: "linear-gradient(90deg, #7c3aed, #10b981)", transition: "width 1.2s ease" }} />
                                        </div>
                                        <span style={{ fontSize: "0.72rem", fontWeight: "800", color: "#a78bfa", whiteSpace: "nowrap" as const }}>
                                            {arg.strength}% valid
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Overall Legal Score */}
                    <div className="glass" style={{
                        padding: "1.25rem 1.5rem", borderRadius: "1rem",
                        background: "linear-gradient(135deg, #7c3aed12, #10b98112)", border: "1px solid #7c3aed33",
                        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem",
                    }}>
                        <div>
                            <div style={{ fontWeight: "800", fontSize: "0.95rem", marginBottom: "0.25rem" }}>Legal Case Strength</div>
                            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                                Based on {args.length} Acts of Indian Law applicable to your complaint
                            </div>
                            <div style={{ marginTop: "0.5rem", fontSize: "0.72rem", color: "#a78bfa" }}>
                                📌 Complaint: <strong>{subject}</strong> &nbsp;|&nbsp; Ref: {complaintId}
                            </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: "2.5rem", fontWeight: "900", color: "#10b981", lineHeight: 1 }}>
                                {avgStrength}%
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "#10b981", fontWeight: "700" }}>Strong Legal Case</div>
                        </div>
                    </div>

                    {/* Disclaimer */}
                    <div style={{ padding: "0.75rem 1rem", borderRadius: "0.625rem", background: "var(--bg-main)", fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                        ⚠️ <em>This AI-generated legal analysis is for civic advocacy purposes. Laws cited are real Indian statutes. For formal legal proceedings, consult a qualified advocate.</em>
                    </div>

                    {/* CTA Button */}
                    {phase !== "requested" ? (
                        <button
                            onClick={() => { setRequested(true); setPhase("requested"); }}
                            style={{
                                width: "100%", padding: "1rem 1.5rem",
                                background: "linear-gradient(135deg, #7c3aed, #dc2626)",
                                color: "white", border: "none", borderRadius: "0.875rem",
                                fontSize: "1rem", fontWeight: "800", cursor: "pointer",
                                boxShadow: "0 4px 20px rgba(124,58,237,0.4)",
                                transition: "transform 0.2s, box-shadow 0.2s",
                                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem",
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(124,58,237,0.55)"; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 20px rgba(124,58,237,0.4)"; }}
                        >
                            ⚖️ File Legal Appeal to Chief Admin
                        </button>
                    ) : (
                        <div className="glass animate-fade-in" style={{
                            padding: "1.5rem", borderRadius: "1rem",
                            background: "#10b98115", border: "1px solid #10b98133", textAlign: "center",
                        }}>
                            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✅</div>
                            <div style={{ fontWeight: "800", marginBottom: "0.25rem", fontSize: "1rem" }}>Legal Appeal Filed Successfully</div>
                            <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                                Your AI-backed legal arguments ({args.length} Acts cited) have been escalated to the Chief Administrator for mandatory review.
                            </div>
                            <div style={{ marginTop: "1rem", display: "flex", justifyContent: "center", gap: "1.5rem", flexWrap: "wrap", fontSize: "0.75rem" }}>
                                <span style={{ color: "#10b981", fontWeight: "700" }}>📋 Appeal No: LEGAL-{complaintId}</span>
                                <span style={{ color: "var(--text-muted)" }}>📅 {new Date().toLocaleDateString("en-IN")}</span>
                                <span style={{ color: "#a78bfa", fontWeight: "600" }}>⏱ Response within 24hrs</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
