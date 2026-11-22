"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { getComplaintsServerAction } from "@/app/actions/complaintActions";
import { getDistrictOfficersServerAction, RegisteredOfficer } from "@/app/actions/authActions";

interface GrievanceItem {
    id: string;
    subject: string;
    category: string;
    priority: string;
    status: string;
    location: string;
    date: string;
}

interface DisplayOfficer {
    id: string;
    name: string;
    designation: string;
    category: string;
    serviceId: string;
    officeLocation: string;
    phone: string;
    email: string;
    icon: string;
    avatarGrad: string;
    accentColor: string;
    isRealRegistered: boolean;
}

// Maps any authority role string from the signup/login page to the 5 core grievance departments
function mapRoleToDepartment(role: string): string {
    const r = (role || "").toLowerCase();
    if (r.includes("environment")) return "Environment";
    if (r.includes("health") || r.includes("sanitation")) return "Public Health";
    if (r.includes("infrastructure") || r.includes("pwd") || r.includes("electricity") || r.includes("water") || r.includes("engineer")) return "Infrastructure";
    if (r.includes("safety") || r.includes("traffic") || r.includes("police")) return "Safety";
    if (r.includes("revenue") || r.includes("education") || r.includes("administrative") || r.includes("municipal") || r.includes("collector")) return "Administrative";
    return "Administrative";
}

const DEPT_METADATA: Record<string, { icon: string; avatarGrad: string; accentColor: string; defaultTitle: string; defaultOffice: string }> = {
    Environment: {
        icon: "🌿",
        avatarGrad: "linear-gradient(135deg, #10b981, #059669)",
        accentColor: "#10b981",
        defaultTitle: "Environmental Protection Officer",
        defaultOffice: "City Municipal Corporation, Bharathidasan Salai",
    },
    Infrastructure: {
        icon: "🏗️",
        avatarGrad: "linear-gradient(135deg, #6366f1, #4f46e5)",
        accentColor: "#6366f1",
        defaultTitle: "Executive Engineer (Infrastructure & PWD)",
        defaultOffice: "PWD Divisional Complex, Cantonment",
    },
    "Public Health": {
        icon: "🏥",
        avatarGrad: "linear-gradient(135deg, #06b6d4, #0891b2)",
        accentColor: "#06b6d4",
        defaultTitle: "Chief District Health & Sanitation Inspector",
        defaultOffice: "District Health Office, Collectorate Annexe",
    },
    Safety: {
        icon: "🛡️",
        avatarGrad: "linear-gradient(135deg, #f59e0b, #d97706)",
        accentColor: "#f59e0b",
        defaultTitle: "District Traffic & Law Enforcement Officer",
        defaultOffice: "District Traffic Control HQ, Court Complex Road",
    },
    Administrative: {
        icon: "📁",
        avatarGrad: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
        accentColor: "#8b5cf6",
        defaultTitle: "Special Tahsildar (Revenue & District Administration)",
        defaultOffice: "Taluk Office Compound, Collectorate Campus",
    },
};

const BASELINE_DEPTS = ["Environment", "Infrastructure", "Public Health", "Safety", "Administrative"];

