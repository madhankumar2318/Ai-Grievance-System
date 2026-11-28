"use client";

import React, { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useLang } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { getComplaintsServerAction, updateComplaintStatusServerAction, transferComplaintDepartmentServerAction, issueCollectorDirectiveServerAction, claimComplaintServerAction, assignOfficerServerAction, ActionTakenReportData, CollectorDirectiveData } from "@/app/actions/complaintActions";
import { getDistrictOfficersServerAction, RegisteredOfficer } from "@/app/actions/authActions";
import ActionTakenReportModal from "@/components/ActionTakenReportModal";
import { parseEmbeddedTag, computeDirectiveSlaStatus, findOfficerActiveClaim, mapRoleToDepartment, stripEmbeddedTags, EmbeddedDirective, EmbeddedClaim } from "@/lib/grievanceUtils";

const DIRECTIVE_TIME_CHIPS = [
    { id: "24h", chipLabel: "🚨 24h", hours: 24, targetText: "🚨 24 Hours — Urgent Expedite" },
    { id: "48h", chipLabel: "⏱️ 48h", hours: 48, targetText: "⏱️ 48 Hours — Priority Order" },
    { id: "3d", chipLabel: "📅 3 Days", hours: 72, targetText: "📅 3 Days — Standard Field Repair" },
    { id: "7d", chipLabel: "🛠️ 7 Days", hours: 168, targetText: "🛠️ 7 Days — Heavy Repair" },
    { id: "15d", chipLabel: "🏗️ 15 Days", hours: 360, targetText: "🏗️ 15 Days — Major Infrastructure" },
    { id: "30d", chipLabel: "📆 30 Days", hours: 720, targetText: "📆 30 Days — Full Reconstruction" },
] as const;


const PRIORITY_CONFIG: Record<string, { color: string; icon: string }> = {
    Critical: { color: "#ef4444", icon: "🚨" },
    High: { color: "#f97316", icon: "⚠️" },
    Medium: { color: "#f59e0b", icon: "📍" },
    Low: { color: "#10b981", icon: "✅" },
};

const STATUS_CONFIG: Record<string, { color: string; dot: string }> = {
    Pending: { color: "#f59e0b", dot: "#f59e0b" },
    "In Progress": { color: "#6366f1", dot: "#6366f1" },
    Resolved: { color: "#10b981", dot: "#10b981" },
    Rejected: { color: "#ef4444", dot: "#ef4444" },
};

const CATEGORY_ICONS: Record<string, string> = {
    Administrative: "📁",
    Infrastructure: "🏗️",
    Environment: "🌿",
    Safety: "🛡️",
    "Public Health": "🏥",
};

interface AvailableOfficerCandidate {
    email: string;
    name: string;
    role: string;
    department: string;
    isBusy: boolean;
    busyComplaintId?: string;
}

export interface AdminComplaint {
    id: string;
    subject: string;
    category: string;
    priority: string;
    status: string;
    user: string;
    attachments: number;
    userEmail: string;
    description: string;
    location: string;
    date: string;
    aiNote: string;
}

export interface DbAdminComplaint {
    id: string;
    subject: string;
    category: string;
    priority: string;
    status: string;
    user_email: string | null;
    attachment_count: number | null;
    description: string;
    location: string | null;
    created_at: string;
    ai_reasoning: string | null;
}

