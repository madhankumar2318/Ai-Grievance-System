"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface Props {
    beforeLabel?: string;
    afterLabel?: string;
    title?: string;
    complaintSubject?: string;
    complaintCategory?: string;
}

/* ── SVG scene generators ──────────────────────────────────────── */
function BeforeSVG({ category }: { category: string }) {
    if (category === "Safety") return (
        <svg viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%", display: "block" }}>
            {/* Sky */}
            <rect width="800" height="220" fill="#b0c4de" />
            {/* Buildings bg */}
            <rect x="0" y="80" width="120" height="140" fill="#8a9ab0" />
            <rect x="100" y="100" width="90" height="120" fill="#7a8a9f" />
            <rect x="620" y="70" width="110" height="150" fill="#8a9ab0" />
            <rect x="700" y="90" width="100" height="130" fill="#7a8a9f" />
            {/* Road */}
            <rect x="0" y="220" width="800" height="180" fill="#4a4a4a" />
            {/* Cracked road lines */}
            <path d="M50 280 l10 20 l-5 15 l8 10" stroke="#333" strokeWidth="2" fill="none" />
            <path d="M150 300 l15 10 l-8 20" stroke="#333" strokeWidth="2" fill="none" />
            <path d="M400 260 l-10 30 l12 15" stroke="#333" strokeWidth="2" fill="none" />
            <path d="M600 290 l8 20 l-10 10 l5 15" stroke="#333" strokeWidth="2" fill="none" />
            {/* Illegally parked cars */}
            {/* Car 1 */}
            <rect x="30" y="230" width="110" height="55" rx="8" fill="#c0392b" />
            <rect x="45" y="220" width="80" height="30" rx="6" fill="#e74c3c" />
            <circle cx="55" cy="288" r="14" fill="#222" /><circle cx="55" cy="288" r="7" fill="#666" />
            <circle cx="125" cy="288" r="14" fill="#222" /><circle cx="125" cy="288" r="7" fill="#666" />
            <rect x="50" y="224" width="28" height="18" rx="2" fill="#87ceeb" opacity="0.7" />
            <rect x="93" y="224" width="28" height="18" rx="2" fill="#87ceeb" opacity="0.7" />
            {/* Car 2 diagonal */}
            <g transform="rotate(-12, 280, 255)">
                <rect x="220" y="232" width="105" height="50" rx="8" fill="#2980b9" />
                <rect x="235" y="222" width="75" height="28" rx="6" fill="#3498db" />
                <circle cx="245" cy="285" r="13" fill="#222" /><circle cx="245" cy="285" r="6" fill="#666" />
                <circle cx="310" cy="285" r="13" fill="#222" /><circle cx="310" cy="285" r="6" fill="#666" />
            </g>
            {/* Auto-rickshaw */}
            <rect x="380" y="238" width="75" height="48" rx="6" fill="#f39c12" />
            <rect x="390" y="228" width="55" height="26" rx="4" fill="#f1c40f" />
            <circle cx="400" cy="290" r="12" fill="#222" /><circle cx="440" cy="290" r="12" fill="#222" />
            {/* Car 3 half on footpath */}
            <rect x="510" y="218" width="100" height="50" rx="8" fill="#27ae60" />
            <rect x="525" y="208" width="70" height="26" rx="6" fill="#2ecc71" />
            <circle cx="535" cy="273" r="13" fill="#222" /><circle cx="595" cy="273" r="13" fill="#222" />
            {/* Motorcycle */}
            <rect x="650" y="248" width="55" height="25" rx="4" fill="#8e44ad" />
            <circle cx="665" cy="275" r="11" fill="#222" /><circle cx="695" cy="275" r="11" fill="#222" />
            {/* Rubbish bags on pavement */}
            <ellipse cx="460" cy="232" rx="18" ry="12" fill="#2c3e50" opacity="0.8" />
            <ellipse cx="490" cy="228" rx="15" ry="10" fill="#1a252f" opacity="0.8" />
            {/* NO PARKING sign knocked over */}
            <rect x="740" y="225" width="6" height="50" fill="#888" transform="rotate(30, 743, 225)" />
            <rect x="720" y="208" width="45" height="30" rx="4" fill="#e74c3c" transform="rotate(30, 743, 225)" />
            <text x="724" y="228" fontSize="9" fill="white" fontWeight="bold" transform="rotate(30, 743, 225)">NO PARK</text>
            {/* Footpath */}
            <rect x="0" y="200" width="800" height="22" fill="#c8b89a" />
            <line x1="0" y1="211" x2="800" y2="211" stroke="#b09a7a" strokeWidth="1" strokeDasharray="40,20" />
            {/* "BEFORE" atmosphere — red tint overlay */}
            <rect width="800" height="400" fill="#ff000008" />
            {/* Chaos arrows */}
            <text x="280" y="190" fontSize="24" fill="#e74c3c" opacity="0.7">⚠️</text>
            <text x="500" y="185" fontSize="20" fill="#e74c3c" opacity="0.6">⚠️</text>
        </svg>
    );

    // Default: pothole / infrastructure
    return (
        <svg viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%", display: "block" }}>
            <rect width="800" height="200" fill="#b8c8d8" />
            <rect x="0" y="200" width="800" height="200" fill="#3a3a3a" />
            {/* Potholes */}
            <ellipse cx="200" cy="280" rx="55" ry="30" fill="#222" /><ellipse cx="200" cy="280" rx="40" ry="20" fill="#111" />
            <ellipse cx="480" cy="320" rx="45" ry="25" fill="#222" /><ellipse cx="480" cy="320" rx="30" ry="17" fill="#111" />
            <ellipse cx="650" cy="260" rx="35" ry="20" fill="#222" /><ellipse cx="650" cy="260" rx="22" ry="13" fill="#111" />
            {/* Cracks */}
            <path d="M100 240 l30 40 l-15 30 l25 20" stroke="#222" strokeWidth="3" fill="none" />
            <path d="M350 260 l20 50 l30 20" stroke="#222" strokeWidth="2.5" fill="none" />
            <path d="M550 300 l-25 30 l15 25 l-10 20" stroke="#222" strokeWidth="2.5" fill="none" />
            <text x="220" y="190" fontSize="24" fill="#e74c3c" opacity="0.8">⚠️</text>
        </svg>
    );
}