export default function DistrictOfficersPage() {
    const { user } = useAuth();
    const { t } = useLang();

    const [complaints, setComplaints] = useState<GrievanceItem[]>([]);
    const [registeredOfficers, setRegisteredOfficers] = useState<RegisteredOfficer[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<"All" | "Available" | "Active" | "Busy">("All");
    const [searchTerm, setSearchTerm] = useState("");

    const roleStr = `${user?.authorityRole || ""} ${user?.department || ""} ${user?.username || ""} ${user?.email || ""}`.toLowerCase();
    const isDistrictHead =
        roleStr.includes("collector") ||
        roleStr.includes("magistrate") ||
        roleStr.includes("commissioner") ||
        user?.role === "chief";

    const officerDistrict = user?.district || "Tiruchirappalli";
    const officerState = user?.state || "Tamil Nadu";

    useEffect(() => {
        let mounted = true;
        const loadAllData = async () => {
            setLoading(true);
            try {
                // Parallel fetch: grievances and real registered officers from Supabase
                const [complaintsRes, officersRes] = await Promise.all([
                    getComplaintsServerAction(),
                    getDistrictOfficersServerAction(officerDistrict),
                ]);

                if (complaintsRes.success && complaintsRes.complaints && mounted) {
                    const mapped: GrievanceItem[] = complaintsRes.complaints.map(c => ({
                        id: c.id,
                        subject: c.subject || "Grievance",
                        category: c.category || "General",
                        priority: c.priority || "Medium",
                        status: c.status || "Pending",
                        location: c.location || "",
                        date: c.created_at ? new Date(c.created_at).toLocaleDateString() : "Recent",
                    }));
                    setComplaints(mapped);
                }

                if (officersRes.success && officersRes.officers && mounted) {
                    setRegisteredOfficers(officersRes.officers);
                }
            } catch (err) {
                console.error("Failed to load officers data:", err);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        loadAllData();
        return () => {
            mounted = false;
        };
    }, [officerDistrict]);

    // Filter grievances strictly to the Collector's district (e.g. Tiruchirappalli)
    const districtComplaints = useMemo(() => {
        return complaints.filter(c => {
            if (officerDistrict === "Tiruchirappalli") {
                return (
                    /trichy|tiruchirappalli|kaikatti|10\.95|78\.44/i.test(c.location || "") ||
                    /green valley|shanti nagar|gandhi nagar|city mall|industrial area|rampur|nh-48|general hospital/i.test(c.location || "")
                );
            }
            const dLower = officerDistrict.toLowerCase();
            return (c.location || "").toLowerCase().includes(dLower);
        });
    }, [complaints, officerDistrict]);

    // Build the dynamic officers list merging REAL registered officers from Supabase
    const displayOfficers = useMemo(() => {
        // Exclude the collector themselves from the field officers list so they don't appear as their own subordinate
        const fieldOfficers = registeredOfficers.filter(o => {
            const r = (o.authorityRole || "").toLowerCase();
            return !r.includes("collector") && !r.includes("magistrate") && o.email !== user?.email;
        });

        // Group registered officers by department
        const registeredByDept: Record<string, RegisteredOfficer[]> = {};
        fieldOfficers.forEach(o => {
            const dept = mapRoleToDepartment(o.authorityRole || "");
            if (!registeredByDept[dept]) registeredByDept[dept] = [];
            registeredByDept[dept].push(o);
        });

        const list: DisplayOfficer[] = [];

        // For each of the 5 baseline departments:
        BASELINE_DEPTS.forEach(dept => {
            const meta = DEPT_METADATA[dept] || DEPT_METADATA.Administrative;
            const regList = registeredByDept[dept];

            if (regList && regList.length > 0) {
                // User's real registered officer exists in Supabase!
                regList.forEach(reg => {
                    list.push({
                        id: `reg-${reg.email}`,
                        name: reg.username || "Department Field Officer",
                        designation: reg.authorityRole || meta.defaultTitle,
                        category: dept,
                        serviceId: reg.serviceId || "TN-GOV-OFFICER",
                        officeLocation: `${officerDistrict} ${meta.defaultOffice}`,
                        phone: reg.phone || "+91 94432 00000",
                        email: reg.email,
                        icon: meta.icon,
                        avatarGrad: meta.avatarGrad,
                        accentColor: meta.accentColor,
                        isRealRegistered: true,
                    });
                });
            } else {
                // If no real officer has registered for this department yet, keep standard department post
                list.push({
                    id: `post-${dept}`,
                    name: `${dept} Field Liaison Officer`,
                    designation: meta.defaultTitle,
                    category: dept,
                    serviceId: `TN-${dept.slice(0, 3).toUpperCase()}-POST`,
                    officeLocation: `${officerDistrict} ${meta.defaultOffice}`,
                    phone: "+91 94432 00000",
                    email: `${dept.toLowerCase()}@${officerDistrict.toLowerCase()}.tn.gov.in`,
                    icon: meta.icon,
                    avatarGrad: meta.avatarGrad,
                    accentColor: meta.accentColor,
                    isRealRegistered: false,
                });
            }
        });

        return list;
    }, [registeredOfficers, user?.email, officerDistrict]);

    // Calculate real-time live duty status for each officer based on actual active complaints
    const officerWorkloads = useMemo(() => {
        return displayOfficers.map(officer => {
            const deptGrievances = districtComplaints.filter(c => c.category === officer.category);
            const activeGrievances = deptGrievances.filter(c => c.status === "Pending" || c.status === "In Progress");
            const resolvedCount = deptGrievances.filter(c => c.status === "Resolved").length;

            let dutyStatus: "Available" | "Active" | "Busy" = "Available";
            let statusColor = "#10b981";
            let statusBg = "rgba(16, 185, 129, 0.12)";
            let statusBorder = "rgba(16, 185, 129, 0.3)";

            if (activeGrievances.length >= 3) {
                dutyStatus = "Busy";
                statusColor = "#ef4444";
                statusBg = "rgba(239, 68, 68, 0.12)";
                statusBorder = "rgba(239, 68, 68, 0.3)";
            } else if (activeGrievances.length >= 1) {
                dutyStatus = "Active";
                statusColor = "#f59e0b";
                statusBg = "rgba(245, 158, 11, 0.12)";
                statusBorder = "rgba(245, 158, 11, 0.3)";
            }

            return {
                ...officer,
                totalAssigned: deptGrievances.length,
                activeCount: activeGrievances.length,
                resolvedCount,
                activeGrievances,
                dutyStatus,
                statusColor,
                statusBg,
                statusBorder,
            };
        });
    }, [displayOfficers, districtComplaints]);

    // KPI Totals
    const totalOfficers = officerWorkloads.length;
    const availableCount = officerWorkloads.filter(o => o.dutyStatus === "Available").length;
    const activeCount = officerWorkloads.filter(o => o.dutyStatus === "Active").length;
    const busyCount = officerWorkloads.filter(o => o.dutyStatus === "Busy").length;

    // Filtered by search & duty pill
    const filteredOfficers = useMemo(() => {
        return officerWorkloads.filter(o => {
            if (statusFilter !== "All" && o.dutyStatus !== statusFilter) return false;
            if (searchTerm.trim()) {
                const q = searchTerm.toLowerCase();
                const matchesName = o.name.toLowerCase().includes(q);
                const matchesDept = o.category.toLowerCase().includes(q);
                const matchesRole = o.designation.toLowerCase().includes(q);
                const matchesEmail = o.email.toLowerCase().includes(q);
                return matchesName || matchesDept || matchesRole || matchesEmail;
            }
            return true;
        });
    }, [officerWorkloads, statusFilter, searchTerm]);

    return (
        <ProtectedRoute allowedRoles={["authority", "chief"]}>
            <div className="container" style={{ padding: "2rem 1.25rem 4rem", maxWidth: "1250px", margin: "0 auto" }}>

                {/* ── Security Isolation Check: Only Collector / Chief ── */}
                {!isDistrictHead ? (
                    <div className="glass" style={{
                        padding: "3rem 2rem",
                        borderRadius: "1.25rem",
                        textAlign: "center",
                        marginTop: "2rem",
                        border: "1px solid rgba(239, 68, 68, 0.25)",
                    }}>
                        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔒</div>
                        <h2 style={{ fontSize: "1.5rem", fontWeight: "800", color: "#f8fafc", marginBottom: "0.5rem" }}>
                            District Executive Roster Restricted
                        </h2>
                        <p style={{ color: "var(--text-muted)", maxWidth: "540px", margin: "0 auto 1.5rem", fontSize: "0.95rem" }}>
                            The District Field Officers Duty Roster is confidential and exclusively accessible to the <strong>District Collector &amp; District Magistrate</strong> and State Chief Officers.
                        </p>
                        <Link href="/admin" className="btn btn-primary" style={{ textDecoration: "none", display: "inline-block" }}>
                            ← Return to Authority Portal
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* ── Top Breadcrumb & Executive Header ── */}
                        <div style={{ marginBottom: "1.75rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.75rem" }}>
                                <Link
                                    href="/admin"
                                    style={{
                                        fontSize: "0.82rem",
                                        fontWeight: "700",
                                        color: "var(--primary)",
                                        textDecoration: "none",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "0.35rem",
                                    }}
                                >
                                    <span>←</span>
                                    <span>Return to Complaints Portal</span>
                                </Link>
                                <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>/</span>
                                <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: "600" }}>
                                    District Officers Roster
                                </span>
                            </div>

                            <div style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                flexWrap: "wrap",
                                gap: "1rem",
                                borderBottom: "1px solid var(--border)",
                                paddingBottom: "1.5rem",
                            }}>
                                <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                                        <h1 style={{ fontSize: "1.85rem", fontWeight: "900", color: "#f8fafc", letterSpacing: "-0.02em", margin: 0 }}>
                                            District Field Officers &amp; Workload Command
                                        </h1>
                                        <span style={{
                                            padding: "0.25rem 0.65rem",
                                            borderRadius: "99px",
                                            background: "rgba(245, 158, 11, 0.15)",
                                            border: "1px solid rgba(245, 158, 11, 0.35)",
                                            color: "#fbbf24",
                                            fontSize: "0.75rem",
                                            fontWeight: "800",
                                            letterSpacing: "0.03em",
                                        }}>
                                            🏛️ {officerDistrict} District Collectorate
                                        </span>
                                    </div>
                                    <p style={{ marginTop: "0.4rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                                        Supervised by <strong>{user?.username || "District Collector"}</strong> ({user?.email}) · Live duty roster &amp; real-time grievance allocation.
                                    </p>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                                    <div style={{
                                        padding: "0.4rem 0.85rem",
                                        borderRadius: "0.65rem",
                                        background: "rgba(16, 185, 129, 0.1)",
                                        border: "1px solid rgba(16, 185, 129, 0.25)",
                                        fontSize: "0.78rem",
                                        fontWeight: "700",
                                        color: "#10b981",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.4rem",
                                    }}>
                                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", display: "inline-block", boxShadow: "0 0 8px #10b981" }} />
                                        <span>Live Supabase Sync Active</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── KPI Stat Cards ── */}
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                            gap: "1rem",
                            marginBottom: "2rem",
                        }}>
                            {/* Card 1: Total Officers */}
                            <div className="glass card-hover" style={{
                                padding: "1.25rem 1.4rem",
                                borderRadius: "1rem",
                                borderTop: "3px solid #6366f1",
                                position: "relative",
                                overflow: "hidden",
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                                    <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "var(--text-muted)" }}>Total Field Officers</span>
                                    <span style={{ fontSize: "1.3rem" }}>👥</span>
                                </div>
                                <div style={{ fontSize: "2.2rem", fontWeight: "900", color: "#6366f1", lineHeight: 1 }}>
                                    {totalOfficers}
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.4rem" }}>
                                    Covering all 5 vital sectors in {officerDistrict}
                                </div>
                            </div>

                            {/* Card 2: Free / Available */}
                            <div className="glass card-hover" style={{
                                padding: "1.25rem 1.4rem",
                                borderRadius: "1rem",
                                borderTop: "3px solid #10b981",
                                position: "relative",
                                overflow: "hidden",
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                                    <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "var(--text-muted)" }}>Free &amp; Available</span>
                                    <span style={{ fontSize: "1.3rem" }}>🟢</span>
                                </div>
                                <div style={{ fontSize: "2.2rem", fontWeight: "900", color: "#10b981", lineHeight: 1 }}>
                                    {loading ? "···" : availableCount}
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.4rem" }}>
                                    0 active cases · Ready for urgent dispatch
                                </div>
                            </div>

                            {/* Card 3: Active On Duty */}
                            <div className="glass card-hover" style={{
                                padding: "1.25rem 1.4rem",
                                borderRadius: "1rem",
                                borderTop: "3px solid #f59e0b",
                                position: "relative",
                                overflow: "hidden",
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                                    <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "var(--text-muted)" }}>Active On Duty</span>
                                    <span style={{ fontSize: "1.3rem" }}>🟡</span>
                                </div>
                                <div style={{ fontSize: "2.2rem", fontWeight: "900", color: "#f59e0b", lineHeight: 1 }}>
                                    {loading ? "···" : activeCount}
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.4rem" }}>
                                    Resolving 1–2 field grievances
                                </div>
                            </div>

                            {/* Card 4: High Workload */}
                            <div className="glass card-hover" style={{
                                padding: "1.25rem 1.4rem",
                                borderRadius: "1rem",
                                borderTop: "3px solid #ef4444",
                                position: "relative",
                                overflow: "hidden",
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                                    <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "var(--text-muted)" }}>High Workload</span>
                                    <span style={{ fontSize: "1.3rem" }}>🔴</span>
                                </div>
                                <div style={{ fontSize: "2.2rem", fontWeight: "900", color: "#ef4444", lineHeight: 1 }}>
                                    {loading ? "···" : busyCount}
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.4rem" }}>
                                    3+ complaints pending resolution
                                </div>
                            </div>
                        </div>

                        {/* ── Control Bar: Filter Pills + Search ── */}
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "1rem",
                            marginBottom: "1.5rem",
                            flexWrap: "wrap",
                            padding: "0.75rem 1.25rem",
                            borderRadius: "1rem",
                            background: "rgba(255, 255, 255, 0.02)",
                            border: "1px solid var(--border)",
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                                <span style={{ fontSize: "0.78rem", fontWeight: "700", color: "var(--text-muted)", marginRight: "0.25rem" }}>
                                    Duty Filter:
                                </span>
                                {(["All", "Available", "Active", "Busy"] as const).map(f => {
                                    const isSel = statusFilter === f;
                                    return (
                                        <button
                                            key={f}
                                            onClick={() => setStatusFilter(f)}
                                            style={{
                                                padding: "0.3rem 0.85rem",
                                                borderRadius: "99px",
                                                fontSize: "0.76rem",
                                                fontWeight: "700",
                                                cursor: "pointer",
                                                border: isSel ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                                                background: isSel ? "var(--grad-primary)" : "rgba(255, 255, 255, 0.04)",
                                                color: isSel ? "white" : "var(--text-muted)",
                                                transition: "all 0.15s ease",
                                            }}
                                        >
                                            {f === "All" ? `All Officers (${totalOfficers})` :
                                                f === "Available" ? `🟢 Free (${availableCount})` :
                                                    f === "Active" ? `🟡 Active (${activeCount})` :
                                                        `🔴 Busy (${busyCount})`}
                                        </button>
                                    );
                                })}
                            </div>

                            <div style={{ position: "relative", minWidth: "240px" }}>
                                <input
                                    type="text"
                                    placeholder="Search by officer name, department, or email..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    style={{
                                        width: "100%",
                                        padding: "0.45rem 0.85rem",
                                        borderRadius: "0.6rem",
                                        border: "1px solid var(--border)",
                                        background: "rgba(255, 255, 255, 0.04)",
                                        color: "var(--text-main)",
                                        fontSize: "0.8rem",
                                        outline: "none",
                                    }}
                                />
                            </div>
                        </div>

                        {/* ── Officers Grid ── */}
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
                            gap: "1.25rem",
                        }}>
                            {filteredOfficers.map(officer => {
                                return (
                                    <div
                                        key={officer.id}
                                        className="glass card-hover"
                                        style={{
                                            borderRadius: "1.15rem",
                                            padding: "1.4rem",
                                            border: `1px solid rgba(255, 255, 255, 0.08)`,
                                            borderTop: `3px solid ${officer.accentColor}`,
                                            display: "flex",
                                            flexDirection: "column",
                                            justifyContent: "space-between",
                                            gap: "1.1rem",
                                            position: "relative",
                                        }}
                                    >
                                        {/* Top Card Section: Officer Info & Status */}
                                        <div>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", marginBottom: "0.9rem" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                                                    <div style={{
                                                        width: "48px",
                                                        height: "48px",
                                                        borderRadius: "14px",
                                                        background: officer.avatarGrad,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        fontSize: "1.5rem",
                                                        boxShadow: `0 4px 14px ${officer.accentColor}33`,
                                                        flexShrink: 0,
                                                    }}>
                                                        {officer.icon}
                                                    </div>
                                                    <div>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                                            <h3 style={{ fontSize: "1.05rem", fontWeight: "800", color: "#f8fafc", margin: 0 }}>
                                                                {officer.name}
                                                            </h3>
                                                            {officer.isRealRegistered && (
                                                                <span style={{
                                                                    fontSize: "0.6rem",
                                                                    padding: "0.1rem 0.35rem",
                                                                    borderRadius: "99px",
                                                                    background: "rgba(16, 185, 129, 0.15)",
                                                                    color: "#10b981",
                                                                    border: "1px solid rgba(16, 185, 129, 0.3)",
                                                                    fontWeight: "800",
                                                                }} title="Verified Registered Official Account">
                                                                    ✓ Registered
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div style={{ fontSize: "0.76rem", color: officer.accentColor, fontWeight: "700", marginTop: "0.15rem" }}>
                                                            {officer.designation}
                                                        </div>
                                                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.15rem", fontFamily: "monospace" }}>
                                                            ID: {officer.serviceId}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Status Badge */}
                                                <span style={{
                                                    padding: "0.25rem 0.65rem",
                                                    borderRadius: "99px",
                                                    fontSize: "0.7rem",
                                                    fontWeight: "800",
                                                    background: officer.statusBg,
                                                    color: officer.statusColor,
                                                    border: `1px solid ${officer.statusBorder}`,
                                                    letterSpacing: "0.03em",
                                                    textTransform: "uppercase",
                                                    whiteSpace: "nowrap",
                                                }}>
                                                    {officer.dutyStatus === "Available" ? "🟢 Free" :
                                                        officer.dutyStatus === "Active" ? "🟡 In Action" :
                                                            "🔴 Busy"}
                                                </span>
                                            </div>

                                            {/* Contact & Office Location */}
                                            <div style={{
                                                padding: "0.75rem 0.85rem",
                                                borderRadius: "0.75rem",
                                                background: "rgba(255, 255, 255, 0.02)",
                                                border: "1px solid rgba(255, 255, 255, 0.05)",
                                                fontSize: "0.76rem",
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: "0.35rem",
                                                marginBottom: "0.9rem",
                                            }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", color: "var(--text-muted)" }}>
                                                    <span>📍</span>
                                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                        {officer.officeLocation}
                                                    </span>
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                                                        <span>📞</span>
                                                        <a href={`tel:${officer.phone}`} style={{ color: "#93c5fd", textDecoration: "none", fontWeight: "600" }}>
                                                            {officer.phone}
                                                        </a>
                                                    </div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", color: "var(--text-muted)", fontSize: "0.72rem" }}>
                                                        <span>✉️</span>
                                                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: "160px" }}>{officer.email}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Workload Meter & Metrics */}
                                            <div style={{ marginBottom: "0.85rem" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", marginBottom: "0.35rem" }}>
                                                    <span style={{ color: "var(--text-muted)", fontWeight: "600" }}>Live Active Workload:</span>
                                                    <strong style={{ color: officer.statusColor }}>
                                                        {officer.activeCount === 0 ? "0 pending (Free to assign)" : `${officer.activeCount} active complaint${officer.activeCount > 1 ? "s" : ""}`}
                                                    </strong>
                                                </div>
                                                {/* Mini Bar */}
                                                <div style={{
                                                    width: "100%",
                                                    height: "6px",
                                                    borderRadius: "99px",
                                                    background: "rgba(255, 255, 255, 0.08)",
                                                    overflow: "hidden",
                                                }}>
                                                    <div style={{
                                                        width: `${Math.min(100, Math.max(8, officer.activeCount * 33))}%`,
                                                        height: "100%",
                                                        borderRadius: "99px",
                                                        background: officer.statusColor,
                                                        transition: "width 0.4s ease",
                                                    }} />
                                                </div>
                                            </div>

                                            {/* Current Tasks Preview */}
                                            <div style={{
                                                padding: "0.65rem 0.85rem",
                                                borderRadius: "0.65rem",
                                                background: officer.activeCount > 0 ? "rgba(255, 255, 255, 0.03)" : "rgba(16, 185, 129, 0.04)",
                                                border: `1px dashed ${officer.activeCount > 0 ? "rgba(255, 255, 255, 0.12)" : "rgba(16, 185, 129, 0.25)"}`,
                                                fontSize: "0.74rem",
                                            }}>
                                                {officer.activeCount === 0 ? (
                                                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", color: "#10b981" }}>
                                                        <span>✅</span>
                                                        <span>Ready for new assignments. No unresolved complaints pending in this sector.</span>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <div style={{ fontWeight: "700", color: "#f1f5f9", marginBottom: "0.3rem", display: "flex", justifyContent: "space-between" }}>
                                                            <span>Active Case List:</span>
                                                            <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{officer.resolvedCount} resolved</span>
                                                        </div>
                                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                                                            {officer.activeGrievances.slice(0, 2).map(g => (
                                                                <div key={g.id} style={{
                                                                    display: "flex",
                                                                    justifyContent: "space-between",
                                                                    alignItems: "center",
                                                                    gap: "0.5rem",
                                                                    padding: "0.2rem 0",
                                                                }}>
                                                                    <span style={{
                                                                        color: "#93c5fd",
                                                                        fontWeight: "700",
                                                                        fontFamily: "monospace",
                                                                        fontSize: "0.7rem",
                                                                        flexShrink: 0,
                                                                    }}>
                                                                        {g.id}
                                                                    </span>
                                                                    <span style={{
                                                                        overflow: "hidden",
                                                                        textOverflow: "ellipsis",
                                                                        whiteSpace: "nowrap",
                                                                        color: "var(--text-muted)",
                                                                        flex: 1,
                                                                    }}>
                                                                        {g.subject}
                                                                    </span>
                                                                    <span style={{
                                                                        fontSize: "0.65rem",
                                                                        padding: "0.1rem 0.35rem",
                                                                        borderRadius: "4px",
                                                                        background: g.status === "Pending" ? "rgba(245, 158, 11, 0.15)" : "rgba(99, 102, 241, 0.15)",
                                                                        color: g.status === "Pending" ? "#fbbf24" : "#a5b4fc",
                                                                        fontWeight: "700",
                                                                        flexShrink: 0,
                                                                    }}>
                                                                        {g.status}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                            {officer.activeGrievances.length > 2 && (
                                                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontStyle: "italic", textAlign: "right" }}>
                                                                    +{officer.activeGrievances.length - 2} more active cases...
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Bottom Action Footer */}
                                        <div style={{ display: "flex", gap: "0.5rem", marginTop: "auto", paddingTop: "0.5rem" }}>
                                            <Link
                                                href={`/admin?dept=${encodeURIComponent(officer.category)}`}
                                                className="btn btn-primary"
                                                style={{
                                                    flex: 1,
                                                    padding: "0.55rem 0.75rem",
                                                    fontSize: "0.78rem",
                                                    fontWeight: "700",
                                                    textAlign: "center",
                                                    textDecoration: "none",
                                                    borderRadius: "0.65rem",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    gap: "0.4rem",
                                                }}
                                            >
                                                <span>🔍</span>
                                                <span>Inspect Grievances ({officer.totalAssigned})</span>
                                            </Link>
                                            <a
                                                href={`tel:${officer.phone}`}
                                                style={{
                                                    padding: "0.55rem 0.85rem",
                                                    borderRadius: "0.65rem",
                                                    background: "rgba(255, 255, 255, 0.05)",
                                                    border: "1px solid rgba(255, 255, 255, 0.1)",
                                                    color: "#f8fafc",
                                                    textDecoration: "none",
                                                    fontSize: "0.78rem",
                                                    fontWeight: "700",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    gap: "0.3rem",
                                                }}
                                                title={`Call ${officer.name}`}
                                            >
                                                📞 Call
                                            </a>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </ProtectedRoute>
    );
}