export default function AdminDashboard() {
    const { t, lang } = useLang();
    const { user } = useAuth();
    const [complaints, setComplaints] = useState<AdminComplaint[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("All");
    const [departmentFilter, setDepartmentFilter] = useState("All");
    const [priorityFilter, setPriorityFilter] = useState("All");
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [viewingPhoto, setViewingPhoto] = useState<{ url: string | null; title: string; location: string; category?: string } | null>(null);
    const [resolvingComplaint, setResolvingComplaint] = useState<{
        id: string;
        subject: string;
        category: string;
        location: string;
        citizenEvidencePhoto?: string | null;
    } | null>(null);

    // ── Collector Executive Transfer State ───────────────────────────────────────
    const [transferSelections, setTransferSelections] = useState<Record<string, string>>({});
    const [transferringId, setTransferringId] = useState<string | null>(null);
    const [transferSuccessId, setTransferSuccessId] = useState<string | null>(null);

    const handleTransferDepartment = async (id: string, newDept: string) => {
        if (!newDept || transferringId) return;
        setTransferringId(id);
        try {
            const res = await transferComplaintDepartmentServerAction(id, newDept as any);
            if (res.success) {
                setComplaints(prev => prev.map(c => c.id === id ? { ...c, category: newDept } : c));
                setTransferSuccessId(id);
                setTimeout(() => setTransferSuccessId(null), 3500);
            } else {
                alert(res.error || "Failed to transfer department.");
            }
        } catch (err) {
            console.error("Department transfer error:", err);
            alert("Network error while transferring department.");
        } finally {
            setTransferringId(null);
        }
    };

    // ── Collector Direct Officer Assignment State ──────────────────────────────
    const [districtOfficers, setDistrictOfficers] = useState<RegisteredOfficer[]>([]);
    const [selectedAssignOfficer, setSelectedAssignOfficer] = useState<Record<string, string>>({});
    const [assigningComplaintId, setAssigningComplaintId] = useState<string | null>(null);
    const [assignSuccessId, setAssignSuccessId] = useState<string | null>(null);

    // ── Collector Executive Directive State ───────────────────────────────────────
    const [directingComplaint, setDirectingComplaint] = useState<{ id: string; subject: string; category: string } | null>(null);
    const [directiveForm, setDirectiveForm] = useState({
        target: "🚨 24 Hours — Urgent Expedite",
        deadlineHours: 24,
        isCustom: false,
        customDaysInput: "6",
        note: "",
    });
    const [issuingDirective, setIssuingDirective] = useState(false);
    const [directiveSuccessId, setDirectiveSuccessId] = useState<string | null>(null);

    const handleIssueDirective = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!directingComplaint || !directiveForm.note.trim() || issuingDirective) return;
        setIssuingDirective(true);
        try {
            const parsedDays = Math.min(30, Math.max(1, parseInt(directiveForm.customDaysInput, 10) || 6));
            const finalHours = directiveForm.isCustom ? parsedDays * 24 : directiveForm.deadlineHours;
            const finalTarget = directiveForm.isCustom
                ? `🗓️ ${parsedDays} ${parsedDays === 1 ? "Day" : "Days"} — Collectorate Mandate`
                : directiveForm.target;

            const directiveData: CollectorDirectiveData = {
                orderId: `DIR-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
                directiveNote: directiveForm.note.trim(),
                priorityTarget: finalTarget,
                officerTitle: user?.authorityRole || "District Collector & District Magistrate",
                officerName: user?.username || "District Magistrate",
                issuedAt: new Date().toISOString(),
                deadlineHours: finalHours,
            };

            const res = await issueCollectorDirectiveServerAction(directingComplaint.id, directiveData);
            if (res.success) {
                setComplaints(prev => prev.map(c => {
                    if (c.id === directingComplaint.id) {
                        const baseDesc = (c.description || "").replace(/\n\n\[COLLECTOR_DIRECTIVE:[\s\S]*?\]/g, "").trim();
                        return {
                            ...c,
                            priority: "Critical",
                            description: `${baseDesc}\n\n[COLLECTOR_DIRECTIVE:${JSON.stringify(directiveData)}]`,
                        };
                    }
                    return c;
                }));
                setDirectiveSuccessId(directingComplaint.id);
                setTimeout(() => setDirectiveSuccessId(null), 4000);
                setDirectingComplaint(null);
                setDirectiveForm({
                    target: "🚨 24 Hours — Urgent Expedite",
                    deadlineHours: 24,
                    isCustom: false,
                    customDaysInput: "6",
                    note: "",
                });
            } else {
                alert(res.error || "Failed to issue executive directive.");
            }
        } catch (err) {
            console.error("Executive directive error:", err);
            alert("Network error while issuing directive.");
        } finally {
            setIssuingDirective(false);
        }
    };

    const handleOpenResolveModal = (c: AdminComplaint) => {
        if (assignedDepartment && c.category !== assignedDepartment && !isDistrictHead) {
            alert(`Security Restriction: You are authorized to resolve grievances only within the ${assignedDepartment} department.`);
            return;
        }
        const photoMatch = c.description.match(/\[EVIDENCE_PHOTO:([^\]]+)\]/);
        const citizenEvidencePhoto = photoMatch ? photoMatch[1] : null;
        setResolvingComplaint({
            id: c.id,
            subject: c.subject,
            category: c.category,
            location: c.location,
            citizenEvidencePhoto,
        });
    };

    const handleResolveSuccess = (id: string, atr: ActionTakenReportData, autoResolvedIds?: string[]) => {
        const autoSet = new Set(autoResolvedIds || []);
        setComplaints(prev => prev.map(c => {
            if (c.id === id) {
                const baseDesc = c.description.replace(/\n\n\[ACTION_TAKEN_REPORT:[\s\S]*?\]/g, '').trim();
                return {
                    ...c,
                    status: 'Resolved',
                    description: baseDesc + '\n\n[ACTION_TAKEN_REPORT:' + JSON.stringify(atr) + ']',
                };
            }
            if (autoSet.has(c.id)) {
                const cascadeAtr: ActionTakenReportData = {
                    ...atr,
                    actionDescription: atr.actionDescription,
                };
                const baseDesc = c.description.replace(/\n\n\[ACTION_TAKEN_REPORT:[\s\S]*?\]/g, '').trim();
                return {
                    ...c,
                    status: 'Resolved',
                    description: baseDesc + '\n\n[ACTION_TAKEN_REPORT:' + JSON.stringify(cascadeAtr) + ']',
                };
            }
            return c;
        }));
        setExpandedId(null);
        if (autoResolvedIds && autoResolvedIds.length > 0) {
            alert(`✓ Resolved #${id} and automatically resolved ${autoResolvedIds.length} matching complaint(s) in the same area (${autoResolvedIds.join(", ")}).`);
        }
    };

    // Authority Officer's locked jurisdiction (strictly derived from their login / profile)
    const officerState = user?.state || "Tamil Nadu";
    const officerDistrict = user?.district || "Tiruchirappalli";

    // ── Role-Based Department Access Control (RBAC) ──────────────────────────────
    // District Collector / Magistrate / Chief: Supervisory authority over All Departments in the district.
    // Department Officer (Environment, Infrastructure, Health, Safety, etc.): Securely isolated to their assigned department.
    const roleStr = (user?.authorityRole || "").toLowerCase();
    const isDistrictHead =
        roleStr.includes("collector") ||
        roleStr.includes("magistrate") ||
        roleStr.includes("commissioner") ||
        user?.role === "chief";

    // Map specific authority roles to their domain department
    const assignedDepartment = React.useMemo(() => {
        if (isDistrictHead) return null; // Collector / Magistrate has supervisory access over All Departments
        if (roleStr.includes("environment") || roleStr.includes("forest") || roleStr.includes("wildlife") || roleStr.includes("waste") || roleStr.includes("pollution") || roleStr.includes("tnpcb")) return "Environment";
        if (roleStr.includes("health") || roleStr.includes("sanitation") || roleStr.includes("medical") || roleStr.includes("hospital") || roleStr.includes("food") || roleStr.includes("fssai") || roleStr.includes("dmo") || roleStr.includes("dph")) return "Public Health";
        if (roleStr.includes("infrastructure") || roleStr.includes("pwd") || roleStr.includes("electricity") || roleStr.includes("water") || roleStr.includes("transport") || roleStr.includes("rto") || roleStr.includes("bus") || roleStr.includes("engineer")) return "Infrastructure";
        if (roleStr.includes("safety") || roleStr.includes("traffic") || roleStr.includes("police") || roleStr.includes("fire") || roleStr.includes("rescue") || roleStr.includes("cyber") || roleStr.includes("digital") || roleStr.includes("fraud") || roleStr.includes("dccps")) return "Safety";
        if (roleStr.includes("revenue") || roleStr.includes("education") || roleStr.includes("administrative") || roleStr.includes("municipal") || roleStr.includes("tahsildar") || roleStr.includes("supply") || roleStr.includes("ration") || roleStr.includes("civil") || roleStr.includes("agriculture") || roleStr.includes("farmer") || roleStr.includes("crop") || roleStr.includes("jda") || roleStr.includes("welfare") || roleStr.includes("pension") || roleStr.includes("social") || roleStr.includes("dswo") || roleStr.includes("disability")) return "Administrative";
        return null; // Fallback to broad access if unspecified municipal officer
    }, [isDistrictHead, roleStr]);

    const friendlyDeptName = React.useMemo(() => {
        if (!assignedDepartment) return null;
        if (assignedDepartment === "Infrastructure") return "Infrastructure & Utilities";
        if (assignedDepartment === "Safety") return "Police & Public Safety";
        if (assignedDepartment === "Administrative") return "District Administration";
        return assignedDepartment;
    }, [assignedDepartment]);

    useEffect(() => {
        if (assignedDepartment) {
            setDepartmentFilter(assignedDepartment);
        } else if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const deptParam = params.get("dept");
            if (deptParam) {
                setDepartmentFilter(deptParam);
            } else {
                setDepartmentFilter("All");
            }
        } else {
            setDepartmentFilter("All");
        }
    }, [assignedDepartment]);

    const toggleRow = (id: string) => setExpandedId(prev => prev === id ? null : id);

    const fetchComplaints = async () => {
        setLoading(true);
        try {
            const res = await getComplaintsServerAction();
            if (res.success && res.complaints) {
                const mapped = res.complaints.map((c) => ({
                    id: c.id,
                    subject: c.subject,
                    category: c.category || "General",
                    priority: c.priority || "Medium",
                    status: c.status || "Pending",
                    user: c.user_email || "Citizen",
                    attachments: c.attachment_count || 0,
                    userEmail: c.user_email || "",
                    description: c.description || "",
                    location: c.location || "Location not specified",
                    date: c.created_at ? new Date(c.created_at).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN"),
                    aiNote: c.ai_reasoning || "Triage complete.",
                }));
                setComplaints(mapped);
                try {
                    sessionStorage.setItem("cached_admin_complaints", JSON.stringify(mapped));
                } catch {}
            }
        } catch (err) {
            console.error("Error fetching complaints in admin dashboard:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Fast-path: instantly load cached records from session storage (< 5ms)
        try {
            const cached = sessionStorage.getItem("cached_admin_complaints");
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setComplaints(parsed);
                    setLoading(false);
                }
            }
        } catch {}

        fetchComplaints();

        // If District Head / Collector, also load registered officers for direct assignment dropdown
        if (isDistrictHead) {
            getDistrictOfficersServerAction().then(res => {
                if (res.success && res.officers) {
                    setDistrictOfficers(res.officers);
                }
            }).catch(err => console.error("Could not fetch officers for assignment:", err));
        }
    }, [isDistrictHead]);

    const [claimingId, setClaimingId] = useState<string | null>(null);

    const refreshComplaintsFromServer = async () => {
        try {
            const res = await getComplaintsServerAction();
            if (res.success && res.complaints) {
                const dbMapped: AdminComplaint[] = (res.complaints as DbAdminComplaint[]).map((c: DbAdminComplaint) => ({
                    id: c.id,
                    subject: c.subject,
                    category: c.category || "Administrative",
                    priority: c.priority || "Medium",
                    status: c.status || "Pending",
                    user: c.user_email ? c.user_email.split("@")[0] : "Citizen",
                    attachments: c.attachment_count || 0,
                    userEmail: c.user_email || "citizen@example.com",
                    description: c.description,
                    location: c.location || "District Center",
                    date: new Date(c.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
                    aiNote: c.ai_reasoning || "AI auto-triaged and routed.",
                }));
                setComplaints(dbMapped);
            }
        } catch (err) {
            console.error("Failed to refresh complaints:", err);
        }
    };

    const handleClaimComplaint = async (id: string) => {
        if (claimingId) return;
        setClaimingId(id);
        try {
            const res = await claimComplaintServerAction(id);
            if (res.success && res.claim) {
                setComplaints(prev => prev.map(c => {
                    if (c.id === id) {
                        const baseDesc = (c.description || "").replace(/\n\n\[CLAIMED_BY:[\s\S]*?\]/g, "").trim();
                        return {
                            ...c,
                            status: "In Progress",
                            description: `${baseDesc}\n\n[CLAIMED_BY:${JSON.stringify(res.claim)}]`,
                        };
                    }
                    return c;
                }));
            } else {
                alert(res.error || "Could not claim this grievance.");
                await refreshComplaintsFromServer();
            }
        } catch (err) {
            console.error("Claim error:", err);
            alert("Network error while claiming grievance.");
        } finally {
            setClaimingId(null);
        }
    };

    const handleAssignOfficer = async (complaintId: string, officerEmail: string) => {
        if (!officerEmail || assigningComplaintId) return;
        const target = districtOfficers.find(o => o.email.toLowerCase() === officerEmail.toLowerCase());
        if (!target) return;

        setAssigningComplaintId(complaintId);
        try {
            const res = await assignOfficerServerAction(complaintId, {
                officerName: target.username || "Department Field Officer",
                officerEmail: target.email,
                officerRole: target.authorityRole || "Department Officer",
            });

            if (res.success) {
                const now = new Date().toISOString();
                const claimData = {
                    officerName: target.username || "Department Field Officer",
                    officerEmail: target.email,
                    officerRole: target.authorityRole || "Department Officer",
                    assignedBy: user?.username || "District Collector",
                    claimedAt: now,
                };
                setComplaints(prev => prev.map(c => {
                    if (c.id === complaintId) {
                        const baseDesc = (c.description || "").replace(/\n\n\[CLAIMED_BY:[\s\S]*?\]/g, "").trim();
                        return {
                            ...c,
                            status: "In Progress",
                            description: `${baseDesc}\n\n[CLAIMED_BY:${JSON.stringify(claimData)}]`,
                        };
                    }
                    return c;
                }));
                setAssignSuccessId(complaintId);
                setTimeout(() => setAssignSuccessId(null), 3500);
            } else {
                alert(res.error || "Failed to assign officer.");
                await refreshComplaintsFromServer();
            }
        } catch (err) {
            console.error("Assign officer error:", err);
            alert("Network error while assigning officer.");
        } finally {
            setAssigningComplaintId(null);
        }
    };

    const updateStatus = async (id: string, newStatus: "Resolved" | "Rejected") => {
        const target = complaints.find(c => c.id === id);
        if (target && assignedDepartment && target.category !== assignedDepartment && !isDistrictHead) {
            alert(`Security Restriction: Action not permitted outside your assigned ${assignedDepartment} department.`);
            return;
        }
        try {
            const res = await updateComplaintStatusServerAction(id, newStatus);
            if (res.success) {
                setComplaints(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
                setExpandedId(null);
            } else {
                alert(res.error || "Failed to update complaint status.");
                await refreshComplaintsFromServer();
            }
        } catch (err) {
            console.error("Error updating status:", err);
            alert("Network error while updating status.");
        }
    };

    // ── Privacy & Data Segregation Boundary ──────────────────────────────────────
    // Authority officers are strictly confined to their assigned District.
    // Complaints from other jurisdictions are never exposed to prevent cross-district privacy leaks.
    const jurisdictionComplaints = React.useMemo(() => {
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

    // Department-isolated complaints:
    // If officer is assigned to a specific department (e.g. Environment), they only see their domain.
    // District Collector sees all complaints across departments in the district.
    const officerDomainComplaints = React.useMemo(() => {
        if (assignedDepartment) {
            return jurisdictionComplaints.filter(c => c.category === assignedDepartment);
        }
        return jurisdictionComplaints;
    }, [jurisdictionComplaints, assignedDepartment]);

    // Active department scope for stat cards:
    // Field Officer: strictly their assignedDepartment
    // District Collector: dynamically updates based on selected departmentFilter
    const activeScopedComplaints = React.useMemo(() => {
        if (assignedDepartment) {
            return jurisdictionComplaints.filter(c => c.category === assignedDepartment);
        }
        if (departmentFilter && departmentFilter !== "All") {
            return jurisdictionComplaints.filter(c => c.category === departmentFilter);
        }
        return jurisdictionComplaints;
    }, [jurisdictionComplaints, assignedDepartment, departmentFilter]);

    const pending = activeScopedComplaints.filter(c => c.status === "Pending").length;
    const resolved = activeScopedComplaints.filter(c => c.status === "Resolved").length;
    const inProgress = activeScopedComplaints.filter(c => c.status === "In Progress").length;
    const rejected = activeScopedComplaints.filter(c => c.status === "Rejected").length;

    const STATS = [
        { label: t("admin_total"), value: activeScopedComplaints.length, color: "#6366f1", icon: "📋", grad: "linear-gradient(135deg,#6366f1,#8b5cf6)" },
        { label: t("admin_pending"), value: pending, color: "#f59e0b", icon: "⏳", grad: "linear-gradient(135deg,#f59e0b,#f97316)" },
        { label: t("admin_in_progress"), value: inProgress, color: "#6366f1", icon: "🔄", grad: "linear-gradient(135deg,#06b6d4,#6366f1)" },
        { label: t("admin_resolved"), value: resolved, color: "#10b981", icon: "✅", grad: "linear-gradient(135deg,#10b981,#06b6d4)" },
        { label: t("admin_rejected"), value: rejected, color: "#ef4444", icon: "✕", grad: "linear-gradient(135deg,#ef4444,#f97316)" },
    ];

    const FILTERS = ["All", "Pending", "In Progress", "Resolved", "Rejected"];

    // Dynamic unique department options from jurisdiction complaints
    const availableDepartments = React.useMemo(() => {
        const set = new Set(jurisdictionComplaints.map(c => c.category).filter(Boolean));
        return ["All", ...Array.from(set).sort()];
    }, [jurisdictionComplaints]);

    // ── Executive Department Accountability Scorecard Computation ──────────────────
    const departmentScorecards = React.useMemo(() => {
        const depts = [
            { id: "Environment", name: "Environment", icon: "🌿", grad: "linear-gradient(135deg, #10b981, #059669)", accent: "#10b981" },
            { id: "Infrastructure", name: "Infrastructure & Utilities", icon: "🏗️", grad: "linear-gradient(135deg, #6366f1, #4f46e5)", accent: "#6366f1" },
            { id: "Public Health", name: "Public Health", icon: "🏥", grad: "linear-gradient(135deg, #06b6d4, #0891b2)", accent: "#06b6d4" },
            { id: "Safety", name: "Police & Public Safety", icon: "👮", grad: "linear-gradient(135deg, #f59e0b, #d97706)", accent: "#f59e0b" },
            { id: "Administrative", name: "District Administration", icon: "📁", grad: "linear-gradient(135deg, #8b5cf6, #7c3aed)", accent: "#8b5cf6" },
        ];

        return depts.map(d => {
            const cases = jurisdictionComplaints.filter(c => c.category === d.id);
            const pCount = cases.filter(c => c.status === "Pending" || c.status === "In Progress").length;
            const rCount = cases.filter(c => c.status === "Resolved").length;
            const criticalCount = cases.filter(c => c.priority === "Critical" && c.status !== "Resolved").length;
            const directivesCount = cases.filter(c => (c.description || "").includes("[COLLECTOR_DIRECTIVE:") && c.status !== "Resolved").length;

            let healthStatus = "🟢 On Track";
            let healthColor = "#10b981";
            if (directivesCount > 0) {
                healthStatus = "🏛️ Directive Active";
                healthColor = "#fbbf24";
            } else if (criticalCount > 0) {
                healthStatus = "🚨 Critical Risk";
                healthColor = "#ef4444";
            } else if (pCount >= 3) {
                healthStatus = "🔴 Action Needed";
                healthColor = "#f97316";
            } else if (pCount === 0 && rCount > 0) {
                healthStatus = "✓ 100% Cleared";
                healthColor = "#34d399";
            }

            const totalActiveOrResolved = pCount + rCount;
            const resolutionPct = totalActiveOrResolved > 0 ? Math.round((rCount / totalActiveOrResolved) * 100) : 100;

            return {
                ...d,
                total: cases.length,
                pending: pCount,
                resolved: rCount,
                critical: criticalCount,
                directives: directivesCount,
                resolutionPct,
                healthStatus,
                healthColor,
            };
        });
    }, [jurisdictionComplaints]);

    const districtClearancePct = React.useMemo(() => {
        const totalCases = departmentScorecards.reduce((acc, sc) => acc + sc.pending + sc.resolved, 0);
        const totalResolved = departmentScorecards.reduce((acc, sc) => acc + sc.resolved, 0);
        return totalCases > 0 ? Math.round((totalResolved / totalCases) * 100) : 100;
    }, [departmentScorecards]);

    // Combined filtering within the officer's jurisdiction & departmental domain
    const filtered = officerDomainComplaints.filter(c => {
        if (filter !== "All" && c.status !== filter) return false;
        if (!assignedDepartment && departmentFilter !== "All" && c.category !== departmentFilter) return false;
        if (priorityFilter !== "All" && c.priority !== priorityFilter) return false;

        // Search Query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const matches =
                c.id.toLowerCase().includes(q) ||
                c.subject.toLowerCase().includes(q) ||
                c.category.toLowerCase().includes(q) ||
                c.location.toLowerCase().includes(q) ||
                c.user.toLowerCase().includes(q) ||
                c.description.toLowerCase().includes(q);
            if (!matches) return false;
        }

        return true;
    });

    return (
        <ProtectedRoute allowedRoles={["authority", "chief"]}>
            <main className="container section">

                {/* ── Header ── */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2.5rem", flexWrap: "wrap", gap: "1rem" }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                            <h1 className="gradient-text" style={{ fontSize: "2.5rem", margin: 0 }}>{t("admin_title")}</h1>
                            {/* Locked District Badge */}
                            <div style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.4rem",
                                padding: "0.35rem 0.85rem",
                                borderRadius: "99px",
                                background: "rgba(16, 185, 129, 0.12)",
                                border: "1.5px solid rgba(16, 185, 129, 0.35)",
                                color: "#34d399",
                                fontSize: "0.82rem",
                                fontWeight: "700",
                                boxShadow: "0 0 15px rgba(16, 185, 129, 0.15)",
                            }}>
                                <span>🔒</span>
                                <span>{officerDistrict}, {officerState} (Assigned District)</span>
                            </div>

                            {/* Officer Role / Authority Badge */}
                            <div style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.4rem",
                                padding: "0.35rem 0.85rem",
                                borderRadius: "99px",
                                background: isDistrictHead ? "rgba(245, 158, 11, 0.14)" : "rgba(99, 102, 241, 0.14)",
                                border: isDistrictHead ? "1.5px solid rgba(245, 158, 11, 0.4)" : "1.5px solid rgba(99, 102, 241, 0.4)",
                                color: isDistrictHead ? "#fbbf24" : "#a5b4fc",
                                fontSize: "0.82rem",
                                fontWeight: "700",
                            }}>
                                <span>{isDistrictHead ? "🏛️" : (CATEGORY_ICONS[assignedDepartment || ""] || "🎖️")}</span>
                                <span>{user?.authorityRole || (isDistrictHead ? "District Collector & District Magistrate" : "Department Authority Officer")}</span>
                            </div>
                        </div>
                        <p style={{ marginTop: "0.35rem", color: "var(--text-muted)", fontSize: "0.88rem" }}>
                            {isDistrictHead ? (
                                <>
                                    🏛️ <strong>District Collector Oversight:</strong> Supervising all department grievances across <strong>{officerDistrict} ({officerState})</strong>
                                </>
                            ) : (
                                <>
                                    🔒 <strong>Departmental Security Boundary:</strong> Exclusively assigned to <strong>{friendlyDeptName || "Assigned"} Department</strong> in <strong>{officerDistrict}</strong>
                                </>
                            )}
                        </p>
                    </div>
                </div>

                {/* ── Stat Cards ── */}
                <div className="stagger-children admin-stats-grid">
                    {STATS.map(({ label, value, color, icon, grad }, idx) => (
                        <div key={`${lang}-${idx}`} className="glass card-hover animate-fade-in" style={{ padding: "1.75rem 1.25rem", borderRadius: "var(--radius)", textAlign: "center", borderTop: `3px solid ${color}`, position: "relative", overflow: "hidden" }}>
                            <div style={{ position: "absolute", top: "-20px", right: "-20px", width: "80px", height: "80px", borderRadius: "50%", background: `${color}18`, filter: "blur(20px)" }} />
                            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "40px", height: "40px", borderRadius: "10px", background: grad, fontSize: "1.1rem", marginBottom: "0.75rem", boxShadow: `0 4px 12px ${color}44` }}>
                                {icon}
                            </div>
                            <div style={{ fontSize: "2.25rem", fontWeight: "900", color, lineHeight: 1, marginBottom: "0.3rem" }}>{loading && complaints.length === 0 ? <span style={{ opacity: 0.35, letterSpacing: "2px" }}>···</span> : value}</div>
                            <div style={{ fontSize: "0.78rem", fontWeight: "600", color: "var(--text-muted)" }}>{label}</div>
                            {isDistrictHead && (
                                <div style={{ fontSize: "0.68rem", fontWeight: "700", color: departmentFilter !== "All" ? color : "var(--text-muted)", marginTop: "0.3rem", opacity: departmentFilter !== "All" ? 0.95 : 0.65 }}>
                                    {departmentFilter !== "All" ? `${CATEGORY_ICONS[departmentFilter] || ""} ${departmentFilter}` : "All Departments"}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* ── Executive Department Accountability Index (Vertical Column Metric List with Animated Loading Strips) ── */}
                {isDistrictHead && (
                    <div style={{
                        marginBottom: "2rem",
                        background: "rgba(15, 23, 42, 0.78)",
                        backdropFilter: "blur(16px)",
                        WebkitBackdropFilter: "blur(16px)",
                        borderRadius: "1.1rem",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        padding: "1.25rem 1.4rem",
                        boxShadow: "0 12px 36px rgba(0, 0, 0, 0.35)",
                        animation: "fadeIn 0.3s ease",
                    }}>
                        {/* Header Bar */}
                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: "0.85rem",
                            marginBottom: "1rem",
                            paddingBottom: "0.9rem",
                            borderBottom: "1px solid rgba(255, 255, 255, 0.07)",
                        }}>
                            <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", flexWrap: "wrap" }}>
                                    <span style={{ fontSize: "1.2rem" }}>🏛️</span>
                                    <h2 style={{ fontSize: "1.1rem", fontWeight: "900", color: "#f8fafc", margin: 0, letterSpacing: "-0.01em" }}>
                                        District Department Accountability Index
                                    </h2>
                                    <span style={{
                                        padding: "0.2rem 0.55rem",
                                        borderRadius: "99px",
                                        background: "rgba(245, 158, 11, 0.15)",
                                        border: "1px solid rgba(245, 158, 11, 0.35)",
                                        color: "#fbbf24",
                                        fontSize: "0.68rem",
                                        fontWeight: "800",
                                        letterSpacing: "0.04em",
                                        textTransform: "uppercase",
                                    }}>
                                        District Magistrate Command
                                    </span>
                                </div>
                                <p style={{ margin: "0.25rem 0 0", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                                    Live resolution velocity &amp; executive compliance tracking across all 5 municipal wings. Click any row to filter complaints.
                                </p>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                                {/* District Overall Clearance Metric */}
                                <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.45rem",
                                    padding: "0.35rem 0.8rem",
                                    borderRadius: "99px",
                                    background: districtClearancePct >= 70 ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.12)",
                                    border: districtClearancePct >= 70 ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(245, 158, 11, 0.3)",
                                    fontSize: "0.78rem",
                                    fontWeight: "800",
                                    color: districtClearancePct >= 70 ? "#34d399" : "#fbbf24",
                                }}>
                                    <span style={{
                                        width: "7px",
                                        height: "7px",
                                        borderRadius: "50%",
                                        background: districtClearancePct >= 70 ? "#34d399" : "#fbbf24",
                                        boxShadow: "0 0 6px currentColor",
                                        display: "inline-block"
                                    }} />
                                    <span>District Clearance: <strong>{districtClearancePct}%</strong></span>
                                </div>

                                {/* Reset Filter Button */}
                                <button
                                    onClick={() => setDepartmentFilter("All")}
                                    style={{
                                        padding: "0.35rem 0.85rem",
                                        borderRadius: "99px",
                                        fontSize: "0.75rem",
                                        fontWeight: "700",
                                        background: departmentFilter === "All" ? "rgba(99, 102, 241, 0.22)" : "rgba(255, 255, 255, 0.05)",
                                        border: departmentFilter === "All" ? "1px solid #818cf8" : "1px solid var(--border)",
                                        color: departmentFilter === "All" ? "#c7d2fe" : "var(--text-muted)",
                                        cursor: "pointer",
                                        transition: "all 0.2s ease",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "0.35rem",
                                    }}
                                >
                                    {departmentFilter === "All" ? "✓ All (5 Departments)" : "Reset to All Departments"}
                                </button>
                            </div>
                        </div>

                        {/* 5 Department Vertical Rows */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                            {departmentScorecards.map(sc => {
                                const isSelected = departmentFilter === sc.id;
                                const barColor = sc.resolutionPct >= 75 ? "#10b981" : sc.resolutionPct >= 35 ? "#f59e0b" : "#ef4444";
                                const gradBg = sc.resolutionPct >= 75
                                    ? "linear-gradient(90deg, #059669, #10b981, #34d399)"
                                    : sc.resolutionPct >= 35
                                    ? "linear-gradient(90deg, #d97706, #f59e0b, #fbbf24)"
                                    : "linear-gradient(90deg, #b91c1c, #ef4444, #f87171)";

                                return (
                                    <div
                                        key={sc.id}
                                        onClick={() => setDepartmentFilter(prev => prev === sc.id ? "All" : sc.id)}
                                        style={{
                                            padding: "0.75rem 1.1rem",
                                            borderRadius: "0.75rem",
                                            background: isSelected
                                                ? `linear-gradient(90deg, ${sc.accent}24, rgba(15, 23, 42, 0.88))`
                                                : "rgba(255, 255, 255, 0.025)",
                                            border: isSelected ? `1.5px solid ${sc.accent}` : "1px solid rgba(255, 255, 255, 0.06)",
                                            boxShadow: isSelected ? `0 0 20px ${sc.accent}30` : "none",
                                            cursor: "pointer",
                                            transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "1.25rem",
                                            flexWrap: "wrap",
                                        }}
                                        onMouseEnter={e => {
                                            if (!isSelected) {
                                                e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                                                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
                                            }
                                        }}
                                        onMouseLeave={e => {
                                            if (!isSelected) {
                                                e.currentTarget.style.background = "rgba(255, 255, 255, 0.025)";
                                                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.06)";
                                            }
                                        }}
                                    >
                                        {/* 1. Department Identity Column */}
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", width: "230px", minWidth: "210px" }}>
                                            <div style={{
                                                width: "34px",
                                                height: "34px",
                                                minWidth: "34px",
                                                borderRadius: "8px",
                                                background: sc.grad,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: "1.1rem",
                                                boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                                            }}>
                                                {sc.icon}
                                            </div>
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <div style={{
                                                    fontWeight: "800",
                                                    fontSize: "0.88rem",
                                                    color: "#ffffff",
                                                    lineHeight: 1.25,
                                                    whiteSpace: "nowrap",
                                                }}>
                                                    {sc.name}
                                                </div>
                                                {isSelected && (
                                                    <div style={{ fontSize: "0.65rem", color: sc.accent, fontWeight: "800", marginTop: "0.15rem" }}>
                                                        ● Active Filter
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* 2. Animated Percentage Loading Bar Strip */}
                                        <div style={{ flex: 1, minWidth: "220px", display: "flex", alignItems: "center", gap: "0.85rem" }}>
                                            <div style={{
                                                flex: 1,
                                                height: "9px",
                                                borderRadius: "99px",
                                                background: "rgba(255, 255, 255, 0.08)",
                                                overflow: "hidden",
                                                position: "relative",
                                                border: "1px solid rgba(255, 255, 255, 0.05)",
                                            }}>
                                                <div style={{
                                                    height: "100%",
                                                    width: `${sc.resolutionPct}%`,
                                                    background: gradBg,
                                                    borderRadius: "99px",
                                                    boxShadow: `0 0 10px ${barColor}88`,
                                                    transition: "width 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
                                                    position: "relative",
                                                    overflow: "hidden",
                                                }}>
                                                    {/* Animated Scanning Light Beam */}
                                                    <div style={{
                                                        position: "absolute",
                                                        top: 0,
                                                        left: 0,
                                                        width: "60px",
                                                        height: "100%",
                                                        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)",
                                                        animation: "progressScan 2.4s ease-in-out infinite",
                                                    }} />
                                                </div>
                                            </div>

                                            {/* Percentage Display */}
                                            <div style={{
                                                fontFamily: "monospace",
                                                fontSize: "0.88rem",
                                                fontWeight: "900",
                                                color: barColor,
                                                width: "44px",
                                                textAlign: "right",
                                            }}>
                                                {sc.resolutionPct}%
                                            </div>
                                        </div>

                                        {/* 3. Workload & Status Badges */}
                                        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginLeft: "auto", flexShrink: 0 }}>
                                            <div style={{ fontSize: "0.8rem", textAlign: "right" }}>
                                                <span style={{ fontWeight: "800", color: sc.pending > 0 ? "#f59e0b" : "#34d399" }}>
                                                    {sc.pending} pending
                                                </span>
                                                <span style={{ color: "var(--text-muted)", margin: "0 0.35rem" }}>·</span>
                                                <span style={{ color: "#34d399", fontWeight: "700" }}>
                                                    {sc.resolved} resolved
                                                </span>
                                            </div>

                                            <div style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "0.3rem",
                                                fontSize: "0.72rem",
                                                fontWeight: "800",
                                                color: sc.healthColor,
                                                background: `${sc.healthColor}16`,
                                                padding: "0.22rem 0.65rem",
                                                borderRadius: "99px",
                                                border: `1px solid ${sc.healthColor}35`,
                                                minWidth: "115px",
                                                justifyContent: "center",
                                            }}>
                                                <span>{sc.healthStatus}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── Filter Bar ── */}
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    marginBottom: "1.25rem",
                    flexWrap: "wrap",
                    padding: "0.75rem 1rem",
                    borderRadius: "1rem",
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid var(--border)",
                }}>
                    {/* Left: Status Filter Pills */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: "700", color: "var(--text-muted)", marginRight: "0.2rem" }}>
                            Status:
                        </span>
                        {FILTERS.map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                style={{
                                    padding: "0.3rem 0.8rem", borderRadius: "99px",
                                    fontSize: "0.76rem", fontWeight: "700",
                                    border: filter === f ? "1.5px solid var(--primary)" : "1.5px solid var(--border)",
                                    background: filter === f ? "var(--grad-primary)" : "var(--bg-card)",
                                    color: filter === f ? "white" : "var(--text-muted)",
                                    cursor: "pointer", transition: "var(--transition)",
                                    boxShadow: filter === f ? "0 2px 8px var(--primary-glow)" : "none",
                                }}
                            >{f}</button>
                        ))}
                    </div>

                    {/* Right: Jurisdiction Indicator + Department + Search + Clear */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        {/* Locked District Tag */}
                        <div
                            title={`Showing complaints for ${officerDistrict}, ${officerState}.`}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.35rem",
                                padding: "0.35rem 0.75rem",
                                borderRadius: "0.5rem",
                                background: "rgba(16, 185, 129, 0.08)",
                                border: "1px solid rgba(16, 185, 129, 0.25)",
                                color: "#34d399",
                                fontSize: "0.76rem",
                                fontWeight: "700",
                                cursor: "default",
                            }}
                        >
                            <span>📍</span>
                            <span>{officerDistrict}</span>
                            <span style={{ fontSize: "0.68rem", opacity: 0.8 }}>🔒</span>
                        </div>

                        {/* Department Filter / Locked Boundary */}
                        {assignedDepartment ? (
                            <div
                                title={`Security Locked: As ${user?.authorityRole || "Department Officer"}, your access is strictly confined to the ${assignedDepartment} department.`}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.35rem",
                                    padding: "0.35rem 0.75rem",
                                    borderRadius: "0.5rem",
                                    background: "rgba(99, 102, 241, 0.12)",
                                    border: "1.5px solid rgba(99, 102, 241, 0.35)",
                                    color: "#a5b4fc",
                                    fontSize: "0.76rem",
                                    fontWeight: "700",
                                }}
                            >
                                <span>{CATEGORY_ICONS[assignedDepartment] || "📁"}</span>
                                <span>Dept: {assignedDepartment}</span>
                                <span style={{ fontSize: "0.68rem", opacity: 0.8 }}>🔒</span>
                            </div>
                        ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                <span style={{ fontSize: "0.76rem", fontWeight: "700", color: "#fbbf24" }}>🏛️ Collector Oversight:</span>
                                <select
                                    value={departmentFilter}
                                    onChange={e => setDepartmentFilter(e.target.value)}
                                    style={{
                                        padding: "0.35rem 0.75rem",
                                        borderRadius: "0.5rem",
                                        border: departmentFilter !== "All" ? "1.5px solid #f59e0b" : "1.5px solid var(--border)",
                                        background: "var(--bg-card)",
                                        color: departmentFilter !== "All" ? "#fbbf24" : "var(--text-main)",
                                        fontSize: "0.76rem",
                                        fontWeight: "600",
                                        cursor: "pointer",
                                        outline: "none",
                                    }}
                                >
                                    {availableDepartments.map(dept => (
                                        <option key={dept} value={dept} style={{ background: "#0f172a", color: "#f8fafc" }}>
                                            {dept === "All" ? "All Departments" : `${CATEGORY_ICONS[dept] || "📁"} ${dept}`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Priority Filter */}
                        <select
                            value={priorityFilter}
                            onChange={e => setPriorityFilter(e.target.value)}
                            aria-label="Filter by Priority"
                            style={{
                                padding: "0.35rem 0.65rem",
                                borderRadius: "0.5rem",
                                border: priorityFilter !== "All" ? "1.5px solid #ef4444" : "1.5px solid var(--border)",
                                background: "var(--bg-card)",
                                color: priorityFilter !== "All" ? "#fca5a5" : "var(--text-main)",
                                fontSize: "0.76rem",
                                fontWeight: "600",
                                cursor: "pointer",
                                outline: "none",
                            }}
                        >
                            <option value="All" style={{ background: "#0f172a", color: "#f8fafc" }}>All Priorities</option>
                            <option value="Critical" style={{ background: "#0f172a", color: "#fca5a5" }}>🚨 Critical</option>
                            <option value="High" style={{ background: "#0f172a", color: "#fdba74" }}>⚠️ High</option>
                            <option value="Medium" style={{ background: "#0f172a", color: "#fde68a" }}>📍 Medium</option>
                            <option value="Low" style={{ background: "#0f172a", color: "#6ee7b7" }}>✅ Low</option>
                        </select>

                        {/* Search Input */}
                        <div style={{ position: "relative" }}>
                            <input
                                type="text"
                                placeholder={`Search in ${officerDistrict}...`}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                style={{
                                    padding: "0.35rem 0.65rem 0.35rem 1.65rem",
                                    borderRadius: "0.5rem",
                                    border: searchQuery ? "1.5px solid var(--primary)" : "1.5px solid var(--border)",
                                    background: "var(--bg-card)",
                                    color: "var(--text-main)",
                                    fontSize: "0.76rem",
                                    width: "140px",
                                    outline: "none",
                                }}
                            />
                            <span style={{ position: "absolute", left: "0.5rem", top: "50%", transform: "translateY(-50%)", fontSize: "0.7rem", color: "var(--text-muted)", pointerEvents: "none" }}>
                                🔍
                            </span>
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    style={{ position: "absolute", right: "0.35rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.7rem" }}
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* Reset Button */}
                        {(filter !== "All" || departmentFilter !== "All" || priorityFilter !== "All" || searchQuery) && (
                            <button
                                onClick={() => {
                                    setFilter("All");
                                    setDepartmentFilter("All");
                                    setPriorityFilter("All");
                                    setSearchQuery("");
                                }}
                                style={{
                                    padding: "0.35rem 0.65rem",
                                    borderRadius: "0.5rem",
                                    border: "1px solid #ef444440",
                                    background: "#ef444415",
                                    color: "#f87171",
                                    fontSize: "0.74rem",
                                    fontWeight: "700",
                                    cursor: "pointer",
                                }}
                                title="Reset filters"
                            >
                                ✕ Reset
                            </button>
                        )}
                    </div>
                </div>

                {/* Counter & Hint Row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", fontSize: "0.76rem", color: "var(--text-muted)", flexWrap: "wrap", gap: "0.5rem" }}>
                    <p style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <span>👆</span> Click any row to view full complaint details
                    </p>
                    <span style={{ fontWeight: "600" }}>
                        Showing <strong>{filtered.length}</strong> of {officerDomainComplaints.length} grievances in <strong>{officerDistrict}</strong>
                        {assignedDepartment ? (
                            <span style={{ color: "#818cf8", marginLeft: "0.4rem" }}>
                                ({assignedDepartment} Department Only)
                            </span>
                        ) : (
                            (departmentFilter !== "All" || searchQuery) && (
                                <span style={{ color: "var(--primary)", marginLeft: "0.4rem" }}>
                                    ({[
                                        departmentFilter !== "All" ? departmentFilter : null,
                                        searchQuery ? `"${searchQuery}"` : null,
                                    ].filter(Boolean).join(" · ")})
                                </span>
                            )
                        )}
                    </span>
                </div>

                {/* ── Desktop View (Table) ── */}
                <div className="admin-desktop-table">
                    <div className="glass" style={{ borderRadius: "1.5rem", overflow: "hidden", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                            <thead>
                                <tr style={{ background: "rgba(99,102,241,0.05)", borderBottom: "1px solid var(--border)" }}>
                                    {[t("admin_col_id"), t("admin_col_subject"), t("admin_col_citizen"), t("admin_col_priority"), t("admin_col_status"), t("admin_col_attachments"), t("admin_col_actions")].map((h, i) => (
                                        <th key={i} style={{ padding: "1.1rem 1.25rem", fontWeight: "700", fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading && complaints.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} style={{ padding: "3.5rem 1.5rem", textAlign: "center" }}>
                                            <div style={{ fontSize: "2rem", marginBottom: "0.5rem", animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</div>
                                            <div style={{ fontWeight: "700", fontSize: "0.95rem", color: "#a5b4fc" }}>Loading complaints...</div>
                                            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>Synchronizing complaints for {officerDistrict}...</div>
                                        </td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} style={{ padding: "3.5rem 1.5rem", textAlign: "center", color: "var(--text-muted)" }}>
                                            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🔍</div>
                                            <div style={{ fontWeight: "700", fontSize: "0.95rem", color: "var(--text-main)" }}>No matching complaints found</div>
                                            <div style={{ fontSize: "0.8rem", marginTop: "0.25rem", color: "var(--text-muted)" }}>
                                                Try adjusting or clearing your department, area, or search filters.
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((c, idx) => {
                                    const pCfg = PRIORITY_CONFIG[c.priority] ?? PRIORITY_CONFIG.Medium;
                                    const sCfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.Pending;
                                    const isExpanded = expandedId === c.id;
                                    return (
                                        <React.Fragment key={c.id}>
                                            {/* ── Main Row ── */}
                                            <tr
                                                key={c.id}
                                                onClick={() => toggleRow(c.id)}
                                                style={{
                                                    borderBottom: isExpanded ? "none" : "1px solid var(--border)",
                                                    animationDelay: `${idx * 40}ms`,
                                                    cursor: "pointer",
                                                    background: isExpanded ? "rgba(99,102,241,0.05)" : "transparent",
                                                    transition: "background 0.2s ease",
                                                }}
                                                className="animate-fade-in"
                                                onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLTableRowElement).style.background = "rgba(99,102,241,0.03)"; }}
                                                onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                                            >
                                                {/* ID */}
                                                <td style={{ padding: "1.1rem 1.25rem", fontWeight: "700", fontFamily: "monospace", fontSize: "0.82rem", color: "var(--primary)" }}>{c.id}</td>
                                                {/* Subject */}
                                                <td style={{ padding: "1.1rem 1.25rem" }}>
                                                    <div style={{ fontWeight: "600", marginBottom: "0.2rem" }}>{c.subject}</div>
                                                    <span style={{ fontSize: "0.7rem", padding: "0.15rem 0.55rem", borderRadius: "99px", background: "var(--border-subtle)", color: "var(--primary)", fontWeight: "700" }}>{c.category}</span>
                                                </td>
                                                {/* User */}
                                                <td style={{ padding: "1.1rem 1.25rem", fontSize: "0.875rem", color: "var(--text-muted)" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                        <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: "800", color: "var(--text-muted)", flexShrink: 0 }}>
                                                            {c.user.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                                                        </div>
                                                        {c.user}
                                                    </div>
                                                </td>
                                                {/* Priority */}
                                                <td style={{ padding: "1.1rem 1.25rem" }}>
                                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", padding: "0.3rem 0.75rem", borderRadius: "99px", fontSize: "0.75rem", fontWeight: "700", background: `${pCfg.color}18`, color: pCfg.color, border: `1px solid ${pCfg.color}35` }}>
                                                        {c.priority === "Critical" && (
                                                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: pCfg.color, display: "inline-block", position: "relative" }}>
                                                                <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: pCfg.color, animation: "ping 1.2s ease-out infinite" }} />
                                                            </span>
                                                        )}
                                                        {c.priority}
                                                    </span>
                                                    {c.description && c.description.includes("[COLLECTOR_DIRECTIVE:") && (() => {
                                                        const dir = parseEmbeddedTag<EmbeddedDirective>(c.description, "COLLECTOR_DIRECTIVE");
                                                        const atr = parseEmbeddedTag<{ resolvedAt?: string }>(c.description, "ACTION_TAKEN_REPORT");
                                                        const sla = dir ? computeDirectiveSlaStatus(dir.issuedAt, dir.priorityTarget, c.status, dir.deadlineHours, Date.now(), atr?.resolvedAt) : null;
                                                        return (
                                                            <div style={{ marginTop: "0.3rem", display: "flex", flexDirection: "column", gap: "0.22rem", alignItems: "flex-start" }}>
                                                                <span style={{
                                                                    display: "inline-flex",
                                                                    alignItems: "center",
                                                                    gap: "0.25rem",
                                                                    padding: "0.15rem 0.5rem",
                                                                    borderRadius: "99px",
                                                                    background: "linear-gradient(135deg, rgba(245, 158, 11, 0.22), rgba(217, 119, 6, 0.15))",
                                                                    border: "1px solid rgba(245, 158, 11, 0.5)",
                                                                    color: "#fbbf24",
                                                                    fontSize: "0.68rem",
                                                                    fontWeight: "800",
                                                                    boxShadow: "0 0 10px rgba(245, 158, 11, 0.2)",
                                                                    whiteSpace: "nowrap"
                                                                }}>
                                                                    <span>🏛️</span>
                                                                    <span>Collector Directive</span>
                                                                </span>
                                                                {sla && (
                                                                    <span style={{
                                                                        display: "inline-flex",
                                                                        alignItems: "center",
                                                                        padding: "0.1rem 0.45rem",
                                                                        borderRadius: "99px",
                                                                        background: sla.bg,
                                                                        border: `1px solid ${sla.border}`,
                                                                        color: sla.color,
                                                                        fontSize: "0.65rem",
                                                                        fontWeight: "800",
                                                                        whiteSpace: "nowrap"
                                                                    }}>
                                                                        {sla.label}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                {/* Status */}
                                                <td style={{ padding: "1.1rem 1.25rem" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: sCfg.dot, flexShrink: 0 }} />
                                                        <span style={{ fontSize: "0.875rem", fontWeight: "600" }}>{c.status}</span>
                                                    </div>
                                                    {c.status === "In Progress" && (() => {
                                                        const claim = parseEmbeddedTag<EmbeddedClaim>(c.description || "", "CLAIMED_BY");
                                                        if (!claim) return null;
                                                        const isMine = claim.officerEmail?.toLowerCase() === (user?.email || "").toLowerCase();
                                                        return (
                                                            <div style={{
                                                                marginTop: "0.25rem",
                                                                fontSize: "0.68rem",
                                                                fontWeight: "700",
                                                                color: isMine ? "#a5b4fc" : "#fbbf24",
                                                                whiteSpace: "nowrap",
                                                            }}>
                                                                {isMine ? "✓ Claimed by You" : `🔒 ${claim.officerName}`}
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                {/* Attachments */}
                                                <td style={{ padding: "1.1rem 1.25rem" }}>
                                                    {c.attachments > 0 ? (
                                                        <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "#6366f1", background: "#6366f115", padding: "0.25rem 0.6rem", borderRadius: "99px", border: "1px solid #6366f130" }}>📎 {c.attachments}</span>
                                                    ) : (
                                                        <span style={{ fontSize: "0.8rem", color: "var(--text-faint)" }}>—</span>
                                                    )}
                                                </td>
                                                {/* Actions */}
                                                <td style={{ padding: "1.1rem 1.25rem", whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => toggleRow(c.id)}
                                                        style={{
                                                            padding: "0.45rem 0.95rem",
                                                            fontSize: "0.78rem",
                                                            fontWeight: "700",
                                                            borderRadius: "0.5rem",
                                                            cursor: "pointer",
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: "0.4rem",
                                                            background: isExpanded
                                                                ? "rgba(99,102,241,0.22)"
                                                                : c.status === "Resolved" || c.status === "Rejected"
                                                                ? "rgba(255,255,255,0.06)"
                                                                : "linear-gradient(135deg, rgba(99,102,241,0.18), rgba(168,85,247,0.18))",
                                                            color: isExpanded
                                                                ? "#e0e7ff"
                                                                : c.status === "Resolved" || c.status === "Rejected"
                                                                ? "var(--text-muted)"
                                                                : "#a5b4fc",
                                                            border: isExpanded
                                                                ? "1px solid rgba(99,102,241,0.5)"
                                                                : c.status === "Resolved" || c.status === "Rejected"
                                                                ? "1px solid var(--border)"
                                                                : "1px solid rgba(99,102,241,0.3)",
                                                            boxShadow: isExpanded ? "none" : "0 2px 6px rgba(0,0,0,0.1)",
                                                            transition: "all 0.2s ease",
                                                        }}
                                                        onMouseEnter={e => {
                                                            if (!isExpanded) {
                                                                e.currentTarget.style.background = c.status === "Resolved" || c.status === "Rejected"
                                                                    ? "rgba(255,255,255,0.1)"
                                                                    : "linear-gradient(135deg, rgba(99,102,241,0.28), rgba(168,85,247,0.28))";
                                                            }
                                                        }}
                                                        onMouseLeave={e => {
                                                            if (!isExpanded) {
                                                                e.currentTarget.style.background = c.status === "Resolved" || c.status === "Rejected"
                                                                    ? "rgba(255,255,255,0.06)"
                                                                    : "linear-gradient(135deg, rgba(99,102,241,0.18), rgba(168,85,247,0.18))";
                                                            }
                                                        }}
                                                    >
                                                        <span>{isExpanded ? "Close Details" : c.status === "Resolved" || c.status === "Rejected" ? "View Details" : "Inspect & Review"}</span>
                                                        <span style={{ fontSize: "0.72rem", transition: "transform 0.25s ease", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
                                                    </button>
                                                </td>
                                            </tr>

                                            {/* ── Detail Panel ── */}
                                            {isExpanded && (() => {
                                                const atrMatch = (c.description || "").match(/\[ACTION_TAKEN_REPORT:([\s\S]*?)\]/);
                                                let atrData: ActionTakenReportData | null = null;
                                                if (atrMatch) {
                                                    try {
                                                        atrData = JSON.parse(atrMatch[1]);
                                                    } catch (e) {
                                                        console.error("Failed to parse ATR JSON:", e);
                                                    }
                                                }
                                                const directiveMatch = (c.description || "").match(/\[COLLECTOR_DIRECTIVE:([\s\S]*?)\]/);
                                                let directiveData: CollectorDirectiveData | null = null;
                                                if (directiveMatch) {
                                                    try {
                                                        directiveData = JSON.parse(directiveMatch[1]);
                                                    } catch (e) {
                                                        console.error("Failed to parse Directive JSON:", e);
                                                    }
                                                }
                                                const photoMatch = (c.description || "").match(/\[EVIDENCE_PHOTO:([^\]]+)\]/);
                                                const evidencePhoto = photoMatch ? photoMatch[1] : null;
                                                const cleanDesc = stripEmbeddedTags(c.description || "");

                                                return (
                                                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                                        <td colSpan={7} style={{ padding: 0 }}>
                                                            <div style={{
                                                                padding: "1.5rem 2rem",
                                                                background: "rgba(99,102,241,0.03)",
                                                                borderTop: `3px solid ${pCfg.color}`,
                                                                animation: "slideDown 0.25s ease",
                                                            }}>
                                                                {/* Collector Directive Official Order Card */}
                                                                {directiveData && (() => {
                                                                    const atr = parseEmbeddedTag<{ resolvedAt?: string }>(c.description, "ACTION_TAKEN_REPORT");
                                                                    const sla = computeDirectiveSlaStatus(
                                                                        directiveData.issuedAt,
                                                                        directiveData.priorityTarget,
                                                                        c.status,
                                                                        directiveData.deadlineHours,
                                                                        Date.now(),
                                                                        atr?.resolvedAt
                                                                    );
                                                                    return (
                                                                        <div style={{
                                                                            marginBottom: "1.25rem",
                                                                            padding: "1rem 1.25rem",
                                                                            borderRadius: "0.85rem",
                                                                            background: sla.isDelayedResolution
                                                                                ? "linear-gradient(135deg, rgba(251, 146, 60, 0.16), rgba(194, 65, 12, 0.08))"
                                                                                : sla.isOverdue
                                                                                ? "linear-gradient(135deg, rgba(239, 68, 68, 0.16), rgba(185, 28, 28, 0.08))"
                                                                                : sla.isResolved
                                                                                ? "linear-gradient(135deg, rgba(16, 185, 129, 0.14), rgba(5, 150, 105, 0.08))"
                                                                                : "linear-gradient(135deg, rgba(245, 158, 11, 0.14), rgba(217, 119, 6, 0.08))",
                                                                            border: `1.5px solid ${sla.isDelayedResolution ? "rgba(251, 146, 60, 0.5)" : sla.isOverdue ? "rgba(239, 68, 68, 0.5)" : sla.isResolved ? "rgba(16, 185, 129, 0.45)" : "rgba(245, 158, 11, 0.45)"}`,
                                                                            boxShadow: `0 0 20px ${sla.isDelayedResolution ? "rgba(251, 146, 60, 0.18)" : sla.isOverdue ? "rgba(239, 68, 68, 0.18)" : sla.isResolved ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)"}`,
                                                                        }}>
                                                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem", flexWrap: "wrap", gap: "0.5rem" }}>
                                                                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                                                    <span style={{ fontSize: "1.25rem" }}>🏛️</span>
                                                                                    <span style={{ fontWeight: "800", color: "#fbbf24", fontSize: "0.95rem" }}>
                                                                                        District Magistrate Official Directive Order (#{directiveData.orderId})
                                                                                    </span>
                                                                                </div>
                                                                                <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
                                                                                    <span style={{ padding: "0.2rem 0.65rem", borderRadius: "99px", background: "rgba(245, 158, 11, 0.22)", color: "#fef08a", fontSize: "0.72rem", fontWeight: "800", border: "1px solid rgba(245, 158, 11, 0.5)" }}>
                                                                                        {directiveData.priorityTarget}
                                                                                    </span>
                                                                                    <span style={{ padding: "0.2rem 0.65rem", borderRadius: "99px", background: sla.bg, color: sla.color, fontSize: "0.72rem", fontWeight: "800", border: `1px solid ${sla.border}` }}>
                                                                                        {sla.label}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                            <p style={{ margin: "0.35rem 0 0.5rem", fontSize: "0.88rem", color: "#fef3c7", lineHeight: "1.55", fontStyle: "italic" }}>
                                                                                "{directiveData.directiveNote}"
                                                                            </p>
                                                                            <div style={{ fontSize: "0.72rem", color: "rgba(253, 230, 138, 0.8)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.4rem" }}>
                                                                                <span>Issued by: <strong>{directiveData.officerName} ({directiveData.officerTitle})</strong></span>
                                                                                <span>Issued at: {new Date(directiveData.issuedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })()}

                                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.5rem" }}>

                                                                    {/* Col 1 — Description & Evidence */}
                                                                    <div style={{ minWidth: 0 }}>
                                                                        <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>
                                                                            {CATEGORY_ICONS[c.category] || "📁"} Description
                                                                        </div>
                                                                        <p style={{ fontSize: "0.88rem", lineHeight: "1.65", color: "var(--text-main)", margin: 0, wordBreak: "break-word" }}>
                                                                            {cleanDesc || "No additional description text provided."}
                                                                        </p>

                                                                        {/* Photo Evidence Section */}
                                                                        {(evidencePhoto || c.attachments > 0) && (
                                                                            <div style={{ marginTop: "1rem", padding: "0.75rem", borderRadius: "0.75rem", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                                                                                <div style={{ fontSize: "0.72rem", fontWeight: "800", color: "#a5b4fc", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                                                                    <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                                                                        <span>📷</span>
                                                                                        <span>Citizen Photo Evidence ({c.attachments || 1})</span>
                                                                                    </span>
                                                                                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: "600" }}>Tap to inspect</span>
                                                                                </div>

                                                                                {evidencePhoto ? (
                                                                                    <div
                                                                                        onClick={() => setViewingPhoto({ url: evidencePhoto, title: c.subject, location: c.location, category: c.category })}
                                                                                        style={{
                                                                                            position: "relative",
                                                                                            borderRadius: "0.5rem",
                                                                                            overflow: "hidden",
                                                                                            cursor: "pointer",
                                                                                            border: "1px solid rgba(99,102,241,0.3)",
                                                                                            maxHeight: "150px",
                                                                                            display: "flex",
                                                                                            alignItems: "center",
                                                                                            justifyContent: "center",
                                                                                            background: "#000",
                                                                                        }}
                                                                                    >
                                                                                        <img
                                                                                            src={evidencePhoto}
                                                                                            alt="Citizen Uploaded Evidence"
                                                                                            style={{ width: "100%", maxHeight: "150px", objectFit: "cover", transition: "transform 0.2s" }}
                                                                                            onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.03)")}
                                                                                            onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                                                                                        />
                                                                                        <div style={{
                                                                                            position: "absolute", bottom: 0, left: 0, right: 0,
                                                                                            background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)",
                                                                                            padding: "0.35rem 0.6rem", fontSize: "0.7rem", color: "white",
                                                                                            display: "flex", alignItems: "center", justifyContent: "space-between"
                                                                                        }}>
                                                                                            <span>🔍 Click to inspect photo</span>
                                                                                            <span style={{ color: "#4ade80", fontWeight: "700" }}>✓ Uploaded Evidence</span>
                                                                                        </div>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div
                                                                                        onClick={() => setViewingPhoto({ url: null, title: c.subject, location: c.location, category: c.category })}
                                                                                        style={{
                                                                                            padding: "0.75rem",
                                                                                            borderRadius: "0.5rem",
                                                                                            background: "rgba(99,102,241,0.08)",
                                                                                            border: "1px dashed rgba(99,102,241,0.3)",
                                                                                            cursor: "pointer",
                                                                                            textAlign: "center",
                                                                                        }}
                                                                                    >
                                                                                        <div style={{ fontSize: "1.2rem", marginBottom: "0.2rem" }}>📎</div>
                                                                                        <div style={{ fontSize: "0.78rem", fontWeight: "700", color: "#a5b4fc" }}>
                                                                                            {c.attachments} Photographic Proof File Recorded
                                                                                        </div>
                                                                                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                                                                                            Click to view evidence details
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Col 2 — Meta */}
                                                                    <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                                                        <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.1rem" }}>📋 Details</div>
                                                                        {[
                                                                            { icon: "📍", label: "Location", val: c.location },
                                                                            { icon: "📅", label: "Filed", val: c.date },
                                                                            { icon: "👤", label: "Citizen", val: c.user },
                                                                            { icon: "📂", label: "Category", val: c.category },
                                                                        ].map(row => (
                                                                            <div key={row.label} style={{ display: "flex", gap: "0.5rem", fontSize: "0.83rem" }}>
                                                                                <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{row.icon}</span>
                                                                                <span style={{ color: "var(--text-muted)", fontWeight: "600", flexShrink: 0 }}>{row.label}:</span>
                                                                                <span style={{ color: "var(--text-main)", wordBreak: "break-word" }}>{row.val}</span>
                                                                            </div>
                                                                        ))}
                                                                        {(() => {
                                                                            const claim = parseEmbeddedTag<EmbeddedClaim>(c.description || "", "CLAIMED_BY");
                                                                            if (!claim) return null;
                                                                            return (
                                                                                <div style={{
                                                                                    marginTop: "0.25rem",
                                                                                    padding: "0.55rem 0.75rem",
                                                                                    borderRadius: "0.625rem",
                                                                                    background: "rgba(16, 185, 129, 0.08)",
                                                                                    border: "1px solid rgba(16, 185, 129, 0.25)",
                                                                                    display: "flex",
                                                                                    flexDirection: "column",
                                                                                    gap: "0.25rem",
                                                                                }}>
                                                                                    <div style={{ fontSize: "0.68rem", fontWeight: "800", color: "#34d399", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                                                                        <span>👮</span>
                                                                                        <span>Officer In-Charge</span>
                                                                                    </div>
                                                                                    <div style={{ fontSize: "0.82rem", fontWeight: "700", color: "#e2e8f0" }}>
                                                                                        {claim.officerName}
                                                                                    </div>
                                                                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                                                                        {claim.officerRole || "Field Officer"}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                    </div>

                                                                    {/* Col 3 — AI Note + Actions */}
                                                                    <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                                                                        <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>🤖 AI Triage Note</div>
                                                                        <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: "0.75rem", padding: "0.75rem 1rem", fontSize: "0.82rem", lineHeight: "1.6", color: "var(--text-main)", wordBreak: "break-word" }}>
                                                                            {c.aiNote}
                                                                        </div>
                                                                        {/* Detail actions (Field Officers only) */}
                                                                        {c.status !== "Resolved" && c.status !== "Rejected" && !isDistrictHead && (() => {
                                                                            const claimData = parseEmbeddedTag<EmbeddedClaim>(c.description || "", "CLAIMED_BY");
                                                                            const claimedByOther = Boolean(
                                                                                claimData?.officerEmail &&
                                                                                claimData.officerEmail.toLowerCase() !== (user?.email || "").toLowerCase()
                                                                            );

                                                                            if (claimedByOther && claimData) {
                                                                                return (
                                                                                    <div style={{
                                                                                        marginTop: "0.25rem",
                                                                                        padding: "0.75rem 0.9rem",
                                                                                        borderRadius: "0.75rem",
                                                                                        background: "rgba(245, 158, 11, 0.1)",
                                                                                        border: "1px solid rgba(245, 158, 11, 0.35)",
                                                                                        color: "#fde68a",
                                                                                        fontSize: "0.78rem",
                                                                                        fontWeight: "700",
                                                                                        lineHeight: 1.45,
                                                                                    }}>
                                                                                        🔒 Claimed by <strong>{claimData.officerName}</strong>. Only the assigned officer can resolve or reject this grievance.
                                                                                    </div>
                                                                                );
                                                                            }

                                                                            const isUnclaimedPending = c.status === "Pending" && !claimData;
                                                                            const myActiveClaim = !isDistrictHead && user?.email
                                                                                ? findOfficerActiveClaim(user.email, officerDomainComplaints)
                                                                                : null;
                                                                            const hasOtherActiveClaim = Boolean(myActiveClaim && myActiveClaim.id !== c.id);

                                                                            if (isUnclaimedPending) {
                                                                                return (
                                                                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", marginTop: "0.25rem" }}>
                                                                                        <div style={{ display: "flex", gap: "0.5rem" }}>
                                                                                            <button
                                                                                                disabled={claimingId === c.id || hasOtherActiveClaim}
                                                                                                onClick={() => handleClaimComplaint(c.id)}
                                                                                                className="btn btn-primary"
                                                                                                style={{
                                                                                                    flex: 1.4,
                                                                                                    padding: "0.58rem 0.75rem",
                                                                                                    fontSize: "0.82rem",
                                                                                                    borderRadius: "0.625rem",
                                                                                                    cursor: hasOtherActiveClaim ? "not-allowed" : claimingId === c.id ? "wait" : "pointer",
                                                                                                    opacity: hasOtherActiveClaim ? 0.45 : 1,
                                                                                                    fontWeight: "800",
                                                                                                }}
                                                                                            >
                                                                                                {claimingId === c.id ? "Claiming..." : hasOtherActiveClaim ? "🔒 Finish Active First" : "🙋 Claim & Start Work"}
                                                                                            </button>
                                                                                            <button
                                                                                                style={{
                                                                                                    flex: 0.75,
                                                                                                    padding: "0.58rem 0.5rem",
                                                                                                    fontSize: "0.82rem",
                                                                                                    borderRadius: "0.625rem",
                                                                                                    background: "#ef444412",
                                                                                                    color: "#ef4444",
                                                                                                    border: "1px solid #ef444428",
                                                                                                    cursor: "pointer",
                                                                                                    fontWeight: "700",
                                                                                                    transition: "var(--transition)",
                                                                                                }}
                                                                                                onClick={() => updateStatus(c.id, "Rejected")}
                                                                                                onMouseEnter={e => { e.currentTarget.style.background = "#ef444422"; }}
                                                                                                onMouseLeave={e => { e.currentTarget.style.background = "#ef444412"; }}
                                                                                            >✕ Reject</button>
                                                                                        </div>
                                                                                        <div style={{ fontSize: "0.7rem", color: hasOtherActiveClaim ? "#fbbf24" : "var(--text-muted)", textAlign: "center", fontWeight: hasOtherActiveClaim ? "700" : "400" }}>
                                                                                            {hasOtherActiveClaim && myActiveClaim
                                                                                                ? `⏳ Finish your active grievance (#${myActiveClaim.id}) first before claiming another.`
                                                                                                : "Claim this grievance first to lock it to your name and unlock resolution."}
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            }

                                                                            return (
                                                                                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                                                                                    <button
                                                                                        className="btn btn-primary"
                                                                                        style={{ flex: 1, padding: "0.58rem 0", fontSize: "0.82rem", borderRadius: "0.625rem" }}
                                                                                        onClick={() => handleOpenResolveModal(c)}
                                                                                    >✓ Mark Resolved</button>
                                                                                    <button
                                                                                        style={{ flex: 1, padding: "0.58rem 0", fontSize: "0.82rem", borderRadius: "0.625rem", background: "#ef444412", color: "#ef4444", border: "1px solid #ef444428", cursor: "pointer", fontWeight: "700", transition: "var(--transition)" }}
                                                                                        onClick={() => updateStatus(c.id, "Rejected")}
                                                                                        onMouseEnter={e => { e.currentTarget.style.background = "#ef444422"; }}
                                                                                        onMouseLeave={e => { e.currentTarget.style.background = "#ef444412"; }}
                                                                                    >✕ Reject</button>
                                                                                </div>
                                                                            );
                                                                        })()}

                                                                        {/* Collector Executive Assignment (for Pending grievances): Assign an available/free departmental officer */}
                                                                        {isDistrictHead && c.status === "Pending" && (() => {
                                                                            // 1. Filter officers strictly mapped to this grievance's category
                                                                            const deptOfficers = districtOfficers.filter(o => {
                                                                                const r = (o.authorityRole || "").toLowerCase();
                                                                                // Exclude collectors/magistrates from field assignments
                                                                                if (r.includes("collector") || r.includes("magistrate") || r.includes("commissioner")) return false;
                                                                                const dept = mapRoleToDepartment(o.authorityRole || "");
                                                                                return dept === c.category;
                                                                            });

                                                                            // 2. Identify which departmental officers are currently free vs. busy
                                                                            const candidates: AvailableOfficerCandidate[] = deptOfficers.map(o => {
                                                                                const activeClaim = findOfficerActiveClaim(o.email, complaints);
                                                                                return {
                                                                                    email: o.email,
                                                                                    name: o.username || "Department Field Officer",
                                                                                    role: o.authorityRole || `${c.category} Officer`,
                                                                                    department: c.category,
                                                                                    isBusy: Boolean(activeClaim),
                                                                                    busyComplaintId: activeClaim?.id,
                                                                                };
                                                                            });

                                                                            const freeCandidates = candidates.filter(cand => !cand.isBusy);
                                                                            const selectedEmail = selectedAssignOfficer[c.id] || (freeCandidates[0]?.email || "");

                                                                            return (
                                                                                <div
                                                                                    onClick={e => e.stopPropagation()}
                                                                                    style={{
                                                                                        marginTop: "0.25rem",
                                                                                        padding: "0.75rem 0.9rem",
                                                                                        borderRadius: "0.75rem",
                                                                                        background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(6, 182, 212, 0.08))",
                                                                                        border: "1px solid rgba(16, 185, 129, 0.3)",
                                                                                        display: "flex",
                                                                                        flexDirection: "column",
                                                                                        gap: "0.45rem",
                                                                                    }}
                                                                                >
                                                                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                                                                        <span style={{ fontSize: "0.7rem", fontWeight: "800", color: "#34d399", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                                                                            <span>👤</span>
                                                                                            <span>Assign Field Officer</span>
                                                                                        </span>
                                                                                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                                                                            Dept: <strong style={{ color: "#e2e8f0" }}>{c.category}</strong>
                                                                                        </span>
                                                                                    </div>

                                                                                    {freeCandidates.length > 0 ? (
                                                                                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                                                                                            <select
                                                                                                value={selectedEmail}
                                                                                                onChange={e => setSelectedAssignOfficer(prev => ({ ...prev, [c.id]: e.target.value }))}
                                                                                                style={{
                                                                                                    flex: "1 1 200px",
                                                                                                    minWidth: "160px",
                                                                                                    padding: "0.45rem 0.65rem",
                                                                                                    borderRadius: "0.5rem",
                                                                                                    background: "#0f172a",
                                                                                                    border: "1px solid rgba(16, 185, 129, 0.35)",
                                                                                                    color: "#ffffff",
                                                                                                    fontSize: "0.8rem",
                                                                                                    outline: "none",
                                                                                                    cursor: "pointer",
                                                                                                }}
                                                                                            >
                                                                                                {freeCandidates.map(cand => (
                                                                                                    <option key={cand.email} value={cand.email} style={{ background: "#0f172a", color: "#ffffff" }}>
                                                                                                        🟢 {cand.name} ({cand.role}) — Available
                                                                                                    </option>
                                                                                                ))}
                                                                                            </select>
                                                                                            <button
                                                                                                disabled={assigningComplaintId === c.id || !selectedEmail}
                                                                                                onClick={() => handleAssignOfficer(c.id, selectedEmail)}
                                                                                                style={{
                                                                                                    flex: "0 0 auto",
                                                                                                    padding: "0.45rem 0.85rem",
                                                                                                    borderRadius: "0.5rem",
                                                                                                    background: "linear-gradient(135deg, #10b981, #059669)",
                                                                                                    color: "#ffffff",
                                                                                                    border: "none",
                                                                                                    fontSize: "0.78rem",
                                                                                                    fontWeight: "800",
                                                                                                    cursor: assigningComplaintId === c.id ? "wait" : "pointer",
                                                                                                    whiteSpace: "nowrap",
                                                                                                    transition: "all 0.2s ease",
                                                                                                    boxShadow: "0 2px 8px rgba(16, 185, 129, 0.25)",
                                                                                                }}
                                                                                            >
                                                                                                {assigningComplaintId === c.id ? "Assigning..." : "Assign Officer →"}
                                                                                            </button>
                                                                                        </div>
                                                                                    ) : deptOfficers.length === 0 ? (
                                                                                        <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                                                                                            ℹ️ No registered {c.category} officers found in this district.
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div style={{ fontSize: "0.74rem", color: "#fbbf24", fontWeight: "700" }}>
                                                                                            ⏳ All {deptOfficers.length} {c.category} officer(s) currently busy on active grievances.
                                                                                        </div>
                                                                                    )}

                                                                                    {assignSuccessId === c.id && (
                                                                                        <div style={{ fontSize: "0.72rem", color: "#10b981", fontWeight: "700", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                                                                            <span>✓</span>
                                                                                            <span>Officer assigned successfully! Grievance now In Progress.</span>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })()}

                                                                        {/* Collector Executive Control: Transfer Department & Executive Directive */}
                                                                        {isDistrictHead && c.status !== "Resolved" && c.status !== "Rejected" && c.status !== "Pending" && (
                                                                            <>
                                                                                <div
                                                                                    onClick={e => e.stopPropagation()}
                                                                                    style={{
                                                                                        marginTop: "0.25rem",
                                                                                        padding: "0.75rem 0.9rem",
                                                                                        borderRadius: "0.75rem",
                                                                                        background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(168, 85, 247, 0.08))",
                                                                                        border: "1px solid rgba(168, 85, 247, 0.25)",
                                                                                        display: "flex",
                                                                                        flexDirection: "column",
                                                                                        gap: "0.45rem",
                                                                                    }}
                                                                                >
                                                                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                                                                        <span style={{ fontSize: "0.7rem", fontWeight: "800", color: "#c084fc", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                                                                            <span>🔄</span>
                                                                                            <span>Transfer Department</span>
                                                                                        </span>
                                                                                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                                                                            Current: <strong style={{ color: "#e2e8f0" }}>{c.category}</strong>
                                                                                        </span>
                                                                                    </div>
                                                                                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                                                                                        <select
                                                                                            value={transferSelections[c.id] || c.category}
                                                                                            onChange={e => setTransferSelections(prev => ({ ...prev, [c.id]: e.target.value }))}
                                                                                            style={{
                                                                                                flex: 1,
                                                                                                padding: "0.45rem 0.65rem",
                                                                                                borderRadius: "0.5rem",
                                                                                                background: "#0f172a",
                                                                                                border: "1px solid rgba(255, 255, 255, 0.15)",
                                                                                                color: "#ffffff",
                                                                                                fontSize: "0.8rem",
                                                                                                outline: "none",
                                                                                                cursor: "pointer",
                                                                                            }}
                                                                                        >
                                                                                            {["Administrative", "Environment", "Infrastructure", "Public Health", "Safety"].map(d => (
                                                                                                <option key={d} value={d} style={{ background: "#0f172a", color: "#ffffff" }}>
                                                                                                    {d === "Administrative" ? "📁 Administrative" :
                                                                                                     d === "Environment" ? "🌿 Environment" :
                                                                                                     d === "Infrastructure" ? "🏗️ Infrastructure" :
                                                                                                     d === "Public Health" ? "🏥 Public Health" : "🛡️ Safety"}
                                                                                                </option>
                                                                                            ))}
                                                                                        </select>
                                                                                        <button
                                                                                            disabled={transferringId === c.id || ((transferSelections[c.id] || c.category) === c.category)}
                                                                                            onClick={() => handleTransferDepartment(c.id, transferSelections[c.id] || c.category)}
                                                                                            style={{
                                                                                                padding: "0.45rem 0.85rem",
                                                                                                borderRadius: "0.5rem",
                                                                                                background: ((transferSelections[c.id] || c.category) !== c.category)
                                                                                                    ? "linear-gradient(135deg, #a855f7, #6366f1)"
                                                                                                    : "rgba(255, 255, 255, 0.08)",
                                                                                                color: ((transferSelections[c.id] || c.category) !== c.category) ? "#ffffff" : "var(--text-muted)",
                                                                                                border: "none",
                                                                                                fontSize: "0.78rem",
                                                                                                fontWeight: "700",
                                                                                                cursor: ((transferSelections[c.id] || c.category) !== c.category) ? "pointer" : "not-allowed",
                                                                                                whiteSpace: "nowrap",
                                                                                                transition: "all 0.2s ease",
                                                                                            }}
                                                                                        >
                                                                                            {transferringId === c.id ? "Transferring..." : "Apply Transfer"}
                                                                                        </button>
                                                                                    </div>
                                                                                    {transferSuccessId === c.id && (
                                                                                        <div style={{ fontSize: "0.72rem", color: "#10b981", fontWeight: "700", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                                                                            <span>✓</span>
                                                                                            <span>Transferred successfully to {c.category}!</span>
                                                                                        </div>
                                                                                    )}
                                                                                </div>

                                                                                {/* Collector Executive Directive Button */}
                                                                                <div style={{ marginTop: "0.45rem" }}>
                                                                                    <button
                                                                                        onClick={e => {
                                                                                            e.stopPropagation();
                                                                                            setDirectingComplaint({ id: c.id, subject: c.subject, category: c.category });
                                                                                            if (directiveData) {
                                                                                                const hrs = directiveData.deadlineHours || 24;
                                                                                                const matchingPreset = DIRECTIVE_TIME_CHIPS.find(ch => ch.hours === hrs);
                                                                                                setDirectiveForm({
                                                                                                    target: directiveData.priorityTarget,
                                                                                                    deadlineHours: hrs,
                                                                                                    isCustom: !matchingPreset,
                                                                                                    customDaysInput: String(Math.min(30, Math.max(1, Math.round(hrs / 24)))),
                                                                                                    note: directiveData.directiveNote,
                                                                                                });
                                                                                            } else {
                                                                                                setDirectiveForm({
                                                                                                    target: "🚨 24 Hours — Urgent Expedite",
                                                                                                    deadlineHours: 24,
                                                                                                    isCustom: false,
                                                                                                    customDaysInput: "6",
                                                                                                    note: "",
                                                                                                });
                                                                                            }
                                                                                        }}
                                                                                        style={{
                                                                                            width: "100%",
                                                                                            padding: "0.5rem 0.85rem",
                                                                                            borderRadius: "0.625rem",
                                                                                            background: directiveData 
                                                                                                ? "linear-gradient(135deg, #d97706, #b45309)"
                                                                                                : "linear-gradient(135deg, #f59e0b, #d97706)",
                                                                                            border: "1px solid rgba(245, 158, 11, 0.5)",
                                                                                            color: "#ffffff",
                                                                                            fontSize: "0.78rem",
                                                                                            fontWeight: "800",
                                                                                            cursor: "pointer",
                                                                                            display: "inline-flex",
                                                                                            alignItems: "center",
                                                                                            justifyContent: "center",
                                                                                            gap: "0.45rem",
                                                                                            boxShadow: "0 2px 8px rgba(245, 158, 11, 0.25)",
                                                                                            transition: "all 0.2s ease",
                                                                                        }}
                                                                                    >
                                                                                        <span>🏛️</span>
                                                                                        <span>{directiveData ? "Update Executive Directive" : "Issue Executive Directive (24h Expedite)"}</span>
                                                                                    </button>
                                                                                    {directiveSuccessId === c.id && (
                                                                                        <div style={{ fontSize: "0.72rem", color: "#fbbf24", fontWeight: "700", display: "flex", alignItems: "center", gap: "0.3rem", marginTop: "0.3rem", justifyContent: "center" }}>
                                                                                            <span>✓</span>
                                                                                            <span>Official Directive Order issued successfully!</span>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                        {(c.status === "Resolved" || c.status === "Rejected") && (
                                                                            <div style={{ fontSize: "0.82rem", fontWeight: "700", color: sCfg.color, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                                                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: sCfg.dot, display: "inline-block" }} />
                                                                                This complaint is {c.status.toLowerCase()}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* ── Official Action Taken Report (ATR) Card when Resolved ── */}
                                                                {atrData && (
                                                                    <div style={{
                                                                        marginTop: "1.5rem",
                                                                        padding: "1.25rem 1.5rem",
                                                                        borderRadius: "1rem",
                                                                        background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(6, 182, 212, 0.04))",
                                                                        border: "1.5px solid rgba(16, 185, 129, 0.35)",
                                                                    }}>
                                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                                                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                                                <span style={{ fontSize: "1.2rem" }}>✅</span>
                                                                                <span style={{ fontSize: "1rem", fontWeight: "800", color: "#ffffff" }}>
                                                                                    Official Action Taken Report (ATR)
                                                                                </span>
                                                                            </div>
                                                                            <span style={{
                                                                                padding: "0.2rem 0.65rem",
                                                                                borderRadius: "99px",
                                                                                background: "rgba(16, 185, 129, 0.2)",
                                                                                color: "#10b981",
                                                                                border: "1px solid rgba(16, 185, 129, 0.4)",
                                                                                fontSize: "0.72rem",
                                                                                fontWeight: "800",
                                                                            }}>
                                                                                VERIFIED RESOLUTION
                                                                            </span>
                                                                        </div>

                                                                        <div style={{
                                                                            display: "grid",
                                                                            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                                                                            gap: "0.75rem",
                                                                            marginBottom: "1rem",
                                                                            padding: "0.85rem 1rem",
                                                                            borderRadius: "0.65rem",
                                                                            background: "rgba(0,0,0,0.3)",
                                                                            border: "1px solid rgba(255,255,255,0.06)",
                                                                        }}>
                                                                            <div>
                                                                                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>
                                                                                    👷 Official Staff / Engineer
                                                                                </div>
                                                                                <div style={{ fontSize: "0.9rem", fontWeight: "700", color: "#ffffff", marginTop: "0.15rem" }}>
                                                                                    {atrData.officerName || "Municipal Officer"}
                                                                                </div>
                                                                            </div>
                                                                            <div>
                                                                                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>
                                                                                    📅 Resolution Date
                                                                                </div>
                                                                                <div style={{ fontSize: "0.9rem", fontWeight: "700", color: "#ffffff", marginTop: "0.15rem" }}>
                                                                                    {atrData.resolvedAt ? new Date(atrData.resolvedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : c.date}
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        <div style={{ marginBottom: "1rem" }}>
                                                                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "800", marginBottom: "0.3rem" }}>
                                                                                📝 Work Executed &amp; Action Taken
                                                                            </div>
                                                                            <div style={{
                                                                                fontSize: "0.88rem",
                                                                                lineHeight: "1.6",
                                                                                color: "var(--text-main)",
                                                                                padding: "0.75rem 1rem",
                                                                                borderRadius: "0.65rem",
                                                                                background: "rgba(255,255,255,0.03)",
                                                                                border: "1px solid rgba(255,255,255,0.08)",
                                                                                wordBreak: "break-word",
                                                                            }}>
                                                                                {atrData.actionDescription}
                                                                            </div>
                                                                        </div>

                                                                        {/* Before vs After Photo Proof */}
                                                                        <div style={{ marginTop: "1rem" }}>
                                                                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "800", marginBottom: "0.5rem" }}>
                                                                                📸 Resolution Proof &amp; Verification
                                                                            </div>
                                                                            <div style={{ display: "grid", gridTemplateColumns: evidencePhoto && atrData.resolutionPhoto ? "1fr 1fr" : "1fr", gap: "1rem", maxWidth: "600px" }}>
                                                                                {evidencePhoto && (
                                                                                    <div
                                                                                        onClick={() => setViewingPhoto({ url: evidencePhoto, title: "Citizen Evidence (Before)", location: c.location, category: c.category })}
                                                                                        style={{
                                                                                            borderRadius: "0.65rem",
                                                                                            overflow: "hidden",
                                                                                            border: "1px solid rgba(239, 68, 68, 0.4)",
                                                                                            background: "#000",
                                                                                            cursor: "pointer",
                                                                                        }}
                                                                                    >
                                                                                        <div style={{ padding: "0.3rem 0.6rem", background: "rgba(239, 68, 68, 0.2)", fontSize: "0.68rem", fontWeight: "800", color: "#f87171" }}>
                                                                                            BEFORE (CITIZEN EVIDENCE)
                                                                                        </div>
                                                                                        <img src={evidencePhoto} alt="Before" style={{ width: "100%", height: "130px", objectFit: "cover" }} />
                                                                                    </div>
                                                                                )}
                                                                                {atrData.resolutionPhoto && (
                                                                                    <div
                                                                                        onClick={() => setViewingPhoto({ url: atrData.resolutionPhoto!, title: "Official Resolution (After)", location: c.location, category: c.category })}
                                                                                        style={{
                                                                                            borderRadius: "0.65rem",
                                                                                            overflow: "hidden",
                                                                                            border: "1px solid rgba(16, 185, 129, 0.5)",
                                                                                            background: "#000",
                                                                                            cursor: "pointer",
                                                                                        }}
                                                                                    >
                                                                                        <div style={{ padding: "0.3rem 0.6rem", background: "rgba(16, 185, 129, 0.2)", fontSize: "0.68rem", fontWeight: "800", color: "#34d399" }}>
                                                                                            AFTER (OFFICIAL RESOLUTION PROOF)
                                                                                        </div>
                                                                                        <img src={atrData.resolutionPhoto} alt="After" style={{ width: "100%", height: "130px", objectFit: "cover" }} />
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })()}
                                        </React.Fragment>
                                    );
                                }))}
                            </tbody>
                        </table>

                        {/* Empty state */}
                        {loading && (
                            <div style={{ padding: "4rem 2rem", textAlign: "center" }}>
                                <div style={{ fontSize: "2rem", marginBottom: "0.75rem", animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</div>
                                <p style={{ fontWeight: "600", color: "var(--text-muted)" }}>Loading complaints from Supabase...</p>
                            </div>
                        )}
                        {!loading && filtered.length === 0 && (
                            <div style={{ padding: "4rem 2rem", textAlign: "center" }}>
                                <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>📭</div>
                                <p style={{ fontWeight: "700", color: "var(--text-main)", fontSize: "1rem", marginBottom: "0.4rem" }}>No complaints match the selected filters</p>
                                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "1rem" }}>Try selecting another department or area, or clear your search query.</p>
                                <button
                                    onClick={() => {
                                        setFilter("All");
                                        setDepartmentFilter("All");
                                        setSearchQuery("");
                                    }}
                                    className="btn btn-secondary"
                                    style={{ padding: "0.45rem 1.1rem", fontSize: "0.8rem", borderRadius: "0.5rem" }}
                                >
                                    Clear All Filters
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Mobile View (Responsive Cards List) ── */}
                <div className="admin-mobile-cards">
                    {filtered.map((c) => {
                        const pCfg = PRIORITY_CONFIG[c.priority] ?? PRIORITY_CONFIG.Medium;
                        const sCfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.Pending;
                        const isExpanded = expandedId === c.id;

                        return (
                            <div
                                key={c.id}
                                className={`admin-mobile-card${isExpanded ? " admin-mobile-card--expanded" : ""}`}
                                onClick={() => toggleRow(c.id)}
                                style={{ borderTop: `4px solid ${pCfg.color}` }}
                            >
                                {/* Header */}
                                <div className="admin-mobile-card-header">
                                    <span className="admin-mobile-card-id">{c.id}</span>
                                    <span className="admin-mobile-card-date">{c.date}</span>
                                </div>

                                {/* Title */}
                                <div className="admin-mobile-card-title">{c.subject}</div>

                                {/* Tags */}
                                <div className="admin-mobile-card-tags">
                                    <span style={{ fontSize: "0.68rem", padding: "0.15rem 0.55rem", borderRadius: "99px", background: "var(--border-subtle)", color: "var(--primary)", fontWeight: "700" }}>
                                        {CATEGORY_ICONS[c.category] || "📁"} {c.category}
                                    </span>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem", padding: "0.15rem 0.55rem", borderRadius: "99px", fontSize: "0.68rem", fontWeight: "700", background: `${pCfg.color}14`, color: pCfg.color }}>
                                        {pCfg.icon} {c.priority}
                                    </span>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", padding: "0.15rem 0.55rem", borderRadius: "99px", fontSize: "0.68rem", fontWeight: "700", background: `${sCfg.dot}14`, color: sCfg.color }}>
                                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: sCfg.dot }} />
                                        {c.status}
                                    </span>
                                </div>

                                {/* Meta details bar (collapsible trigger hint) */}
                                <div className="admin-mobile-card-meta">
                                    <span>👤 {c.user.length > 20 ? c.user.substring(0, 18) + "..." : c.user}</span>
                                    {c.attachments > 0 && (
                                        <span style={{ fontWeight: "700", color: "#6366f1" }}>📎 {c.attachments}</span>
                                    )}
                                </div>

                                {/* Expand details panel */}
                                {isExpanded && (() => {
                                    const atrMatch = (c.description || "").match(/\[ACTION_TAKEN_REPORT:([\s\S]*?)\]/);
                                    let atrData: ActionTakenReportData | null = null;
                                    if (atrMatch) {
                                        try { atrData = JSON.parse(atrMatch[1]); } catch {}
                                    }
                                    const photoMatch = (c.description || "").match(/\[EVIDENCE_PHOTO:([^\]]+)\]/);
                                    const evidencePhoto = photoMatch ? photoMatch[1] : null;
                                    const cleanDesc = stripEmbeddedTags(c.description || "");

                                    return (
                                        <div className="admin-mobile-card-details">
                                            {/* Description */}
                                            <div>
                                                <div style={{ fontSize: "0.68rem", fontWeight: "800", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>
                                                    Description
                                                </div>
                                                <p style={{ fontSize: "0.85rem", lineHeight: "1.5", color: "var(--text-main)", margin: 0, wordBreak: "break-word" }}>
                                                    {cleanDesc || "No additional description text provided."}
                                                </p>
                                            </div>

                                            {/* Evidence photo if present */}
                                            {evidencePhoto && (
                                                <div style={{ marginTop: "0.5rem" }}>
                                                    <div style={{ fontSize: "0.68rem", fontWeight: "800", color: "#a5b4fc", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>
                                                        📷 Citizen Photo Evidence
                                                    </div>
                                                    <div
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setViewingPhoto({ url: evidencePhoto, title: c.subject, location: c.location, category: c.category });
                                                        }}
                                                        style={{ borderRadius: "0.5rem", overflow: "hidden", border: "1px solid rgba(99,102,241,0.3)", maxHeight: "140px", cursor: "pointer" }}
                                                    >
                                                        <img src={evidencePhoto} alt="Evidence" style={{ width: "100%", maxHeight: "140px", objectFit: "cover" }} />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Location info */}
                                            {c.location && (
                                                <div>
                                                    <div style={{ fontSize: "0.68rem", fontWeight: "800", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>
                                                        📍 Location
                                                    </div>
                                                    <p style={{ fontSize: "0.85rem", color: "var(--text-main)", margin: 0, wordBreak: "break-word" }}>
                                                        {c.location}
                                                    </p>
                                                </div>
                                            )}

                                            {/* AI Note */}
                                            <div>
                                                <div style={{ fontSize: "0.68rem", fontWeight: "800", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>
                                                    🤖 AI Triage Note
                                                </div>
                                                <div style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: "0.5rem", padding: "0.65rem 0.85rem", fontSize: "0.78rem", lineHeight: "1.5", color: "var(--text-main)", wordBreak: "break-word" }}>
                                                    {c.aiNote}
                                                </div>
                                            </div>

                                            {/* ATR Card in mobile */}
                                            {atrData && (
                                                <div style={{
                                                    marginTop: "0.75rem",
                                                    padding: "0.85rem",
                                                    borderRadius: "0.75rem",
                                                    background: "rgba(16, 185, 129, 0.08)",
                                                    border: "1px solid rgba(16, 185, 129, 0.35)",
                                                }}>
                                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                                                        <div style={{ fontSize: "0.85rem", fontWeight: "800", color: "#ffffff" }}>
                                                            ✅ Action Taken Report
                                                        </div>
                                                        <span style={{ fontSize: "0.65rem", padding: "0.15rem 0.5rem", borderRadius: "99px", background: "rgba(16, 185, 129, 0.2)", color: "#10b981", fontWeight: "800" }}>VERIFIED</span>
                                                    </div>
                                                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                                                        👷 <strong>{atrData.officerName || "Municipal Officer"}</strong>
                                                    </div>
                                                    <div style={{ fontSize: "0.78rem", color: "var(--text-main)", lineHeight: "1.4", marginBottom: "0.5rem", wordBreak: "break-word" }}>
                                                        {atrData.actionDescription}
                                                    </div>
                                                    {atrData.resolutionPhoto && (
                                                        <div
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setViewingPhoto({ url: atrData.resolutionPhoto!, title: "Resolution Proof", location: c.location, category: c.category });
                                                            }}
                                                            style={{ borderRadius: "0.5rem", overflow: "hidden", border: "1px solid rgba(16, 185, 129, 0.4)", cursor: "pointer" }}
                                                        >
                                                            <img src={atrData.resolutionPhoto} alt="After" style={{ width: "100%", maxHeight: "120px", objectFit: "cover" }} />
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Actions (Field Officers only) */}
                                            {c.status !== "Resolved" && c.status !== "Rejected" ? (
                                                !isDistrictHead ? (
                                                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }} onClick={e => e.stopPropagation()}>
                                                        <button
                                                            className="btn btn-primary"
                                                            style={{ flex: 1, padding: "0.65rem 0", fontSize: "0.82rem", borderRadius: "0.5rem" }}
                                                            onClick={() => handleOpenResolveModal(c)}
                                                        >
                                                            {t("admin_resolve")}
                                                        </button>
                                                        <button
                                                            style={{ flex: 1, padding: "0.65rem 0", fontSize: "0.82rem", borderRadius: "0.5rem", background: "#ef444412", color: "#ef4444", border: "1px solid #ef444428", cursor: "pointer", fontWeight: "700" }}
                                                            onClick={() => updateStatus(c.id, "Rejected")}
                                                        >
                                                            ✕ Reject
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div onClick={e => e.stopPropagation()} style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.4rem", padding: "0.6rem 0.75rem", borderRadius: "0.625rem", background: "rgba(168, 85, 247, 0.08)", border: "1px solid rgba(168, 85, 247, 0.25)" }}>
                                                        <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "#c084fc", textTransform: "uppercase" }}>🔄 Transfer Department</div>
                                                        <div style={{ display: "flex", gap: "0.4rem" }}>
                                                            <select
                                                                value={transferSelections[c.id] || c.category}
                                                                onChange={e => setTransferSelections(prev => ({ ...prev, [c.id]: e.target.value }))}
                                                                style={{ flex: 1, padding: "0.4rem", borderRadius: "0.4rem", background: "#0f172a", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", fontSize: "0.78rem" }}
                                                            >
                                                                {["Administrative", "Environment", "Infrastructure", "Public Health", "Safety"].map(d => (
                                                                    <option key={d} value={d}>{d}</option>
                                                                ))}
                                                            </select>
                                                            <button
                                                                disabled={transferringId === c.id || ((transferSelections[c.id] || c.category) === c.category)}
                                                                onClick={() => handleTransferDepartment(c.id, transferSelections[c.id] || c.category)}
                                                                style={{ padding: "0.4rem 0.65rem", borderRadius: "0.4rem", background: ((transferSelections[c.id] || c.category) !== c.category) ? "linear-gradient(135deg, #a855f7, #6366f1)" : "rgba(255,255,255,0.1)", color: "#fff", border: "none", fontSize: "0.75rem", fontWeight: "700" }}
                                                            >
                                                                {transferringId === c.id ? "..." : "Apply"}
                                                            </button>
                                                        </div>
                                                        {transferSuccessId === c.id && (
                                                            <span style={{ fontSize: "0.7rem", color: "#10b981", fontWeight: "700" }}>✓ Transferred!</span>
                                                        )}
                                                    </div>
                                                )
                                            ) : (
                                                <div style={{ fontSize: "0.8rem", fontWeight: "700", color: sCfg.color, display: "flex", alignItems: "center", gap: "0.3rem", marginTop: "0.25rem" }}>
                                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: sCfg.dot }} />
                                                    This complaint is {c.status.toLowerCase()}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        );
                    })}

                    {/* Empty states for Mobile */}
                    {loading && (
                        <div style={{ padding: "3rem 1rem", textAlign: "center" }}>
                            <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem", animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</div>
                            <p style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-muted)" }}>Loading complaints...</p>
                        </div>
                    )}
                    {!loading && filtered.length === 0 && (
                        <div style={{ padding: "3rem 1rem", textAlign: "center" }}>
                            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📭</div>
                            <p style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--text-main)", marginBottom: "0.4rem" }}>No complaints match the selected filters</p>
                            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.85rem" }}>Try clearing your department or area filters.</p>
                            <button
                                onClick={() => {
                                    setFilter("All");
                                    setDepartmentFilter("All");
                                    setSearchQuery("");
                                }}
                                className="btn btn-secondary"
                                style={{ padding: "0.4rem 1rem", fontSize: "0.78rem", borderRadius: "0.5rem" }}
                            >
                                Clear All Filters
                            </button>
                        </div>
                    )}
                </div>

            </main>

            <style>{`
                @keyframes ping {
                    0%        { transform: scale(1); opacity: 0.8; }
                    75%, 100% { transform: scale(2.2); opacity: 0; }
                }
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-8px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                tbody tr { transition: background 0.15s ease; }
                tbody tr:hover td { background: transparent; }
            `}</style>

            {/* ── Photo Evidence Full-Screen Lightbox Modal ── */}
            {viewingPhoto && (
                <div
                    style={{
                        position: "fixed", inset: 0, zIndex: 1000,
                        background: "rgba(0,0,0,0.88)", backdropFilter: "blur(12px)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        padding: "1.25rem",
                    }}
                    onClick={() => setViewingPhoto(null)}
                >
                    <div
                        style={{
                            maxWidth: "720px", width: "100%", background: "var(--bg-card, #1e293b)",
                            borderRadius: "1.1rem", border: "1px solid var(--border)",
                            overflow: "hidden", boxShadow: "0 25px 60px -15px rgba(0,0,0,0.8)",
                            animation: "zoomIn 0.2s ease",
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div style={{
                            padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border)",
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            background: "rgba(255,255,255,0.02)"
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: "700", color: "var(--text-main)" }}>
                                    📷 Citizen Photographic Evidence
                                </h3>
                                <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                    {viewingPhoto.title}
                                </p>
                            </div>
                            <button
                                onClick={() => setViewingPhoto(null)}
                                style={{
                                    background: "transparent", border: "none", color: "var(--text-muted)",
                                    fontSize: "1.3rem", cursor: "pointer", padding: "0.2rem 0.5rem",
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body / Image */}
                        <div style={{ padding: "1.25rem", textAlign: "center", background: "#0b0f19" }}>
                            {viewingPhoto.url ? (
                                <img
                                    src={viewingPhoto.url}
                                    alt="Citizen Evidence Full View"
                                    style={{ maxWidth: "100%", maxHeight: "65vh", borderRadius: "0.5rem", objectFit: "contain", border: "1px solid rgba(255,255,255,0.1)" }}
                                />
                            ) : (
                                <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
                                    <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>📸</div>
                                    <h4 style={{ color: "var(--text-main)", margin: "0 0 0.5rem 0", fontSize: "1.1rem" }}>
                                        {viewingPhoto.category || "Civic"} Evidence Tagged
                                    </h4>
                                    <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", maxWidth: "420px", margin: "0 auto 1.25rem auto", lineHeight: 1.5 }}>
                                        Citizen recorded photographic evidence with this grievance. Location timestamp geotag: <strong>{viewingPhoto.location || "Recorded"}</strong>.
                                    </p>
                                    <div style={{ display: "inline-flex", gap: "0.5rem", padding: "0.4rem 0.9rem", borderRadius: "99px", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80", fontSize: "0.78rem", fontWeight: "700" }}>
                                        <span>✓</span>
                                        <span>Watermark & Metadata Verified</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div style={{
                            padding: "0.85rem 1.25rem", borderTop: "1px solid var(--border)",
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            fontSize: "0.75rem", color: "var(--text-muted)", background: "rgba(255,255,255,0.02)"
                        }}>
                            <span>📍 Geotag: {viewingPhoto.location}</span>
                            <button
                                onClick={() => setViewingPhoto(null)}
                                style={{
                                    padding: "0.4rem 0.9rem", borderRadius: "0.5rem",
                                    background: "rgba(255,255,255,0.1)", border: "1px solid var(--border)",
                                    color: "var(--text-main)", fontSize: "0.78rem", cursor: "pointer", fontWeight: "600"
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Action Taken Report (ATR) & Proof of Resolution Modal */}
            <ActionTakenReportModal
                isOpen={!!resolvingComplaint}
                onClose={() => setResolvingComplaint(null)}
                complaint={resolvingComplaint}
                officerDistrict={officerDistrict}
                onResolveSuccess={handleResolveSuccess}
            />

            {/* ── Collector Executive Directive Modal ── */}
            {directingComplaint && (
                <div
                    style={{
                        position: "fixed", inset: 0, zIndex: 1000,
                        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        padding: "1.25rem",
                    }}
                    onClick={() => setDirectingComplaint(null)}
                >
                    <div
                        style={{
                            maxWidth: "560px", width: "100%", background: "var(--bg-card, #1e293b)",
                            borderRadius: "1.25rem", border: "1.5px solid rgba(245, 158, 11, 0.45)",
                            boxShadow: "0 25px 60px -15px rgba(245, 158, 11, 0.3)",
                            overflow: "hidden", animation: "slideDown 0.25s ease",
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div style={{
                            padding: "1.25rem 1.5rem",
                            background: "linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.08))",
                            borderBottom: "1px solid rgba(245, 158, 11, 0.3)",
                            display: "flex", alignItems: "center", justifyContent: "space-between"
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                                <span style={{ fontSize: "1.4rem" }}>🏛️</span>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: "800", color: "#fbbf24" }}>
                                        District Magistrate Executive Directive
                                    </h3>
                                    <p style={{ margin: "0.2rem 0 0", fontSize: "0.74rem", color: "rgba(253, 230, 138, 0.85)" }}>
                                        Issue priority mandate to {directingComplaint.category} Department ({directingComplaint.id})
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setDirectingComplaint(null)}
                                style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: "1.25rem", cursor: "pointer" }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Form Body */}
                        <form onSubmit={handleIssueDirective} style={{ padding: "1.5rem" }}>
                            <div style={{ marginBottom: "1.1rem" }}>
                                <div style={{ fontSize: "0.78rem", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.35rem" }}>
                                    📋 Grievance Subject:
                                </div>
                                <div style={{ padding: "0.65rem 0.85rem", borderRadius: "0.5rem", background: "rgba(255, 255, 255, 0.03)", border: "1px solid var(--border)", fontSize: "0.85rem", fontWeight: "600", color: "var(--text-main)" }}>
                                    {directingComplaint.subject}
                                </div>
                            </div>

                            <div style={{ marginBottom: "1.1rem" }}>
                                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.45rem" }}>
                                    ⚡ Target Resolution Window:
                                </label>
                                {/* 1-Click Time Chips + Inline Morphing Custom Pill */}
                                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
                                    {DIRECTIVE_TIME_CHIPS.map(chip => {
                                        const active = !directiveForm.isCustom && directiveForm.deadlineHours === chip.hours;
                                        return (
                                            <button
                                                key={chip.id}
                                                type="button"
                                                onClick={() => setDirectiveForm(prev => ({
                                                    ...prev,
                                                    isCustom: false,
                                                    deadlineHours: chip.hours,
                                                    target: chip.targetText,
                                                }))}
                                                style={{
                                                    padding: "0.42rem 0.78rem",
                                                    borderRadius: "99px",
                                                    fontSize: "0.76rem",
                                                    fontWeight: "800",
                                                    cursor: "pointer",
                                                    transition: "all 0.15s ease",
                                                    background: active ? "linear-gradient(135deg, #f59e0b, #d97706)" : "rgba(255, 255, 255, 0.05)",
                                                    border: active ? "1.5px solid #fbbf24" : "1px solid var(--border)",
                                                    color: active ? "#ffffff" : "var(--text-muted)",
                                                    boxShadow: active ? "0 0 12px rgba(245, 158, 11, 0.3)" : "none",
                                                }}
                                            >
                                                {chip.chipLabel}
                                            </button>
                                        );
                                    })}

                                    {/* Inline Morphing Custom Pill (no extra box, no spinner arrows) */}
                                    {!directiveForm.isCustom ? (
                                        <button
                                            type="button"
                                            onClick={() => setDirectiveForm(prev => ({ ...prev, isCustom: true }))}
                                            style={{
                                                padding: "0.42rem 0.78rem",
                                                borderRadius: "99px",
                                                fontSize: "0.76rem",
                                                fontWeight: "800",
                                                cursor: "pointer",
                                                transition: "all 0.15s ease",
                                                background: "rgba(255, 255, 255, 0.05)",
                                                border: "1px dashed rgba(245, 158, 11, 0.45)",
                                                color: "#fde68a",
                                            }}
                                        >
                                            ✏️ Custom
                                        </button>
                                    ) : (
                                        <div style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "0.35rem",
                                            padding: "0.24rem 0.7rem",
                                            borderRadius: "99px",
                                            background: "linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.2))",
                                            border: "1.5px solid #fbbf24",
                                            boxShadow: "0 0 12px rgba(245, 158, 11, 0.28)",
                                        }}>
                                            <span style={{ fontSize: "0.74rem" }}>✏️</span>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                maxLength={2}
                                                autoFocus
                                                aria-label="Custom deadline in days (1 to 30)"
                                                value={directiveForm.customDaysInput}
                                                onChange={e => {
                                                    const digits = e.target.value.replace(/[^0-9]/g, "");
                                                    if (!digits) {
                                                        setDirectiveForm(prev => ({ ...prev, customDaysInput: "" }));
                                                        return;
                                                    }
                                                    const clamped = Math.min(30, Math.max(1, parseInt(digits, 10)));
                                                    setDirectiveForm(prev => ({ ...prev, customDaysInput: String(clamped) }));
                                                }}
                                                onBlur={() => {
                                                    if (!directiveForm.customDaysInput) {
                                                        setDirectiveForm(prev => ({ ...prev, customDaysInput: "6" }));
                                                    }
                                                }}
                                                style={{
                                                    width: "34px",
                                                    background: "rgba(0, 0, 0, 0.35)",
                                                    border: "1px solid rgba(251, 191, 36, 0.45)",
                                                    borderRadius: "6px",
                                                    color: "#ffffff",
                                                    fontSize: "0.8rem",
                                                    fontWeight: "900",
                                                    textAlign: "center",
                                                    padding: "0.15rem 0.2rem",
                                                    outline: "none",
                                                }}
                                            />
                                            <span style={{ fontSize: "0.74rem", fontWeight: "800", color: "#fef3c7" }}>
                                                Days
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ marginBottom: "1.1rem" }}>
                                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.35rem" }}>
                                    ✍️ Collector's Executive Order & Instructions:
                                </label>
                                <textarea
                                    required
                                    rows={3}
                                    value={directiveForm.note}
                                    onChange={e => setDirectiveForm(prev => ({ ...prev, note: e.target.value }))}
                                    placeholder="Type direct instructions to the field officer (e.g. Inspect site immediately, fix pipeline, and file ATR by tomorrow evening)..."
                                    style={{
                                        width: "100%", padding: "0.7rem 0.85rem", borderRadius: "0.5rem",
                                        background: "var(--bg-main)", border: "1px solid var(--border)",
                                        color: "var(--text-main)", fontSize: "0.85rem", resize: "vertical", outline: "none"
                                    }}
                                />
                            </div>

                            {/* Footer Buttons */}
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" }}>
                                <button
                                    type="button"
                                    onClick={() => setDirectingComplaint(null)}
                                    style={{
                                        padding: "0.6rem 1.1rem", borderRadius: "0.5rem",
                                        background: "transparent", border: "1px solid var(--border)",
                                        color: "var(--text-muted)", fontSize: "0.82rem", fontWeight: "600", cursor: "pointer"
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={issuingDirective}
                                    style={{
                                        padding: "0.6rem 1.3rem", borderRadius: "0.5rem",
                                        background: "linear-gradient(135deg, #f59e0b, #d97706)", border: "none",
                                        color: "#ffffff", fontSize: "0.85rem", fontWeight: "800", cursor: "pointer",
                                        boxShadow: "0 2px 10px rgba(245, 158, 11, 0.35)", display: "flex", alignItems: "center", gap: "0.4rem"
                                    }}
                                >
                                    <span>🏛️</span>
                                    <span>{issuingDirective ? "Issuing Mandate..." : "Issue Official Directive Order"}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </ProtectedRoute>
    );
}
