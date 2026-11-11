import React from "react";

export interface ChiefComplaint {
    id: string;
    subject: string;
    category: string;
    priority: string;
    status: string;
    user: string;
    location: string;
    date: string;
}

export interface TrendDay {
    day: string;
    Filed: number;
    Resolved: number;
}

export interface ChiefPrintReportProps {
    total: number;
    pending: number;
    inProgress: number;
    resolved: number;
    critical: number;
    resolutionRate: number;
    complaints: ChiefComplaint[];
    categoryCounts: Record<string, number>;
    trendData: TrendDay[];
    priorityCounts: Record<string, number>;
    renderMode?: "all" | "page1-only" | "page2-only";
}

const CATEGORY_COLORS: Record<string, string> = {
    Infrastructure: "#4f46e5",
    Environment: "#059669",
    Safety: "#d97706",
    "Public Health": "#dc2626",
    Administrative: "#7c3aed",
    Other: "#0891b2",
};

const PRIORITY_META: Record<string, { color: string; bg: string; border: string }> = {
    Critical: { color: "#b91c1c", bg: "#fef2f2", border: "#fecaca" },
    High:     { color: "#c2410c", bg: "#fff7ed", border: "#fed7aa" },
    Medium:   { color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
    Low:      { color: "#047857", bg: "#ecfdf5", border: "#a7f3d0" },
};

const STATUS_META: Record<string, { color: string; bg: string; border: string }> = {
    Resolved:    { color: "#047857", bg: "#ecfdf5", border: "#a7f3d0" },
    "In Progress": { color: "#4338ca", bg: "#eef2ff", border: "#c7d2fe" },
    Pending:     { color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
    Rejected:    { color: "#b91c1c", bg: "#fef2f2", border: "#fecaca" },
};

export default function ChiefPrintReport({
    total,
    pending,
    inProgress,
    resolved,
    critical,
    resolutionRate,
    complaints,
    categoryCounts,
    trendData,
    priorityCounts,
    renderMode = "all",
}: ChiefPrintReportProps) {
    const currentDate = new Date().toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
    });

    /* ── Compute SVG Line Chart coordinates ────────────────────────────── */
    const svgWidth = 670;
    const svgHeight = 115;
    const padL = 35;
    const padR = 20;
    const padT = 15;
    const padB = 25;
    const chartW = svgWidth - padL - padR;
    const chartH = svgHeight - padT - padB;

    const maxVal = Math.max(
        ...trendData.map(d => Math.max(d.Filed, d.Resolved)),
        4
    );

    const getX = (i: number) => padL + (i / Math.max(trendData.length - 1, 1)) * chartW;
    const getY = (val: number) => padT + chartH - (val / maxVal) * chartH;

    const filedPoints = trendData.map((d, i) => `${getX(i)},${getY(d.Filed)}`).join(" ");
    const resolvedPoints = trendData.map((d, i) => `${getX(i)},${getY(d.Resolved)}`).join(" ");

    const renderPage1 = () => (
        <div className="chief-print-page chief-page-1">
                {/* ── Document Header ── */}
                <div className="dossier-header">
                    <div className="dossier-branding">
                        <div className="dossier-emblem">🏛️</div>
                        <div>
                            <div className="dossier-super">OFFICIAL CIVIC RECORD</div>
                            <h1 className="dossier-title">AI Grievance System — Chief Executive Report</h1>
                            <div className="dossier-sub">
                                Office of the Chief Administrator · City Grievance Overview
                            </div>
                        </div>
                    </div>
                    <div className="dossier-meta">
                        <span className="dossier-clearance">OFFICIAL REPORT</span>
                        <div className="dossier-date">Generated: <strong>{currentDate}</strong></div>
                        <div className="dossier-ref">Ref: <strong>MUNI-REPORT-2026</strong></div>
                    </div>
                </div>

                {/* ── Section 1: Executive KPI Metrics ── */}
                <div className="dossier-section-title">
                    <span>01</span> EXECUTIVE PERFORMANCE METRICS
                </div>
                <div className="dossier-kpi-grid">
                    <div className="dossier-kpi-card">
                        <div className="kpi-icon-wrap" style={{ background: "#eef2ff", color: "#4f46e5" }}>📋</div>
                        <div className="kpi-num" style={{ color: "#4f46e5" }}>{total}</div>
                        <div className="kpi-label">Total Grievances</div>
                        <div className="kpi-note">Recorded to date</div>
                    </div>
                    <div className="dossier-kpi-card">
                        <div className="kpi-icon-wrap" style={{ background: "#fffbeb", color: "#d97706" }}>⏳</div>
                        <div className="kpi-num" style={{ color: "#d97706" }}>{pending}</div>
                        <div className="kpi-label">Pending Action</div>
                        <div className="kpi-note">Awaiting review</div>
                    </div>
                    <div className="dossier-kpi-card">
                        <div className="kpi-icon-wrap" style={{ background: "#eef2ff", color: "#6366f1" }}>🔄</div>
                        <div className="kpi-num" style={{ color: "#6366f1" }}>{inProgress}</div>
                        <div className="kpi-label">In Progress</div>
                        <div className="kpi-note">Active officer routing</div>
                    </div>
                    <div className="dossier-kpi-card">
                        <div className="kpi-icon-wrap" style={{ background: "#ecfdf5", color: "#059669" }}>✅</div>
                        <div className="kpi-num" style={{ color: "#059669" }}>{resolved}</div>
                        <div className="kpi-label">Resolved Cases</div>
                        <div className="kpi-note">Successfully closed</div>
                    </div>
                    <div className="dossier-kpi-card">
                        <div className="kpi-icon-wrap" style={{ background: "#fef2f2", color: "#dc2626" }}>🚨</div>
                        <div className="kpi-num" style={{ color: "#dc2626" }}>{critical}</div>
                        <div className="kpi-label">Critical Urgency</div>
                        <div className="kpi-note">Priority escalation</div>
                    </div>
                    <div className="dossier-kpi-card">
                        <div className="kpi-icon-wrap" style={{ background: "#ecfeff", color: "#0891b2" }}>📈</div>
                        <div className="kpi-num" style={{ color: "#0891b2" }}>{resolutionRate}%</div>
                        <div className="kpi-label">Resolution Rate</div>
                        <div className="kpi-note">{resolved} of {total} completed</div>
                    </div>
                </div>

                {/* ── Section 2: 7-Day Velocity Trend (Pure SVG Vector) ── */}
                <div className="dossier-section-title" style={{ marginTop: "0.6rem" }}>
                    <span>02</span> INTAKE VS. RESOLUTION VELOCITY (7-DAY AUDIT TRAIL)
                </div>
                <div className="dossier-card" style={{ padding: "0.5rem 0.8rem 0.4rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
                        <div style={{ fontSize: "0.72rem", color: "#475569", fontWeight: "600" }}>
                            Daily citizen complaint filings vs. administrative closures
                        </div>
                        <div style={{ display: "flex", gap: "1rem", fontSize: "0.68rem", fontWeight: "700" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: "#4f46e5" }}>
                                <span style={{ width: 10, height: 3, background: "#4f46e5", display: "inline-block", borderRadius: 2 }} />
                                Complaints Filed
                            </span>
                            <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: "#059669" }}>
                                <span style={{ width: 10, height: 3, background: "#059669", display: "inline-block", borderRadius: 2 }} />
                                Cases Resolved
                            </span>
                        </div>
                    </div>

                    {/* Pure SVG Vector Graph */}
                    <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: "100%", height: "95px", display: "block" }}>
                        {/* Grid lines */}
                        {[0, 0.5, 1].map((pct, idx) => {
                            const y = padT + chartH * (1 - pct);
                            return (
                                <g key={idx}>
                                    <line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
                                    <text x={padL - 6} y={y + 3} fontSize="8" fill="#94a3b8" textAnchor="end" fontWeight="600">
                                        {Math.round(maxVal * pct)}
                                    </text>
                                </g>
                            );
                        })}

                        {/* X-axis date labels */}
                        {trendData.map((d, i) => (
                            <text key={i} x={getX(i)} y={padT + chartH + 16} fontSize="8" fill="#64748b" textAnchor="middle" fontWeight="600">
                                {d.day}
                            </text>
                        ))}

                        {/* Trend polylines */}
                        <polyline points={filedPoints} fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points={resolvedPoints} fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                        {/* Data point dots */}
                        {trendData.map((d, i) => (
                            <g key={i}>
                                <circle cx={getX(i)} cy={getY(d.Filed)} r="3" fill="#4f46e5" stroke="#ffffff" strokeWidth="1.5" />
                                <circle cx={getX(i)} cy={getY(d.Resolved)} r="3" fill="#059669" stroke="#ffffff" strokeWidth="1.5" />
                            </g>
                        ))}
                    </svg>
                </div>

                {/* ── Section 3: Operational Breakdown (Urgency & Categories) ── */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginTop: "0.6rem" }}>
                    {/* Urgency Distribution */}
                    <div>
                        <div className="dossier-section-title">
                            <span>03A</span> PRIORITY URGENCY BREAKDOWN
                        </div>
                        <div className="dossier-card" style={{ padding: "0.6rem 0.8rem" }}>
                            {["Critical", "High", "Medium", "Low"].map((prio) => {
                                const cnt = priorityCounts[prio] || 0;
                                const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
                                const meta = PRIORITY_META[prio];
                                return (
                                    <div key={prio} style={{ marginBottom: "0.45rem" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem", fontSize: "0.72rem" }}>
                                            <span style={{ fontWeight: "700", color: meta.color }}>
                                                {prio === "Critical" ? "🚨 Critical Urgency" : prio === "High" ? "⚠️ High Priority" : prio === "Medium" ? "📌 Medium Priority" : "🟢 Low Priority"}
                                            </span>
                                            <span style={{ fontWeight: "800", color: "#0f172a" }}>
                                                {cnt} <span style={{ color: "#64748b", fontWeight: "500", fontSize: "0.65rem" }}>({pct}%)</span>
                                            </span>
                                        </div>
                                        <div style={{ height: "6px", background: "#f1f5f9", borderRadius: "99px", overflow: "hidden" }}>
                                            <div style={{ width: `${pct}%`, height: "100%", background: meta.color, borderRadius: "99px" }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Category Distribution */}
                    <div>
                        <div className="dossier-section-title">
                            <span>03B</span> GRIEVANCE CATEGORY AUDIT
                        </div>
                        <div className="dossier-card" style={{ padding: "0.6rem 0.8rem" }}>
                            {Object.entries(categoryCounts).length > 0 ? (
                                Object.entries(categoryCounts)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([cat, count]) => {
                                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                                        const color = CATEGORY_COLORS[cat] || "#4f46e5";
                                        return (
                                            <div key={cat} style={{ marginBottom: "0.35rem" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", marginBottom: "0.15rem" }}>
                                                    <span style={{ fontWeight: "600", color: "#1e293b" }}>{cat}</span>
                                                    <span style={{ fontWeight: "700", color }}>
                                                        {count} <span style={{ color: "#64748b", fontWeight: "400", fontSize: "0.65rem" }}>({pct}%)</span>
                                                    </span>
                                                </div>
                                                <div style={{ height: "5px", background: "#f1f5f9", borderRadius: "99px", overflow: "hidden" }}>
                                                    <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: "99px" }} />
                                                </div>
                                            </div>
                                        );
                                    })
                            ) : (
                                <p style={{ fontSize: "0.75rem", color: "#64748b" }}>No category records logged.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Section 4: Departmental Authority & Caseload Allocation ── */}
                <div className="dossier-section-title" style={{ marginTop: "0.6rem" }}>
                    <span>04</span> DEPARTMENTAL AUTHORITY CASELOAD ALLOCATION
                </div>
                <div className="dossier-officer-grid">
                    {[
                        { name: "Officer Priya",  dept: "Environment",    category: "Environment" },
                        { name: "Officer Singh",  dept: "Infrastructure", category: "Infrastructure" },
                        { name: "Officer Reddy",  dept: "Public Health",  category: "Public Health" },
                        { name: "Officer Meera",  dept: "Safety",         category: "Safety" },
                    ].map(officer => {
                        const load = complaints.filter(c =>
                            c.category === officer.category &&
                            (c.status === "Pending" || c.status === "In Progress")
                        ).length;
                        const status = load === 0 ? "Available" : load <= 3 ? "Active" : "Busy";
                        const statusColor = status === "Available" ? "#059669" : status === "Active" ? "#4f46e5" : "#dc2626";
                        const initials = officer.name.split(" ").map(n => n[0]).join("");
                        return (
                            <div key={officer.name} className="dossier-officer-card">
                                <div className="officer-badge">{initials}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: "0.78rem", color: "#0f172a", whiteSpace: "nowrap" }}>
                                        {officer.name}
                                    </div>
                                    <div style={{ fontSize: "0.68rem", color: "#64748b", whiteSpace: "nowrap" }}>
                                        {officer.dept} · <strong>{load}</strong> active {load === 1 ? "case" : "cases"}
                                    </div>
                                </div>
                                <span style={{
                                    fontSize: "0.65rem", fontWeight: 700,
                                    padding: "0.2rem 0.55rem", borderRadius: "99px",
                                    background: `${statusColor}14`, color: statusColor,
                                    border: `1px solid ${statusColor}30`,
                                    whiteSpace: "nowrap", flexShrink: 0,
                                }}>
                                    {status}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* ── Section 5: Executive Operational Intelligence Brief ── */}
                <div className="dossier-section-title" style={{ marginTop: "0.6rem" }}>
                    <span>05</span> EXECUTIVE OPERATIONAL INTELLIGENCE BRIEF
                </div>
                <div className="dossier-intel-grid">
                    <div className="dossier-intel-card">
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.25rem" }}>
                            <span style={{ fontSize: "0.85rem" }}>🎯</span>
                            <span style={{ fontSize: "0.68rem", fontWeight: 800, color: "#0f172a", textTransform: "uppercase" }}>Primary Civic Focus</span>
                        </div>
                        {(() => {
                            const topCat = Object.entries(categoryCounts).sort(([, a], [, b]) => b - a)[0];
                            const topName = topCat ? topCat[0] : "General";
                            const topPct = total > 0 && topCat ? Math.round((topCat[1] / total) * 100) : 0;
                            return (
                                <>
                                    <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#4f46e5", marginBottom: "0.2rem" }}>
                                        {topName} ({topPct}% of Intake)
                                    </div>
                                    <div style={{ fontSize: "0.65rem", color: "#64748b", lineHeight: 1.3 }}>
                                        Leading municipal category; field inspection teams deployed to high-density zones.
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    <div className="dossier-intel-card">
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.25rem" }}>
                            <span style={{ fontSize: "0.85rem" }}>🚨</span>
                            <span style={{ fontSize: "0.68rem", fontWeight: 800, color: "#0f172a", textTransform: "uppercase" }}>Urgency & Escalations</span>
                        </div>
                        <div style={{ fontSize: "0.85rem", fontWeight: 800, color: critical > 0 ? "#dc2626" : "#059669", marginBottom: "0.2rem" }}>
                            {critical > 0 ? `${critical} Critical Escalations` : "Zero Critical Overdues"}
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "#64748b", lineHeight: 1.3 }}>
                            Triage routed under emergency SLA; automated alerts actively notifying department heads.
                        </div>
                    </div>

                    <div className="dossier-intel-card">
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.25rem" }}>
                            <span style={{ fontSize: "0.85rem" }}>⚡</span>
                            <span style={{ fontSize: "0.68rem", fontWeight: 800, color: "#0f172a", textTransform: "uppercase" }}>Redressal Velocity</span>
                        </div>
                        <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#059669", marginBottom: "0.2rem" }}>
                            {resolutionRate}% Redressal Pace
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "#64748b", lineHeight: 1.3 }}>
                            {resolved} cases completed to date; active caseload distributed across 4 zonal authority officers.
                        </div>
                    </div>
                </div>

                {/* ── Page 1 Running Footer ── */}
                <div className="dossier-footer">
                    <span>AI Grievance System — Chief Executive Report</span>
                    <span>Official Administrative Record · Confidential</span>
                    <span>Page 1 of 2</span>
                </div>
        </div>
    );

    const renderPage2 = () => (
        <div className="chief-print-page chief-page-2">
                {/* ── Page 2 Header ── */}
                <div className="ledger-header-box">
                    <div>
                        <div style={{ fontSize: "0.62rem", fontWeight: 800, color: "#4f46e5", letterSpacing: "0.06em" }}>
                            SECTION 06 · COMPLETE AUDIT LEDGER
                        </div>
                        <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", margin: "0.15rem 0" }}>
                            Municipal Citizen Grievance Audit Ledger
                        </h2>
                        <div style={{ fontSize: "0.68rem", color: "#475569" }}>
                            Comprehensive record of citizen grievances with routing, location, urgency, and operational status
                        </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <span className="ledger-count-badge">RECORD COUNT: {total}</span>
                        <div style={{ fontSize: "0.65rem", color: "#64748b", marginTop: "0.2rem" }}>
                            Status: <strong>SHA-256 Validated</strong>
                        </div>
                    </div>
                </div>

                {/* ── Page 2 Ledger Summary Status Bar ── */}
                <div className="ledger-summary-bar">
                    <div className="ledger-summary-pill">
                        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#475569" }}>📋 Audited Records</span>
                        <strong style={{ fontSize: "0.85rem", color: "#0f172a" }}>{total}</strong>
                    </div>
                    <div className="ledger-summary-pill">
                        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#d97706" }}>⏳ Awaiting Action</span>
                        <strong style={{ fontSize: "0.85rem", color: "#d97706" }}>{pending}</strong>
                    </div>
                    <div className="ledger-summary-pill">
                        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#4f46e5" }}>🔄 In Progress</span>
                        <strong style={{ fontSize: "0.85rem", color: "#4f46e5" }}>{inProgress}</strong>
                    </div>
                    <div className="ledger-summary-pill">
                        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#059669" }}>✅ Resolved Cases</span>
                        <strong style={{ fontSize: "0.85rem", color: "#059669" }}>{resolved}</strong>
                    </div>
                </div>

                {/* ── Comprehensive Ledger Table ── */}
                <table className="dossier-table">
                    <thead>
                        <tr>
                            <th style={{ width: "10%" }}>ID</th>
                            <th style={{ width: "28%" }}>Subject & Category</th>
                            <th style={{ width: "16%" }}>Citizen Contact</th>
                            <th style={{ width: "14%" }}>Location / Zone</th>
                            <th style={{ width: "10%", textAlign: "center" }}>Priority</th>
                            <th style={{ width: "11%", textAlign: "center" }}>Status</th>
                            <th style={{ width: "11%", textAlign: "center" }}>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {complaints.map(c => {
                            const pMeta = PRIORITY_META[c.priority] || PRIORITY_META.Medium;
                            const sMeta = STATUS_META[c.status] || STATUS_META.Pending;
                            const catColor = CATEGORY_COLORS[c.category] || "#4f46e5";
                            return (
                                <tr key={c.id}>
                                    <td className="col-nowrap" style={{ fontWeight: 700, fontFamily: "monospace", color: "#4338ca", fontSize: "0.72rem" }}>
                                        {c.id}
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 600, color: "#0f172a", fontSize: "0.75rem", lineHeight: 1.25, marginBottom: "2px" }}>
                                            {c.subject}
                                        </div>
                                        <span style={{ fontSize: "0.62rem", fontWeight: 700, color: catColor }}>
                                            ● {c.category}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ color: "#475569", fontSize: "0.7rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "115px" }} title={c.user}>
                                            {c.user}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ color: "#475569", fontSize: "0.7rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "105px" }} title={c.location}>
                                            📍 {c.location}
                                        </div>
                                    </td>
                                    <td className="col-nowrap" style={{ textAlign: "center" }}>
                                        <span style={{
                                            display: "inline-block", padding: "2px 7px",
                                            borderRadius: "4px", fontSize: "0.65rem", fontWeight: 800,
                                            whiteSpace: "nowrap",
                                            background: pMeta.bg, color: pMeta.color, border: `1px solid ${pMeta.border}`,
                                        }}>
                                            {c.priority}
                                        </span>
                                    </td>
                                    <td className="col-nowrap" style={{ textAlign: "center" }}>
                                        <span style={{
                                            display: "inline-block", padding: "2px 7px",
                                            borderRadius: "4px", fontSize: "0.65rem", fontWeight: 800,
                                            whiteSpace: "nowrap",
                                            background: sMeta.bg, color: sMeta.color, border: `1px solid ${sMeta.border}`,
                                        }}>
                                            {c.status}
                                        </span>
                                    </td>
                                    <td className="col-nowrap" style={{ textAlign: "center", color: "#64748b", fontSize: "0.7rem", fontWeight: 600 }}>
                                        {c.date}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* ── Official Executive Audit Sign-Off Box ── */}
                <div className="dossier-signoff-box">
                    <div className="signoff-left">
                        <span className="signoff-badge">VERIFIED ADMINISTRATIVE RECORD</span>
                        <p style={{ margin: "0.35rem 0 0.15rem", fontSize: "0.75rem", color: "#1e293b", fontWeight: "700" }}>
                            System-generated civic grievance audit ledger from AI Municipal Portal.
                        </p>
                        <p style={{ margin: 0, fontSize: "0.65rem", color: "#64748b" }}>
                            Cryptographic Integrity: SHA-256 Validated · Access: Chief Executive Review
                        </p>
                    </div>

                    <div className="signoff-center">
                        <div className="seal-box">
                            <div style={{ fontSize: "1.4rem", lineHeight: 1 }}>🏛️</div>
                            <div style={{ fontSize: "0.62rem", fontWeight: "800", color: "#0f172a", letterSpacing: "0.06em", marginTop: "2px" }}>
                                OFFICIALLY VERIFIED
                            </div>
                            <div style={{ fontSize: "0.58rem", color: "#64748b", fontWeight: "600" }}>
                                MUNICIPAL AUDIT
                            </div>
                        </div>
                    </div>

                    <div className="signoff-right">
                        <div className="signature-line" />
                        <div style={{ fontWeight: "800", fontSize: "0.78rem", color: "#0f172a" }}>Chief Administrative Officer</div>
                        <div style={{ fontSize: "0.68rem", color: "#64748b" }}>Municipal Grievance Redressal Board</div>
                    </div>
                </div>

                {/* ── Page 2 Running Footer ── */}
                <div className="dossier-footer">
                    <span>AI Grievance System — Chief Executive Report</span>
                    <span>Official Administrative Record · Confidential</span>
                    <span>Page 2 of 2</span>
                </div>
        </div>
    );

    if (renderMode === "page1-only") {
        return <div className="chief-modal-dossier-preview">{renderPage1()}</div>;
    }

    if (renderMode === "page2-only") {
        return <div className="chief-modal-dossier-preview">{renderPage2()}</div>;
    }

    return (
        <div className="chief-print-dossier">
            {renderPage1()}
            {renderPage2()}
        </div>
    );
}