function AfterSVG({ category }: { category: string }) {
    if (category === "Safety") return (
        <svg viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%", display: "block" }}>
            {/* Bright sky */}
            <defs>
                <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#87CEEB" />
                    <stop offset="100%" stopColor="#b8e4ff" />
                </linearGradient>
            </defs>
            <rect width="800" height="220" fill="url(#skyGrad)" />
            {/* Sun */}
            <circle cx="680" cy="60" r="35" fill="#FFD700" opacity="0.9" />
            <circle cx="680" cy="60" r="45" fill="#FFD70030" />
            {/* Buildings */}
            <rect x="0" y="80" width="120" height="140" fill="#95a5b8" />
            <rect x="100" y="100" width="90" height="120" fill="#8696ab" />
            <rect x="620" y="70" width="110" height="150" fill="#95a5b8" />
            <rect x="700" y="90" width="100" height="130" fill="#8696ab" />
            {/* Clean footpath */}
            <rect x="0" y="200" width="800" height="22" fill="#d4c5a0" />
            <line x1="0" y1="211" x2="800" y2="211" stroke="#c0aa80" strokeWidth="1" strokeDasharray="40,20" />
            {/* Clean smooth road */}
            <rect x="0" y="220" width="800" height="180" fill="#555" />
            {/* Road lane markings */}
            <rect x="0" y="298" width="800" height="6" fill="#fff" opacity="0.15" />
            <rect x="0" y="370" width="800" height="4" fill="#fff" opacity="0.3" />
            {/* Dashed centre line */}
            <line x1="0" y1="310" x2="800" y2="310" stroke="#FFD700" strokeWidth="3" strokeDasharray="60,30" />
            {/* Parking zones - painted */}
            <rect x="20" y="222" width="120" height="58" fill="none" stroke="white" strokeWidth="2" strokeDasharray="5,3" opacity="0.5" />
            <rect x="160" y="222" width="120" height="58" fill="none" stroke="white" strokeWidth="2" strokeDasharray="5,3" opacity="0.5" />
            <text x="60" y="258" fontSize="9" fill="white" opacity="0.6" textAnchor="middle">PARKING</text>
            <text x="220" y="258" fontSize="9" fill="white" opacity="0.6" textAnchor="middle">PARKING</text>
            {/* Properly parked car 1 */}
            <rect x="25" y="228" width="110" height="50" rx="8" fill="#2980b9" />
            <rect x="40" y="218" width="80" height="28" rx="6" fill="#3498db" />
            <circle cx="50" cy="282" r="13" fill="#222" /><circle cx="120" cy="282" r="13" fill="#222" />
            <rect x="45" y="220" width="26" height="17" rx="2" fill="#87ceeb" opacity="0.8" />
            <rect x="88" y="220" width="26" height="17" rx="2" fill="#87ceeb" opacity="0.8" />
            {/* Car 2 properly parked */}
            <rect x="165" y="228" width="110" height="50" rx="8" fill="#27ae60" />
            <rect x="180" y="218" width="80" height="28" rx="6" fill="#2ecc71" />
            <circle cx="190" cy="282" r="13" fill="#222" /><circle cx="260" cy="282" r="13" fill="#222" />
            {/* Wide open road */}
            {/* Trees / greenery on footpath */}
            <circle cx="350" cy="195" r="22" fill="#27ae60" />
            <circle cx="340" cy="188" r="16" fill="#2ecc71" />
            <rect x="347" y="200" width="6" height="22" fill="#795548" />
            <circle cx="550" cy="195" r="22" fill="#27ae60" />
            <circle cx="558" cy="188" r="16" fill="#2ecc71" />
            <rect x="547" y="200" width="6" height="22" fill="#795548" />
            {/* Working NO PARKING sign upright */}
            <rect x="755" y="205" width="6" height="50" fill="#888" />
            <rect x="737" y="192" width="42" height="28" rx="4" fill="#e74c3c" />
            <text x="739" y="210" fontSize="8" fill="white" fontWeight="bold">NO</text>
            <text x="736" y="218" fontSize="8" fill="white" fontWeight="bold">PARKING</text>
            {/* Green tint overlay */}
            <rect width="800" height="400" fill="#00ff0005" />
            {/* Checkmark */}
            <text x="370" y="195" fontSize="28" fill="#27ae60" opacity="0.8">✅</text>
        </svg>
    );

    return (
        <svg viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%", display: "block" }}>
            <defs>
                <linearGradient id="skyGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#87CEEB" />
                    <stop offset="100%" stopColor="#b8e4ff" />
                </linearGradient>
            </defs>
            <rect width="800" height="200" fill="url(#skyGrad2)" />
            <circle cx="680" cy="60" r="35" fill="#FFD700" opacity="0.9" />
            {/* Clean smooth road, no potholes */}
            <rect x="0" y="200" width="800" height="200" fill="#555" />
            <line x1="0" y1="300" x2="800" y2="300" stroke="#FFD700" strokeWidth="3" strokeDasharray="60,30" />
            <rect x="0" y="380" width="800" height="4" fill="#fff" opacity="0.3" />
            <text x="380" y="190" fontSize="28" fill="#27ae60" opacity="0.8">✅</text>
        </svg>
    );
}

