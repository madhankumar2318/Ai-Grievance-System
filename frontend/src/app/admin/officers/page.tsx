"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { getComplaintsServerAction } from "@/app/actions/complaintActions";
import {
    getDistrictOfficersServerAction,
    getRetirementNoticesServerAction,
    processRetirementNoticeServerAction,
    RegisteredOfficer,
    RetirementNotice,
} from "@/app/actions/authActions";

interface GrievanceItem {
    id: string;
    subject: string;
    description?: string;
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

// Maps any authority role string from signup/login to one of the 5 core grievance departments
function mapRoleToDepartment(role: string): string {
    const r = (role || "").toLowerCase();
    if (r.includes("environment") || r.includes("forest") || r.includes("wildlife") || r.includes("waste") || r.includes("pollution") || r.includes("tnpcb")) return "Environment";
    if (r.includes("health") || r.includes("sanitation") || r.includes("medical") || r.includes("hospital") || r.includes("food") || r.includes("fssai") || r.includes("dmo") || r.includes("dph")) return "Public Health";
    if (r.includes("infrastructure") || r.includes("pwd") || r.includes("electricity") || r.includes("water") || r.includes("transport") || r.includes("rto") || r.includes("bus") || r.includes("engineer")) return "Infrastructure";
    if (r.includes("safety") || r.includes("traffic") || r.includes("police") || r.includes("fire") || r.includes("rescue") || r.includes("cyber") || r.includes("digital") || r.includes("fraud") || r.includes("dccps")) return "Safety";
    if (r.includes("revenue") || r.includes("education") || r.includes("administrative") || r.includes("municipal") || r.includes("collector") || r.includes("tahsildar") || r.includes("supply") || r.includes("ration") || r.includes("civil") || r.includes("agriculture") || r.includes("farmer") || r.includes("crop") || r.includes("jda") || r.includes("welfare") || r.includes("pension") || r.includes("social") || r.includes("dswo") || r.includes("disability")) return "Administrative";
    return "Administrative";
}

// Specific metadata for all official roles from the signup dropdown
const ROLE_SPECIFIC_META: Record<string, { icon: string; avatarGrad: string; accentColor: string; category: string; defaultOffice: string }> = {
    "Environment Protection Officer": {
        icon: "🌿",
        avatarGrad: "linear-gradient(135deg, #10b981, #059669)",
        accentColor: "#10b981",
        category: "Environment",
        defaultOffice: "Pollution Control Board & City Municipal Corporation",
    },
    "District Forest & Wildlife Officer": {
        icon: "🌳",
        avatarGrad: "linear-gradient(135deg, #15803d, #166534)",
        accentColor: "#22c55e",
        category: "Environment",
        defaultOffice: "District Forest Office (DFO) & Wildlife Protection HQ",
    },
    "Solid Waste Management Officer": {
        icon: "♻️",
        avatarGrad: "linear-gradient(135deg, #0d9488, #115e59)",
        accentColor: "#14b8a6",
        category: "Environment",
        defaultOffice: "Municipal SWM & Environmental Sanitation Division",
    },
    "Infrastructure & PWD Engineer": {
        icon: "🏗️",
        avatarGrad: "linear-gradient(135deg, #6366f1, #4f46e5)",
        accentColor: "#6366f1",
        category: "Infrastructure",
        defaultOffice: "PWD Divisional Complex, Cantonment",
    },
    "Water Supply & Sewerage Officer": {
        icon: "💧",
        avatarGrad: "linear-gradient(135deg, #0284c7, #0369a1)",
        accentColor: "#0284c7",
        category: "Infrastructure",
        defaultOffice: "TWAD Board & City Water Supply Division",
    },
    "Electricity Board Officer": {
        icon: "⚡",
        avatarGrad: "linear-gradient(135deg, #f59e0b, #d97706)",
        accentColor: "#f59e0b",
        category: "Infrastructure",
        defaultOffice: "TANGEDCO Electricity Distribution Division",
    },
    "Health & Sanitation Inspector": {
        icon: "🏥",
        avatarGrad: "linear-gradient(135deg, #06b6d4, #0891b2)",
        accentColor: "#06b6d4",
        category: "Public Health",
        defaultOffice: "District Health Office, Collectorate Annexe",
    },
    "District Medical Officer": {
        icon: "🩺",
        avatarGrad: "linear-gradient(135deg, #0284c7, #075985)",
        accentColor: "#38bdf8",
        category: "Public Health",
        defaultOffice: "Joint Director of Health Services (JDHS) & Govt Hospital",
    },
    "Food Safety Officer": {
        icon: "🥗",
        avatarGrad: "linear-gradient(135deg, #84cc16, #4d7c0f)",
        accentColor: "#a3e635",
        category: "Public Health",
        defaultOffice: "Food Safety & Drug Administration Wing, Collectorate",
    },
    "Police Administrative Officer": {
        icon: "👮",
        avatarGrad: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
        accentColor: "#3b82f6",
        category: "Safety",
        defaultOffice: "District Police Office & Law Enforcement HQ",
    },
    "Traffic Management Officer": {
        icon: "🚦",
        avatarGrad: "linear-gradient(135deg, #eab308, #ca8a04)",
        accentColor: "#eab308",
        category: "Safety",
        defaultOffice: "District Traffic Control Headquarters",
    },
    "Tahsildar (Revenue Administration)": {
        icon: "💼",
        avatarGrad: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
        accentColor: "#8b5cf6",
        category: "Administrative",
        defaultOffice: "Taluk Office Compound & Revenue Division",
    },
    "Revenue Department Officer": {
        icon: "💼",
        avatarGrad: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
        accentColor: "#8b5cf6",
        category: "Administrative",
        defaultOffice: "Revenue Divisional Office (RDO), Taluk Campus",
    },
    "Municipal Corporation Officer": {
        icon: "🏙️",
        avatarGrad: "linear-gradient(135deg, #64748b, #475569)",
        accentColor: "#94a3b8",
        category: "Administrative",
        defaultOffice: "City Municipal Corporation Headquarters",
    },
    "Education Department Officer": {
        icon: "📚",
        avatarGrad: "linear-gradient(135deg, #ec4899, #be185d)",
        accentColor: "#ec4899",
        category: "Administrative",
        defaultOffice: "Chief Educational Office (CEO), Collectorate",
    },
    "Transport & Bus Services Officer": {
        icon: "🚌",
        avatarGrad: "linear-gradient(135deg, #f97316, #ea580c)",
        accentColor: "#f97316",
        category: "Infrastructure",
        defaultOffice: "Regional Transport Office (RTO) & TNSTC Division",
    },
    "Civil Supplies & Ration Officer": {
        icon: "🌾",
        avatarGrad: "linear-gradient(135deg, #10b981, #047857)",
        accentColor: "#10b981",
        category: "Administrative",
        defaultOffice: "District Supply Office (DSO), Collectorate Campus",
    },
    "Fire & Disaster Rescue Officer": {
        icon: "🚒",
        avatarGrad: "linear-gradient(135deg, #ef4444, #b91c1c)",
        accentColor: "#ef4444",
        category: "Safety",
        defaultOffice: "District Fire & Rescue Services Headquarters",
    },
    "Agriculture & Farmers Welfare Officer": {
        icon: "🌾",
        avatarGrad: "linear-gradient(135deg, #16a34a, #15803d)",
        accentColor: "#22c55e",
        category: "Administrative",
        defaultOffice: "Joint Director of Agriculture (JDA) Complex, Collectorate",
    },
    "Social Welfare & Pension Officer": {
        icon: "🤝",
        avatarGrad: "linear-gradient(135deg, #a855f7, #7e22ce)",
        accentColor: "#c084fc",
        category: "Administrative",
        defaultOffice: "District Social Welfare Office (DSWO), Collectorate Annexe",
    },
    "Cyber Crime Police Officer": {
        icon: "💻",
        avatarGrad: "linear-gradient(135deg, #2563eb, #1e40af)",
        accentColor: "#3b82f6",
        category: "Safety",
        defaultOffice: "District Cyber Crime Police Station (DCCPS) & Forensics Wing",
    },
    "District Collector & District Magistrate": {
        icon: "🏛️",
        avatarGrad: "linear-gradient(135deg, #f59e0b, #b45309)",
        accentColor: "#fbbf24",
        category: "Administrative",
        defaultOffice: "District Collectorate Main Administrative Complex",
    },
};

const DEPT_FULL_NAMES: Record<string, string> = {
    Environment: "Environment",
    Infrastructure: "Infrastructure & Utilities",
    "Public Health": "Public Health",
    Safety: "Police & Public Safety",
    Administrative: "District Administration",
};

const DEPT_FALLBACK_META: Record<string, { icon: string; avatarGrad: string; accentColor: string; defaultTitle: string; defaultOffice: string }> = {
    Environment: {
        icon: "🌿",
        avatarGrad: "linear-gradient(135deg, #10b981, #059669)",
        accentColor: "#10b981",
        defaultTitle: "Environment Protection Officer",
        defaultOffice: "Pollution Control Board & City Municipal Corporation",
    },
    Infrastructure: {
        icon: "🏗️",
        avatarGrad: "linear-gradient(135deg, #6366f1, #4f46e5)",
        accentColor: "#6366f1",
        defaultTitle: "Infrastructure & PWD Engineer",
        defaultOffice: "PWD Divisional Complex, Cantonment",
    },
    "Public Health": {
        icon: "🏥",
        avatarGrad: "linear-gradient(135deg, #06b6d4, #0891b2)",
        accentColor: "#06b6d4",
        defaultTitle: "Health & Sanitation Inspector",
        defaultOffice: "District Health Office, Collectorate Annexe",
    },
    Safety: {
        icon: "🛡️",
        avatarGrad: "linear-gradient(135deg, #f59e0b, #d97706)",
        accentColor: "#f59e0b",
        defaultTitle: "Traffic Management Officer",
        defaultOffice: "District Traffic Control HQ, Court Complex Road",
    },
    Administrative: {
        icon: "📁",
        avatarGrad: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
        accentColor: "#8b5cf6",
        defaultTitle: "Tahsildar (Revenue Administration)",
        defaultOffice: "Taluk Office Compound, Collectorate Campus",
    },
};

function getRoleMetadata(role: string, dept: string) {
    if (ROLE_SPECIFIC_META[role]) {
        return ROLE_SPECIFIC_META[role];
    }
    for (const [key, meta] of Object.entries(ROLE_SPECIFIC_META)) {
        if (role.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(role.toLowerCase())) {
            return meta;
        }
    }
    return DEPT_FALLBACK_META[dept] || DEPT_FALLBACK_META.Administrative;
}

const BASELINE_DEPTS = ["Environment", "Infrastructure", "Public Health", "Safety", "Administrative"];

export default function DistrictOfficersPage() {
    const { user } = useAuth();
    const { t } = useLang();

    const [complaints, setComplaints] = useState<GrievanceItem[]>([]);
    const [registeredOfficers, setRegisteredOfficers] = useState<RegisteredOfficer[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<"All" | "Available" | "Active" | "Busy">("All");
    const [departmentFilter, setDepartmentFilter] = useState("All");
    const [searchTerm, setSearchTerm] = useState("");
    const [retirementNotices, setRetirementNotices] = useState<RetirementNotice[]>([]);
    const [processingNoticeId, setProcessingNoticeId] = useState<string | null>(null);
    const [sanctionSuccessMsg, setSanctionSuccessMsg] = useState<string | null>(null);

    const handleProcessRetirement = async (noticeId: string, decision: "approved" | "rejected") => {
        setProcessingNoticeId(noticeId);
        try {
            const targetNotice = retirementNotices.find(n => n.id === noticeId);
            const res = await processRetirementNoticeServerAction({ noticeId, decision });
            if (res.success) {
                if (typeof window !== "undefined" && targetNotice) {
                    localStorage.setItem(`gs_officer_duty_${targetNotice.officerEmail}`, decision === "approved" ? "retired" : "active");
                    const updatedNotice = { ...targetNotice, status: decision };
                    localStorage.setItem(`gs_retirement_notice_${targetNotice.officerEmail}`, JSON.stringify(updatedNotice));
                }
                setRetirementNotices(prev => prev.filter(n => n.id !== noticeId));
                setSanctionSuccessMsg(decision === "approved"
                    ? `Executive Sanction Granted: Officer ${targetNotice?.officerName || "Field Officer"} has been honorably relieved. Active caseload transferred.`
                    : `Retirement notice for Officer ${targetNotice?.officerName || "Field Officer"} was declined.`);
                setTimeout(() => setSanctionSuccessMsg(null), 5000);
            }
        } catch (err) {
            console.error("Retirement sanction error:", err);
        } finally {
            setProcessingNoticeId(null);
        }
    };

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
                        description: c.description || "",
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

                // Fetch retirement notices
                try {
                    const localNotices: RetirementNotice[] = [];
                    if (typeof window !== "undefined") {
                        const keys = Object.keys(localStorage).filter(k => k.startsWith("gs_retirement_notice_"));
                        keys.forEach(k => {
                            try {
                                const parsed = JSON.parse(localStorage.getItem(k) || "");
                                if (parsed && parsed.status === "pending") localNotices.push(parsed);
                            } catch {}
                        });
                    }

                    const retRes = await getRetirementNoticesServerAction();
                    if (retRes.success && retRes.notices && mounted) {
                        const combined = [...retRes.notices];
                        localNotices.forEach(ln => {
                            if (!combined.some(c => c.id === ln.id)) combined.push(ln);
                        });
                        setRetirementNotices(combined.filter(n => n.status === "pending"));
                    } else if (localNotices.length > 0 && mounted) {
                        setRetirementNotices(localNotices);
                    }
                } catch {}
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

    // Filter grievances strictly to the Collector's district (e.g. Tiruchirappalli, Coimbatore, Madurai, etc.)
    const districtComplaints = useMemo(() => {
        const isAll = officerDistrict.toLowerCase().includes("all") || user?.role === "chief";
        if (isAll) return complaints;

        return complaints.filter(c => {
            if (officerDistrict.toLowerCase() === "tiruchirappalli") {
                return (
                    /trichy|tiruchirappalli|kaikatti|10\.95|78\.44/i.test(c.location || "") ||
                    /trichy|tiruchirappalli|kaikatti/i.test(c.description || "") ||
                    /green valley|shanti nagar|gandhi nagar|city mall|industrial area|rampur|nh-48|general hospital/i.test(c.location || "")
                );
            }
            const dLower = officerDistrict.toLowerCase();
            const locLower = (c.location || "").toLowerCase();
            const descLower = (c.description || "").toLowerCase();
            const subjLower = (c.subject || "").toLowerCase();

            return (
                locLower.includes(dLower) ||
                descLower.includes(dLower) ||
                subjLower.includes(dLower)
            );
        });
    }, [complaints, officerDistrict, user?.role]);

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
            const regList = registeredByDept[dept];

            if (regList && regList.length > 0) {
                // User's real registered officer(s) exist in Supabase!
                regList.forEach(reg => {
                    const roleTitle = reg.authorityRole || "Department Field Officer";
                    const meta = getRoleMetadata(roleTitle, dept);

                    list.push({
                        id: `reg-${reg.email}`,
                        name: reg.username || "Department Field Officer",
                        designation: roleTitle,
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
                const fallback = DEPT_FALLBACK_META[dept] || DEPT_FALLBACK_META.Administrative;
                list.push({
                    id: `post-${dept}`,
                    name: `${DEPT_FULL_NAMES[dept] || dept} Field Officer`,
                    designation: fallback.defaultTitle,
                    category: dept,
                    serviceId: `TN-${dept.slice(0, 3).toUpperCase()}-POST`,
                    officeLocation: `${officerDistrict} ${fallback.defaultOffice}`,
                    phone: "+91 94432 00000",
                    email: `${dept.toLowerCase()}@${officerDistrict.toLowerCase()}.tn.gov.in`,
                    icon: fallback.icon,
                    avatarGrad: fallback.avatarGrad,
                    accentColor: fallback.accentColor,
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

            const isOfficerRetired = typeof window !== "undefined" && localStorage.getItem(`gs_officer_duty_${officer.email}`) === "retired";
            const isOfficerPendingRetire = typeof window !== "undefined" && (
                localStorage.getItem(`gs_officer_duty_${officer.email}`) === "pending" ||
                retirementNotices.some(n => n.officerEmail.toLowerCase() === officer.email.toLowerCase() && n.status === "pending")
            );

            if (isOfficerRetired) {
                dutyStatus = "Retired" as any;
                statusColor = "#34d399";
                statusBg = "rgba(16, 185, 129, 0.15)";
                statusBorder = "rgba(16, 185, 129, 0.4)";
            } else if (isOfficerPendingRetire) {
                dutyStatus = "Pending Retirement" as any;
                statusColor = "#f59e0b";
                statusBg = "rgba(245, 158, 11, 0.15)";
                statusBorder = "rgba(245, 158, 11, 0.4)";
            } else if (activeGrievances.length >= 3) {
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

    // Filtered by search, duty status, and department
    const filteredOfficers = useMemo(() => {
        return officerWorkloads.filter(o => {
            if (statusFilter !== "All" && o.dutyStatus !== statusFilter) return false;
            if (departmentFilter !== "All" && o.category !== departmentFilter) return false;
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
    }, [officerWorkloads, statusFilter, departmentFilter, searchTerm]);

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

                        {/* ── Executive Directive: Officer Superannuation / Retirement Sanctions ── */}
                        {sanctionSuccessMsg && (
                            <div style={{
                                padding: "0.85rem 1.25rem",
                                borderRadius: "0.85rem",
                                background: "rgba(16,185,129,0.12)",
                                border: "1px solid rgba(16,185,129,0.4)",
                                color: "#10b981",
                                fontWeight: "700",
                                fontSize: "0.88rem",
                                marginBottom: "1.5rem",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem"
                            }}>
                                🎖️ {sanctionSuccessMsg}
                            </div>
                        )}

                        {retirementNotices.map((notice) => (
                            <div key={notice.id} style={{
                                background: "linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(239, 68, 68, 0.08))",
                                border: "1px solid rgba(245, 158, 11, 0.4)",
                                borderRadius: "1rem",
                                padding: "1.25rem 1.5rem",
                                marginBottom: "1.75rem",
                                boxShadow: "0 8px 24px rgba(245, 158, 11, 0.12)",
                            }}>
                                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                                    <div>
                                        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.2rem 0.65rem", borderRadius: "99px", background: "rgba(245, 158, 11, 0.2)", color: "#f59e0b", fontSize: "0.72rem", fontWeight: "800", marginBottom: "0.35rem" }}>
                                            🔔 EXECUTIVE SANCTION REQUIRED · OFFICER SUPERANNUATION NOTICE
                                        </div>
                                        <div style={{ fontSize: "1.15rem", fontWeight: "800", color: "var(--text-main)" }}>
                                            {notice.officerName} <span style={{ fontSize: "0.85rem", color: "#f97316", fontWeight: "600" }}>({notice.authorityRole} · {notice.serviceId})</span>
                                        </div>
                                        <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "0.35rem", lineHeight: "1.5" }}>
                                            Department: <strong style={{ color: "var(--text-main)" }}>{notice.department}</strong> · 
                                            Jurisdiction: <strong style={{ color: "var(--text-main)" }}>{notice.district}</strong> · 
                                            Requested Date: <strong style={{ color: "var(--text-main)" }}>{notice.effectiveDate}</strong>
                                            <br />
                                            Grounds: <em style={{ color: "#f59e0b" }}>&ldquo;{notice.reason}&rdquo;</em>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
                                        <button
                                            onClick={() => handleProcessRetirement(notice.id, "approved")}
                                            disabled={processingNoticeId === notice.id}
                                            className="btn btn-primary"
                                            style={{
                                                background: "linear-gradient(135deg, #10b981, #059669)",
                                                border: "none",
                                                padding: "0.6rem 1.15rem",
                                                fontSize: "0.82rem",
                                                fontWeight: "700",
                                                boxShadow: "0 4px 14px rgba(16, 185, 129, 0.35)",
                                            }}
                                        >
                                            {processingNoticeId === notice.id ? "Processing..." : "✅ Sanction Retirement & Relieve Cases"}
                                        </button>
                                        <button
                                            onClick={() => handleProcessRetirement(notice.id, "rejected")}
                                            disabled={processingNoticeId === notice.id}
                                            className="btn btn-secondary"
                                            style={{ padding: "0.6rem 1rem", fontSize: "0.82rem" }}
                                        >
                                            ❌ Decline
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

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
                                    {loading ? "···" : totalOfficers}
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.4rem" }}>
                                    Covering all vital sectors in {officerDistrict}
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

                        {/* ── Control Bar: Duty Filters + Department Filters + Search ── */}
                        <div style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.85rem",
                            marginBottom: "1.5rem",
                            padding: "0.85rem 1.25rem",
                            borderRadius: "1rem",
                            background: "rgba(255, 255, 255, 0.02)",
                            border: "1px solid var(--border)",
                        }}>
                            {/* Row 1: Duty Status + Search */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                                    <span style={{ fontSize: "0.78rem", fontWeight: "700", color: "var(--text-muted)", marginRight: "0.25rem" }}>
                                        Duty Status:
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

                                <div style={{ position: "relative", minWidth: "260px" }}>
                                    <input
                                        type="text"
                                        placeholder="Search by name, role, email..."
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

                            {/* Row 2: Department Filter Tabs */}
                            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap", paddingTop: "0.4rem", borderTop: "1px solid rgba(255, 255, 255, 0.05)" }}>
                                <span style={{ fontSize: "0.78rem", fontWeight: "700", color: "var(--text-muted)", marginRight: "0.25rem" }}>
                                    Department:
                                </span>
                                {["All", "Environment", "Infrastructure", "Public Health", "Safety", "Administrative"].map(d => {
                                    const isSel = departmentFilter === d;
                                    const icon = d === "All" ? "🏢" : (DEPT_FALLBACK_META[d]?.icon || "📁");
                                    return (
                                        <button
                                            key={d}
                                            onClick={() => setDepartmentFilter(d)}
                                            style={{
                                                padding: "0.25rem 0.75rem",
                                                borderRadius: "99px",
                                                fontSize: "0.74rem",
                                                fontWeight: "700",
                                                cursor: "pointer",
                                                border: isSel ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                                                background: isSel ? "var(--grad-primary)" : "rgba(255, 255, 255, 0.04)",
                                                color: isSel ? "white" : "var(--text-muted)",
                                                transition: "all 0.15s ease",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "0.3rem",
                                            }}
                                        >
                                            <span>{icon}</span>
                                            <span>{d === "All" ? "All Departments" : d}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── Officers Grid / Loading Skeleton ── */}
                        {loading ? (
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
                                gap: "1.25rem",
                            }}>
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div
                                        key={i}
                                        className="glass"
                                        style={{
                                            borderRadius: "1.15rem",
                                            padding: "1.4rem",
                                            border: "1px solid rgba(255, 255, 255, 0.08)",
                                            minHeight: "320px",
                                            display: "flex",
                                            flexDirection: "column",
                                            justifyContent: "space-between",
                                            opacity: 0.65,
                                        }}
                                    >
                                        <div>
                                            <div style={{ display: "flex", gap: "0.85rem", alignItems: "center", marginBottom: "1rem" }}>
                                                <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "rgba(255,255,255,0.08)" }} />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ width: "65%", height: "18px", borderRadius: "4px", background: "rgba(255,255,255,0.1)", marginBottom: "0.4rem" }} />
                                                    <div style={{ width: "45%", height: "12px", borderRadius: "4px", background: "rgba(255,255,255,0.06)" }} />
                                                </div>
                                            </div>
                                            <div style={{ width: "100%", height: "55px", borderRadius: "10px", background: "rgba(255,255,255,0.03)", marginBottom: "1rem" }} />
                                            <div style={{ width: "100%", height: "60px", borderRadius: "10px", background: "rgba(255,255,255,0.03)" }} />
                                        </div>
                                        <div style={{ width: "100%", height: "36px", borderRadius: "8px", background: "rgba(255,255,255,0.06)" }} />
                                    </div>
                                ))}
                            </div>
                        ) : (
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
                                                            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
                                                                <h3 style={{ fontSize: "1.05rem", fontWeight: "800", color: "#f8fafc", margin: 0 }}>
                                                                    {officer.name}
                                                                </h3>
                                                                {officer.isRealRegistered && (
                                                                    <span style={{
                                                                        display: "inline-flex",
                                                                        alignItems: "center",
                                                                        gap: "0.25rem",
                                                                        fontSize: "0.68rem",
                                                                        fontWeight: "800",
                                                                        lineHeight: 1,
                                                                        padding: "0.22rem 0.55rem",
                                                                        borderRadius: "99px",
                                                                        background: "rgba(16, 185, 129, 0.15)",
                                                                        color: "#10b981",
                                                                        border: "1px solid rgba(16, 185, 129, 0.35)",
                                                                        whiteSpace: "nowrap",
                                                                        flexShrink: 0,
                                                                    }} title="Verified Registered Official Account">
                                                                        <span>✓</span>
                                                                        <span>Registered</span>
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
                        )}
                    </>
                )}
            </div>
        </ProtectedRoute>
    );
}