export default function BeforeAfterSlider({
    beforeLabel = "BEFORE",
    afterLabel = "AFTER ✓",
    title = "📸 Resolution Evidence",
    complaintCategory = "Safety",
}: Props) {
    const [pos, setPos] = useState(50);
    const [dragging, setDragging] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const [width, setWidth] = useState(800);
    const containerRef = useRef<HTMLDivElement>(null);

    // Hydrate width and animate initial reveal
    useEffect(() => {
        if (containerRef.current) {
            setWidth(containerRef.current.offsetWidth);
        }
        const handleResize = () => {
            if (containerRef.current) {
                setWidth(containerRef.current.offsetWidth);
            }
        };
        window.addEventListener("resize", handleResize);
        const t = setTimeout(() => setRevealed(true), 400);

        return () => {
            window.removeEventListener("resize", handleResize);
            clearTimeout(t);
        };
    }, []);

    const calcPos = useCallback((clientX: number) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const pct = Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100));
        setPos(pct);
    }, []);

    return (
        <div style={{ marginTop: "2rem" }}>
            {/* Title */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                <h3 style={{ fontSize: "1.1rem", fontWeight: "700" }}>{title}</h3>
                <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem", borderRadius: "99px", background: "#10b98120", color: "#10b981", fontWeight: "600" }}>
                    Drag to Compare
                </span>
            </div>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
                Drag the slider to reveal how the issue was resolved by the authorities.
            </p>

            {/* Slider Container */}
            <div
                ref={containerRef}
                style={{
                    position: "relative", width: "100%", height: "320px",
                    borderRadius: "1.25rem", overflow: "hidden",
                    cursor: dragging ? "grabbing" : "ew-resize",
                    userSelect: "none", boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                    border: "2px solid var(--border)",
                }}
                onMouseDown={(e) => { setDragging(true); calcPos(e.clientX); }}
                onMouseUp={() => setDragging(false)}
                onMouseLeave={() => setDragging(false)}
                onMouseMove={(e) => { if (dragging) calcPos(e.clientX); }}
                onTouchStart={(e) => { setDragging(true); calcPos(e.touches[0].clientX); }}
                onTouchEnd={() => setDragging(false)}
                onTouchMove={(e) => { calcPos(e.touches[0].clientX); }}
            >
                {/* AFTER — full width background */}
                <div style={{ position: "absolute", inset: 0 }}>
                    <AfterSVG category={complaintCategory} />
                </div>

                {/* BEFORE — clipped to left side */}
                <div style={{
                    position: "absolute", inset: 0,
                    width: `${revealed ? pos : 50}%`,
                    overflow: "hidden",
                    transition: dragging ? "none" : "width 0.05s linear",
                }}>
                    <div style={{ width: `${width}px`, height: "100%" }}>
                        <BeforeSVG category={complaintCategory} />
                    </div>
                </div>

                {/* Divider line */}
                <div style={{
                    position: "absolute", top: 0, bottom: 0,
                    left: `${pos}%`, transform: "translateX(-50%)",
                    width: "3px", background: "white",
                    boxShadow: "0 0 12px rgba(0,0,0,0.5)",
                    zIndex: 10, pointerEvents: "none",
                    transition: dragging ? "none" : "left 0.05s linear",
                }}>
                    {/* Handle circle */}
                    <div style={{
                        position: "absolute", top: "50%", left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: "48px", height: "48px", borderRadius: "50%",
                        background: "white",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1rem", fontWeight: "900", color: "#333",
                        transition: dragging ? "none" : "transform 0.2s",
                        cursor: dragging ? "grabbing" : "grab",
                    }}>
                        ◀ ▶
                    </div>
                </div>

                {/* BEFORE label */}
                <div style={{
                    position: "absolute", top: "1rem", left: "1rem",
                    background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
                    color: "#fca5a5", padding: "0.3rem 0.9rem",
                    borderRadius: "99px", fontSize: "0.72rem", fontWeight: "800",
                    letterSpacing: "0.1em", zIndex: 11,
                    border: "1px solid rgba(239,68,68,0.6)",
                }}>
                    ✕ {beforeLabel}
                </div>

                {/* AFTER label */}
                <div style={{
                    position: "absolute", top: "1rem", right: "1rem",
                    background: "rgba(16,185,129,0.85)", backdropFilter: "blur(4px)",
                    color: "white", padding: "0.3rem 0.9rem",
                    borderRadius: "99px", fontSize: "0.72rem", fontWeight: "800",
                    letterSpacing: "0.1em", zIndex: 11,
                    border: "1px solid rgba(16,185,129,0.4)",
                }}>
                    {afterLabel}
                </div>

                {/* Bottom info bar */}
                <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    background: "linear-gradient(transparent, rgba(0,0,0,0.8))",
                    padding: "1.5rem 1.25rem 0.75rem",
                    display: "flex", justifyContent: "space-between", alignItems: "flex-end",
                    zIndex: 11,
                }}>
                    <div>
                        <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", marginBottom: "0.2rem" }}>Reported Issue</div>
                        <div style={{ fontSize: "0.85rem", color: "white", fontWeight: "600" }}>Illegal Parking in Zone B</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", marginBottom: "0.2rem" }}>Resolution Time</div>
                        <div style={{ fontSize: "0.85rem", color: "#34d399", fontWeight: "700" }}>4h 15m ⚡</div>
                    </div>
                </div>
            </div>

            {/* Stats row below slider */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
                {[
                    { icon: "🚗", label: "Vehicles Removed", value: "11" },
                    { icon: "👥", label: "Citizens Benefited", value: "~2,400" },
                    { icon: "⭐", label: "Resolution Rating", value: "4.8 / 5" },
                ].map(stat => (
                    <div key={stat.label} className="glass" style={{ padding: "0.875rem 1rem", borderRadius: "0.75rem", textAlign: "center" }}>
                        <div style={{ fontSize: "1.25rem", marginBottom: "0.25rem" }}>{stat.icon}</div>
                        <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "#10b981" }}>{stat.value}</div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>{stat.label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
