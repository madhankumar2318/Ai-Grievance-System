"use client";

import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    getFullUserProfileServerAction,
    updateUserProfileServerAction,
    changePasswordServerAction,
    submitRetirementNoticeServerAction,
    getOfficerDutyStatusServerAction,
    RetirementNotice,
} from "@/app/actions/authActions";
import { TAMIL_NADU_DISTRICTS } from "@/lib/indiaGeoData";

const ROLE_CONFIG: Record<string, { label: string; labelKey: "role_citizen" | "role_authority" | "role_chief"; icon: string; color: string; gradient: string }> = {
    user: { label: "Citizen", labelKey: "role_citizen", icon: "👤", color: "#6366f1", gradient: "linear-gradient(135deg,#6366f1,#8b5cf6)" },
    authority: { label: "Authority Officer", labelKey: "role_authority", icon: "🏛️", color: "#f97316", gradient: "linear-gradient(135deg,#f97316,#fb923c)" },
    chief: { label: "Chief Commissioner", labelKey: "role_chief", icon: "⭐", color: "#ec4899", gradient: "linear-gradient(135deg,#ec4899,#f43f5e)" },
};

function getInitials(name: string) {
    if (!name) return "MK";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function getDepartmentForRole(roleStr: string): string {
    const r = (roleStr || "").toLowerCase();
    if (r.includes("environment") || r.includes("forest") || r.includes("wildlife") || r.includes("waste") || r.includes("pollution") || r.includes("tnpcb")) return "Environment";
    if (r.includes("health") || r.includes("sanitation") || r.includes("medical") || r.includes("hospital") || r.includes("food") || r.includes("fssai") || r.includes("dmo") || r.includes("dph")) return "Public Health";
    if (r.includes("infrastructure") || r.includes("pwd") || r.includes("electricity") || r.includes("water") || r.includes("transport") || r.includes("rto") || r.includes("bus") || r.includes("engineer")) return "Infrastructure & Utilities";
    if (r.includes("safety") || r.includes("traffic") || r.includes("police") || r.includes("fire") || r.includes("rescue") || r.includes("cyber") || r.includes("digital") || r.includes("fraud") || r.includes("dccps")) return "Police & Public Safety";
    if (r.includes("revenue") || r.includes("education") || r.includes("administrative") || r.includes("municipal") || r.includes("collector") || r.includes("tahsildar") || r.includes("supply") || r.includes("ration") || r.includes("civil") || r.includes("agriculture") || r.includes("farmer") || r.includes("crop") || r.includes("jda") || r.includes("welfare") || r.includes("pension") || r.includes("social") || r.includes("dswo") || r.includes("disability")) return "District Administration";
    return "District Administration";
}

function computeUniqueCitizenId(email: string, district: string, existingId?: string): string {
    if (existingId && existingId !== "CTZ-TN-2026") return existingId;
    const distCode = (district || "TN").slice(0, 3).toUpperCase();
    const cleanEmail = (email || "").toLowerCase().trim();
    let hash = 0;
    for (let i = 0; i < cleanEmail.length; i++) {
        hash = (hash << 5) - hash + cleanEmail.charCodeAt(i);
        hash |= 0;
    }
    const num = Math.abs(hash % 9000) + 1000;
    return `CTZ-TN-${distCode}-${num}`;
}

function ProfileContent() {
    const { user, login } = useAuth();
    const { lang, t } = useLang();
    const router = useRouter();
    const searchParams = useSearchParams();

    // Redirect to standalone /my-grievances if ?tab=grievances was visited
    useEffect(() => {
        if (searchParams?.get("tab") === "grievances") {
            router.replace("/my-grievances");
        }
    }, [searchParams, router]);

    const [profileData, setProfileData] = useState(() => {
        const initRole = user?.authorityRole || (user?.role === "authority" ? "Environment Protection Officer" : user?.role === "chief" ? "Chief Commissioner" : "Verified Citizen Resident");
        const initDept = user?.department || (user?.role === "authority" ? getDepartmentForRole(initRole) : user?.role === "chief" ? "Public Grievance Oversight" : "Civic Grievances");
        const initServiceId = user?.serviceId || (user?.role === "authority" ? "GOV-2026" : user?.role === "chief" ? "CHIEF-TN-01" : computeUniqueCitizenId(user?.email || "", user?.district || "Tiruchirappalli", user?.serviceId));

        return {
            username: user?.username || "",
            email: user?.email || "",
            role: user?.role || "user",
            state: user?.state || "Tamil Nadu",
            district: user?.district || "Tiruchirappalli",
            pincode: (user as any)?.pincode || (typeof window !== "undefined" ? localStorage.getItem("gs_user_pincode") || "620 001" : "620 001"),
            authorityRole: initRole,
            serviceId: initServiceId,
            workingPlace: user?.workingPlace || (user?.role === "authority" ? "Tiruchirappalli District Collectorate & Divisional Office" : user?.role === "chief" ? "State Secretariat, Chennai" : "Tiruchirappalli City Corporation"),
            phone: user?.phone || "+91 94432 00000",
            department: initDept,
        };
    });

    // Edit modal state
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({ ...profileData });
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Change password modal state
    const [showChangePwModal, setShowChangePwModal] = useState(false);
    const [pwForm, setPwForm] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
    const [showOldPw, setShowOldPw] = useState(false);
    const [showNewPw, setShowNewPw] = useState(false);
    const [showConfirmPw, setShowConfirmPw] = useState(false);
    const [pwLoading, setPwLoading] = useState(false);
    const [pwError, setPwError] = useState("");
    const [pwSuccess, setPwSuccess] = useState(false);

    // Retirement notice state
    const [dutyStatus, setDutyStatus] = useState<"active" | "pending" | "retired">("active");
    const [retirementNotice, setRetirementNotice] = useState<RetirementNotice | null>(null);
    const [showRetireModal, setShowRetireModal] = useState(false);
    const [retireReason, setRetireReason] = useState("Official Retirement (Full Service Completed)");
    const [retireDate, setRetireDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [retirePassword, setRetirePassword] = useState("");
    const [retireLoading, setRetireLoading] = useState(false);
    const [retireError, setRetireError] = useState("");
    const [retireSuccess, setRetireSuccess] = useState(false);

    const handleOpenRetireModal = () => {
        setRetireReason("Official Retirement (Full Service Completed)");
        setRetireDate(new Date().toISOString().slice(0, 10));
        setRetirePassword("");
        setRetireError("");
        setRetireSuccess(false);
        setShowRetireModal(true);
    };

    const handleRetirementSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setRetireError("");
        if (!retirePassword) {
            setRetireError(lang === "ta" ? "பாதுகாப்பு உறுதிப்படுத்தலுக்கான கடவுச்சொல்லை உள்ளிடவும்." : "Please enter your password for security authorization.");
            return;
        }

        setRetireLoading(true);
        try {
            const res = await submitRetirementNoticeServerAction({
                email: user?.email || "",
                password: retirePassword,
                reason: retireReason,
                effectiveDate: retireDate,
            });

            if (res.success && res.notice) {
                setRetireSuccess(true);
                setDutyStatus("pending");
                setRetirementNotice(res.notice);
                if (typeof window !== "undefined" && user?.email) {
                    localStorage.setItem(`gs_officer_duty_${user.email}`, "pending");
                    localStorage.setItem(`gs_retirement_notice_${user.email}`, JSON.stringify(res.notice));
                }
                setTimeout(() => {
                    setShowRetireModal(false);
                    setRetireSuccess(false);
                }, 1600);
            } else {
                setRetireError(res.error || "Failed to submit retirement notice.");
            }
        } catch {
            setRetireError("An unexpected error occurred. Please try again.");
        } finally {
            setRetireLoading(false);
        }
    };

    const handleOpenChangePw = () => {
        setPwForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
        setPwError("");
        setPwSuccess(false);
        setShowOldPw(false);
        setShowNewPw(false);
        setShowConfirmPw(false);
        setShowChangePwModal(true);
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPwError("");
        setPwSuccess(false);

        if (!pwForm.oldPassword) {
            setPwError(lang === "ta" ? "உங்கள் தற்போதைய கடவுச்சொல்லை உள்ளிடவும்." : "Please enter your current password.");
            return;
        }
        if (!pwForm.newPassword) {
            setPwError(lang === "ta" ? "புதிய கடவுச்சொல்லை உள்ளிடவும்." : "Please enter your new password.");
            return;
        }
        if (pwForm.newPassword.length < 8) {
            setPwError(t("profile_pw_min"));
            return;
        }
        if (pwForm.newPassword !== pwForm.confirmPassword) {
            setPwError(t("profile_pw_mismatch"));
            return;
        }
        if (pwForm.oldPassword === pwForm.newPassword) {
            setPwError(lang === "ta" ? "புதிய கடவுச்சொல் பழைய கடவுச்சொல்லிலிருந்து மாறுபட்டிருக்க வேண்டும்." : "New password must be different from current password.");
            return;
        }

        setPwLoading(true);
        try {
            const res = await changePasswordServerAction({
                oldPassword: pwForm.oldPassword,
                newPassword: pwForm.newPassword,
            });

            if (res.success) {
                setPwSuccess(true);
                setPwForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
                setTimeout(() => {
                    setShowChangePwModal(false);
                    setPwSuccess(false);
                }, 1800);
            } else {
                setPwError(res.error || (lang === "ta" ? "கடவுச்சொல்லை மாற்ற முடியவில்லை." : "Failed to change password."));
            }
        } catch (err: any) {
            setPwError(lang === "ta" ? "பிணையப் பிழை. மீண்டும் முயற்சிக்கவும்." : "Network error. Please try again.");
        } finally {
            setPwLoading(false);
        }
    };

    useEffect(() => {
        if (!user?.email) return;

        const currentRole = user.authorityRole || (user.role === "authority" ? "Environment Protection Officer" : user.role === "chief" ? "Chief Commissioner" : "Verified Citizen Resident");
        const currentDept = user.department || (user.role === "authority" ? getDepartmentForRole(currentRole) : user.role === "chief" ? "Public Grievance Oversight" : "Civic Grievances");
        const defaultServiceId = user.serviceId || (user.role === "authority" ? "GOV-2026" : user.role === "chief" ? "CHIEF-TN-01" : computeUniqueCitizenId(user.email, user.district || "Tiruchirappalli", user.serviceId));

        setProfileData({
            username: user.username || "",
            email: user.email || "",
            role: user.role,
            state: user.state || "Tamil Nadu",
            district: user.district || "Tiruchirappalli",
            pincode: (user as any).pincode || (typeof window !== "undefined" ? localStorage.getItem("gs_user_pincode") || "620 001" : "620 001"),
            authorityRole: currentRole,
            serviceId: defaultServiceId,
            workingPlace: user.workingPlace || (user.role === "authority" ? `${user.district || "Tiruchirappalli"} District Collectorate & Divisional Office` : user.role === "chief" ? "State Secretariat, Chennai" : `${user.district || "Tiruchirappalli"} City Corporation`),
            phone: user.phone || "+91 94432 00000",
            department: currentDept,
        });

        // Fetch live full profile from server action
        getFullUserProfileServerAction().then(res => {
            if (res.success && res.user) {
                const fetchedRole = res.user.authorityRole || currentRole;
                const fetchedDept = res.user.department || getDepartmentForRole(fetchedRole);
                const fetchedId = res.user.serviceId || (user.role === "user" ? computeUniqueCitizenId(res.user.email || user.email, res.user.district || user.district || "Tiruchirappalli", res.user.serviceId) : defaultServiceId);

                setProfileData(prev => ({
                    ...prev,
                    username: res.user.username || prev.username,
                    phone: res.user.phone || prev.phone,
                    state: res.user.state || prev.state,
                    district: res.user.district || prev.district,
                    pincode: (res.user as any).pincode || (typeof window !== "undefined" ? localStorage.getItem("gs_user_pincode") || "620 001" : prev.pincode),
                    authorityRole: fetchedRole,
                    serviceId: fetchedId,
                    workingPlace: res.user.workingPlace || prev.workingPlace,
                    department: fetchedDept,
                }));
            }
        });

        // Check officer duty & retirement status
        if (user.role === "authority") {
            if (typeof window !== "undefined" && user.email) {
                const cachedDuty = localStorage.getItem(`gs_officer_duty_${user.email}`) as "active" | "pending" | "retired" | null;
                if (cachedDuty) setDutyStatus(cachedDuty);
                const cachedNotice = localStorage.getItem(`gs_retirement_notice_${user.email}`);
                if (cachedNotice) {
                    try { setRetirementNotice(JSON.parse(cachedNotice)); } catch {}
                }
            }

            getOfficerDutyStatusServerAction(user.email).then(st => {
                if (st?.dutyStatus) {
                    setDutyStatus(st.dutyStatus);
                    if (typeof window !== "undefined" && user.email) {
                        localStorage.setItem(`gs_officer_duty_${user.email}`, st.dutyStatus);
                    }
                }
                if (st?.notice) setRetirementNotice(st.notice);
            });
        }
    }, [user?.email, user?.role, user?.district]);

    if (!user) return null;
    const cfg = ROLE_CONFIG[user.role] || ROLE_CONFIG.user;

    const handleOpenEdit = () => {
        setEditForm({ ...profileData });
        setShowEditModal(true);
        setSaveSuccess(false);
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const safePayload = {
                username: editForm.username,
                phone: editForm.phone,
                district: editForm.district,
                workingPlace: editForm.workingPlace,
            };
            if (typeof window !== "undefined" && editForm.pincode) {
                localStorage.setItem("gs_user_pincode", editForm.pincode);
            }
            const res = await updateUserProfileServerAction(safePayload);
            if (res.success && res.user) {
                setProfileData(prev => ({ ...prev, ...safePayload, pincode: editForm.pincode }));
                login({
                    ...user,
                    ...safePayload,
                    role: user.role,
                });
                setSaveSuccess(true);
                setTimeout(() => {
                    setShowEditModal(false);
                    setSaveSuccess(false);
                }, 1200);
            }
        } catch (err) {
            console.error("Save profile error:", err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <ProtectedRoute>
            <main style={{ minHeight: "100vh", padding: "2rem 1rem" }}>
                <div className="container" style={{ maxWidth: "780px", margin: "0 auto" }}>

                    {/* Top Row: Back button + Action Buttons */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
                        <Link
                            href={user.role === "user" ? "/" : user.role === "authority" ? "/admin" : "/chief"}
                            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.875rem", color: "var(--text-muted)", textDecoration: "none", fontWeight: "600" }}
                        >
                            {user.role === "authority" ? t("profile_back_authority") : user.role === "chief" ? t("profile_back_chief") : t("profile_back_citizen")}
                        </Link>

                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                            <button
                                onClick={handleOpenChangePw}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.4rem",
                                    padding: "0.45rem 1rem",
                                    borderRadius: "0.6rem",
                                    fontSize: "0.82rem",
                                    fontWeight: "700",
                                    background: "rgba(245, 158, 11, 0.12)",
                                    color: "#fbbf24",
                                    border: "1px solid rgba(245, 158, 11, 0.35)",
                                    boxShadow: "0 2px 10px rgba(245, 158, 11, 0.12)",
                                    cursor: "pointer",
                                    transition: "all 0.2s ease",
                                }}
                            >
                                <span>🔑</span>
                                <span>{t("profile_change_pw")}</span>
                            </button>

                            <button
                                onClick={handleOpenEdit}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.4rem",
                                    padding: "0.45rem 1rem",
                                    borderRadius: "0.6rem",
                                    fontSize: "0.82rem",
                                    fontWeight: "700",
                                    background: `${cfg.color}15`,
                                    color: cfg.color,
                                    border: `1px solid ${cfg.color}35`,
                                    cursor: "pointer",
                                    transition: "all 0.2s ease",
                                }}
                            >
                                <span>{t("profile_edit_btn")}</span>
                            </button>
                        </div>
                    </div>

                    {/* Dedicated Standalone Profile Card */}
                    <div className="glass animate-slide-up" style={{ borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-lg)", marginBottom: "1.5rem" }}>

                        {/* Banner */}
                        <div style={{ height: "130px", background: cfg.gradient, position: "relative" }}>
                            <div style={{ position: "absolute", inset: 0, background: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.06'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
                        </div>

                        {/* Avatar + Primary Identification */}
                        <div style={{ padding: "0 1.25rem 1.75rem", position: "relative" }}>
                            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
                                <div style={{
                                    width: "88px",
                                    height: "88px",
                                    minWidth: "88px",
                                    minHeight: "88px",
                                    maxWidth: "88px",
                                    maxHeight: "88px",
                                    aspectRatio: "1 / 1",
                                    flexShrink: 0,
                                    borderRadius: "50%",
                                    background: cfg.gradient,
                                    border: "4px solid var(--bg-card)",
                                    marginTop: "-44px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "1.75rem",
                                    fontWeight: "900",
                                    color: "white",
                                    boxShadow: `0 8px 24px ${cfg.color}44`,
                                    padding: 0,
                                    boxSizing: "border-box",
                                }}>
                                    {getInitials(profileData.username)}
                                </div>
                                <div style={{ display: "flex", gap: "0.4rem", paddingBottom: "0.2rem", flexWrap: "wrap" }}>
                                    <span style={{ padding: "0.3rem 0.75rem", borderRadius: "99px", background: `${cfg.color}18`, color: cfg.color, fontSize: "0.72rem", fontWeight: "800", border: `1px solid ${cfg.color}35`, display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                                        {cfg.icon} {t(cfg.labelKey)}
                                    </span>
                                    {user.role === "authority" && (
                                        <span style={{ padding: "0.3rem 0.75rem", borderRadius: "99px", background: "rgba(16,185,129,0.15)", color: "#10b981", fontSize: "0.72rem", fontWeight: "800", border: "1px solid rgba(16,185,129,0.3)" }}>
                                            {t("role_verified")}
                                        </span>
                                    )}
                                    {user.role === "user" && (
                                        <span style={{ padding: "0.3rem 0.75rem", borderRadius: "99px", background: "rgba(16,185,129,0.15)", color: "#10b981", fontSize: "0.72rem", fontWeight: "800", border: "1px solid rgba(16,185,129,0.3)" }}>
                                            🛡️ Verified Resident
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Name & Title */}
                            <div style={{ marginBottom: "0.35rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                                    <h1 style={{ fontWeight: "800", fontSize: "1.5rem", margin: 0 }}>
                                        {profileData.username || (user.role === "user" ? "Citizen" : "Authority Officer")}
                                    </h1>
                                    <button onClick={handleOpenEdit} title="Edit details" style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "0.9rem", color: "var(--text-muted)" }}>
                                        ✏️
                                    </button>
                                </div>
                                <div style={{ fontSize: "0.9rem", color: cfg.color, fontWeight: "700", marginTop: "0.2rem" }}>
                                    {user.role === "user" ? t("profile_resident_title") : profileData.authorityRole}
                                </div>
                            </div>

                            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "0 0 1.5rem" }}>
                                {profileData.email}
                            </p>

                            {/* Details Grid */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.85rem" }}>
                                {user.role === "authority" ? (
                                    <>
                                        <div style={{ padding: "0.85rem 1rem", borderRadius: "0.75rem", background: "var(--bg-main)", border: "1px solid var(--border)" }}>
                                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                                                {t("profile_role")}
                                            </div>
                                            <div style={{ fontSize: "0.88rem", fontWeight: "700", color: "var(--text-main)" }}>
                                                {profileData.authorityRole}
                                            </div>
                                        </div>

                                        <div style={{ padding: "0.85rem 1rem", borderRadius: "0.75rem", background: "var(--bg-main)", border: "1px solid var(--border)" }}>
                                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                                                {t("profile_location")}
                                            </div>
                                            <div style={{ fontSize: "0.88rem", fontWeight: "700", color: "#f97316" }}>
                                                {profileData.district}, {profileData.state}
                                            </div>
                                        </div>

                                        <div style={{ padding: "0.85rem 1rem", borderRadius: "0.75rem", background: "var(--bg-main)", border: "1px solid var(--border)" }}>
                                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                                                {t("profile_assigned_office")}
                                            </div>
                                            <div style={{ fontSize: "0.88rem", fontWeight: "700", color: "var(--text-main)" }}>
                                                {profileData.workingPlace}
                                            </div>
                                        </div>

                                        <div style={{ padding: "0.85rem 1rem", borderRadius: "0.75rem", background: "var(--bg-main)", border: "1px solid var(--border)" }}>
                                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                                                {t("profile_service_id")}
                                            </div>
                                            <div style={{ fontSize: "0.88rem", fontWeight: "700", fontFamily: "monospace", color: "#6366f1" }}>
                                                {profileData.serviceId}
                                            </div>
                                        </div>

                                        <div style={{ padding: "0.85rem 1rem", borderRadius: "0.75rem", background: "var(--bg-main)", border: "1px solid var(--border)" }}>
                                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                                                {t("profile_email")}
                                            </div>
                                            <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                {profileData.email}
                                            </div>
                                        </div>

                                        <div style={{ padding: "0.85rem 1rem", borderRadius: "0.75rem", background: "var(--bg-main)", border: "1px solid var(--border)" }}>
                                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                                                {t("profile_phone")}
                                            </div>
                                            <div style={{ fontSize: "0.88rem", fontWeight: "700", color: "var(--text-main)" }}>
                                                {profileData.phone}
                                            </div>
                                        </div>

                                        <div style={{ padding: "0.85rem 1rem", borderRadius: "0.75rem", background: "var(--bg-main)", border: "1px solid var(--border)" }}>
                                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                                                {t("profile_department")}
                                            </div>
                                            <div style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--text-main)" }}>
                                                {profileData.department}
                                            </div>
                                        </div>

                                        <div style={{ padding: "0.85rem 1rem", borderRadius: "0.75rem", background: "var(--bg-main)", border: "1px solid var(--border)" }}>
                                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                                                {t("profile_duty_status")}
                                            </div>
                                            <div style={{
                                                fontSize: "0.88rem",
                                                fontWeight: "700",
                                                color: dutyStatus === "retired" ? "#34d399" : dutyStatus === "pending" ? "#f59e0b" : "#10b981",
                                                display: "flex", alignItems: "center", gap: "0.35rem"
                                            }}>
                                                {dutyStatus === "retired"
                                                    ? (lang === "ta" ? "🎖️ பணி ஓய்வு பெற்றார்" : "🎖️ Honorably Retired")
                                                    : dutyStatus === "pending"
                                                    ? (lang === "ta" ? "⏳ கலெக்டர் ஒப்புதலுக்காக காத்திருக்கிறது" : "⏳ Retirement Pending Sanction")
                                                    : t("profile_duty_status_val")}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* 1. Official Role */}
                                        <div style={{ padding: "0.85rem 1rem", borderRadius: "0.75rem", background: "var(--bg-main)", border: "1px solid var(--border)" }}>
                                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                                                🎭 {t("profile_role")}
                                            </div>
                                            <div style={{ fontSize: "0.88rem", fontWeight: "700", color: cfg.color }}>
                                                {t("profile_citizen_role")}
                                            </div>
                                        </div>

                                        {/* 2. Residence Location */}
                                        <div style={{ padding: "0.85rem 1rem", borderRadius: "0.75rem", background: "var(--bg-main)", border: "1px solid var(--border)" }}>
                                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                                                📍 {t("profile_location")}
                                            </div>
                                            <div style={{ fontSize: "0.88rem", fontWeight: "700", color: "var(--text-main)" }}>
                                                {profileData.district}, {profileData.state}
                                            </div>
                                        </div>

                                        {/* 3. Registered Email (Locked) */}
                                        <div style={{ padding: "0.85rem 1rem", borderRadius: "0.75rem", background: "var(--bg-main)", border: "1px solid var(--border)" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                                                <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                                    📧 {t("profile_email")}
                                                </span>
                                                <span style={{ fontSize: "0.65rem", color: "#fbbf24", fontWeight: "700" }}>🔒 {lang === "ta" ? "சரிபார்க்கப்பட்டது" : "Verified"}</span>
                                            </div>
                                            <div style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                {profileData.email}
                                            </div>
                                        </div>

                                        {/* 4. Registered Contact Phone */}
                                        <div style={{ padding: "0.85rem 1rem", borderRadius: "0.75rem", background: "var(--bg-main)", border: "1px solid var(--border)" }}>
                                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                                                📞 {t("profile_phone")}
                                            </div>
                                            <div style={{ fontSize: "0.88rem", fontWeight: "700", color: "var(--text-main)" }}>
                                                {profileData.phone || "+91 94432 00000"}
                                            </div>
                                        </div>

                                        {/* 5. Residence State */}
                                        <div style={{ padding: "0.85rem 1rem", borderRadius: "0.75rem", background: "var(--bg-main)", border: "1px solid var(--border)" }}>
                                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                                                🗺️ {t("profile_state_label")}
                                            </div>
                                            <div style={{ fontSize: "0.88rem", fontWeight: "700", color: "var(--text-main)" }}>
                                                {lang === "ta" ? "தமிழ்நாடு" : (profileData.state || "Tamil Nadu")}
                                            </div>
                                        </div>

                                        {/* 6. Postal Pincode */}
                                        <div style={{ padding: "0.85rem 1rem", borderRadius: "0.75rem", background: "var(--bg-main)", border: "1px solid var(--border)" }}>
                                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                                                📮 {t("profile_pincode_label")}
                                            </div>
                                            <div style={{ fontSize: "0.88rem", fontWeight: "700", fontFamily: "monospace", color: "#6366f1" }}>
                                                {profileData.pincode || "620 001"}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* ── Official Retirement Action Bar (Authority Only) ── */}
                            {user.role === "authority" && (
                                <div style={{ marginTop: "1.25rem" }}>
                                    {dutyStatus === "active" && (
                                        <div style={{
                                            padding: "1rem 1.25rem",
                                            borderRadius: "0.85rem",
                                            background: "rgba(245, 158, 11, 0.05)",
                                            border: "1px dashed rgba(245, 158, 11, 0.3)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            flexWrap: "wrap",
                                            gap: "1rem"
                                        }}>
                                            <div>
                                                <div style={{ fontSize: "0.88rem", fontWeight: "700", color: "var(--text-main)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                                    📜 {lang === "ta" ? "அதிகாரி பணி ஓய்வு அறிவிப்பு" : "Official Retirement Notice"}
                                                </div>
                                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                                                    {lang === "ta"
                                                        ? "பணி ஓய்வு பெற திட்டமிடுகிறீர்களா? மாவட்ட ஆட்சியர் ஒப்புதலுக்கான அதிகாரப்பூர்வ அறிவிப்பைச் சமர்ப்பிக்கவும்."
                                                        : "Planning retirement or voluntary retirement? Submit an official notice for District Collector sanction."}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleOpenRetireModal}
                                                className="btn"
                                                style={{
                                                    padding: "0.55rem 1.15rem",
                                                    fontSize: "0.8rem",
                                                    fontWeight: "700",
                                                    borderRadius: "0.6rem",
                                                    background: "linear-gradient(135deg, #f59e0b, #d97706)",
                                                    color: "white",
                                                    border: "none",
                                                    cursor: "pointer",
                                                    boxShadow: "0 4px 14px rgba(245, 158, 11, 0.35)",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "0.4rem"
                                                }}
                                            >
                                                🏛️ {lang === "ta" ? "பணி ஓய்வு அறிவிக்கவும்" : "Announce Retirement / Relieve Duty"}
                                            </button>
                                        </div>
                                    )}

                                    {dutyStatus === "pending" && (
                                        <div style={{
                                            padding: "1.15rem 1.25rem",
                                            borderRadius: "0.85rem",
                                            background: "rgba(245, 158, 11, 0.08)",
                                            border: "1px solid rgba(245, 158, 11, 0.35)",
                                            display: "flex",
                                            alignItems: "flex-start",
                                            gap: "0.85rem"
                                        }}>
                                            <div style={{ fontSize: "1.6rem", flexShrink: 0 }}>⏳</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: "0.9rem", fontWeight: "700", color: "#f59e0b" }}>
                                                    {lang === "ta" ? "பணி ஓய்வு அறிவிப்பு சமர்ப்பிக்கப்பட்டது · ஆட்சியர் ஒப்புதலுக்காக காத்திருக்கிறது" : "Retirement Notice Under Review · Pending Collector Sanction"}
                                                </div>
                                                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.25rem", lineHeight: "1.4" }}>
                                                    {lang === "ta"
                                                        ? `அறிவிப்பு சமர்ப்பிக்கப்பட்டது: ${retirementNotice?.requestedAt ? new Date(retirementNotice.requestedAt).toLocaleDateString() : "இன்று"}. காரணம்: ${retirementNotice?.reason || "பணி ஓய்வு"}. மாவட்ட ஆட்சியரின் ஒப்புதலுக்குப் பிறகு வழக்குகள் மாற்றப்பட்டு கணக்கு விடுவிக்கப்படும்.`
                                                        : `Official notice submitted on ${retirementNotice?.requestedAt ? new Date(retirementNotice.requestedAt).toLocaleDateString("en-IN") : "today"} (Reason: ${retirementNotice?.reason || "Official Retirement"}). Active complaints will be reassigned upon executive sanction.`}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {dutyStatus === "retired" && (
                                        <div style={{
                                            padding: "1.15rem 1.25rem",
                                            borderRadius: "0.85rem",
                                            background: "linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(245, 158, 11, 0.08))",
                                            border: "1px solid rgba(16, 185, 129, 0.35)",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "1rem"
                                        }}>
                                            <div style={{ fontSize: "2.2rem", flexShrink: 0 }}>🎖️</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: "0.95rem", fontWeight: "800", color: "#10b981", letterSpacing: "0.02em" }}>
                                                    {lang === "ta" ? "பணி ஓய்வு பதிவு காப்பகப்படுத்தப்பட்டது · கௌரவ ஓய்வு பெற்றார்" : "Public Service Record Archived · Honorably Retired"}
                                                </div>
                                                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.25rem", lineHeight: "1.4" }}>
                                                    {lang === "ta"
                                                        ? `மாவட்ட ஆட்சியர் ஒப்புதலுடன் பணியிலிருந்து விடுவிக்கப்பட்டார். அரசு மற்றும் பொதுமக்களுக்கு ஆற்றிய சிறப்பான சேவைக்கு நன்றி.`
                                                        : `Officially relieved of active field duties under District Collectorate executive sanction. Thank you for your distinguished public service to the citizens of Tamil Nadu.`}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Announce Retirement Modal ── */}
                {showRetireModal && (
                    <div style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.75)",
                        backdropFilter: "blur(6px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 9999,
                        padding: "1rem"
                    }} onClick={() => setShowRetireModal(false)}>
                        <div
                            className="glass animate-slide-up"
                            style={{
                                width: "100%",
                                maxWidth: "500px",
                                borderRadius: "1.25rem",
                                padding: "1.75rem",
                                border: "1px solid rgba(245, 158, 11, 0.3)",
                                background: "var(--bg-card, #0f172a)",
                                boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
                                <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "linear-gradient(135deg, #f59e0b, #d97706)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.35rem" }}>
                                    🏛️
                                </div>
                                <div>
                                    <div style={{ fontWeight: "800", fontSize: "1.05rem", color: "var(--text-main)" }}>
                                        {lang === "ta" ? "பணி ஓய்வு & கடமை விடுவிப்பு அறிவிப்பு" : "Officer Retirement Notice"}
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                        {lang === "ta" ? "மாவட்ட ஆட்சியர் ஒப்புதலுக்கான அதிகாரப்பூர்வ மனு" : "Official dossier submission to District Collectorate"}
                                    </div>
                                </div>
                            </div>

                            {retireError && (
                                <div style={{ padding: "0.7rem 0.9rem", borderRadius: "0.6rem", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: "0.8rem", marginBottom: "1rem" }}>
                                    ⚠️ {retireError}
                                </div>
                            )}

                            {retireSuccess ? (
                                <div style={{ padding: "1.5rem", textAlign: "center", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "0.85rem" }}>
                                    <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>✅</div>
                                    <div style={{ fontWeight: "700", color: "#10b981", fontSize: "1rem" }}>
                                        {lang === "ta" ? "அறிவிப்பு வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது!" : "Retirement Notice Forwarded!"}
                                    </div>
                                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.4rem" }}>
                                        {lang === "ta" ? "மாவட்ட ஆட்சியர் ஒப்புதலுக்காக காத்திருக்கிறது." : "Dossier dispatched to District Collector for executive sanction."}
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={handleRetirementSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                    {/* Summary Card */}
                                    <div style={{ padding: "0.85rem 1rem", borderRadius: "0.75rem", background: "var(--bg-main)", border: "1px solid var(--border)" }}>
                                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>
                                            OFFICER DOSSIER SUMMARY
                                        </div>
                                        <div style={{ fontSize: "0.9rem", fontWeight: "700", color: "var(--text-main)", marginTop: "0.2rem" }}>
                                            {profileData.username} ({profileData.serviceId})
                                        </div>
                                        <div style={{ fontSize: "0.78rem", color: "#f97316", marginTop: "0.15rem" }}>
                                            {profileData.authorityRole} · {profileData.department}
                                        </div>
                                    </div>

                                    {/* Effective Date */}
                                    <div>
                                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.35rem", textTransform: "uppercase" }}>
                                            📅 Effective Retirement Date
                                        </label>
                                        <input
                                            type="date"
                                            value={retireDate}
                                            onChange={e => setRetireDate(e.target.value)}
                                            required
                                            style={{
                                                width: "100%", padding: "0.65rem 0.85rem", borderRadius: "0.6rem",
                                                background: "var(--bg-main)", border: "1px solid var(--border)",
                                                color: "var(--text-main)", fontSize: "0.85rem"
                                            }}
                                        />
                                    </div>

                                    {/* Formal Reason */}
                                    <div>
                                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.35rem", textTransform: "uppercase" }}>
                                            📋 Retirement Grounds / Reason
                                        </label>
                                        <select
                                            value={retireReason}
                                            onChange={e => setRetireReason(e.target.value)}
                                            style={{
                                                width: "100%", padding: "0.65rem 0.85rem", borderRadius: "0.6rem",
                                                background: "var(--bg-main)", border: "1px solid var(--border)",
                                                color: "var(--text-main)", fontSize: "0.85rem"
                                            }}
                                        >
                                            <option value="Official Retirement (Full Service Completed)">Official Retirement (Age Limit / Full Service)</option>
                                            <option value="Voluntary Retirement Scheme (VRS)">Voluntary Retirement Scheme (VRS)</option>
                                            <option value="Medical Relief / Health Grounds">Medical Relief / Health Grounds</option>
                                            <option value="Administrative Transfer / Resignation">Administrative Transfer / Handover</option>
                                        </select>
                                    </div>

                                    {/* Security Password Confirmation */}
                                    <div>
                                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.35rem", textTransform: "uppercase" }}>
                                            🔐 Officer Password (Security Authorization)
                                        </label>
                                        <input
                                            type="password"
                                            placeholder="Enter your login password to authorize"
                                            value={retirePassword}
                                            onChange={e => setRetirePassword(e.target.value)}
                                            required
                                            style={{
                                                width: "100%", padding: "0.65rem 0.85rem", borderRadius: "0.6rem",
                                                background: "var(--bg-main)", border: "1px solid var(--border)",
                                                color: "var(--text-main)", fontSize: "0.85rem"
                                            }}
                                        />
                                    </div>

                                    {/* Official Warning Note */}
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: "1.4", background: "rgba(245, 158, 11, 0.05)", padding: "0.65rem 0.85rem", borderRadius: "0.6rem", border: "1px solid rgba(245, 158, 11, 0.2)" }}>
                                        ⚠️ <strong>Official Protocol:</strong> Upon submission, notice is logged to the District Collector's executive dashboard. You will remain on duty until the Collector officially sanctions retirement and transfers active cases.
                                    </div>

                                    <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                                        <button
                                            type="button"
                                            onClick={() => setShowRetireModal(false)}
                                            className="btn btn-secondary"
                                            style={{ flex: 1 }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={retireLoading}
                                            className="btn btn-primary"
                                            style={{ flex: 1.5, background: "linear-gradient(135deg, #f59e0b, #d97706)", border: "none" }}
                                        >
                                            {retireLoading ? "Submitting Notice..." : "Submit Notice ➔"}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Edit Profile Modal ── */}
                {showEditModal && (
                    <div style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.75)",
                        backdropFilter: "blur(6px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 9999,
                        padding: "1rem"
                    }} onClick={() => setShowEditModal(false)}>
                        <div
                            className="glass animate-slide-up"
                            style={{
                                width: "100%",
                                maxWidth: "520px",
                                maxHeight: "90vh",
                                overflowY: "auto",
                                borderRadius: "1.25rem",
                                padding: "2rem",
                                border: "1px solid var(--border)",
                                boxShadow: "var(--shadow-xl)",
                                background: "var(--bg-card)"
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                                <div>
                                    <h2 style={{ fontSize: "1.25rem", fontWeight: "800", margin: 0 }}>{t("profile_modal_title")}</h2>
                                    <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: "0.25rem 0 0" }}>
                                        {lang === "ta" ? "உங்கள் அதிகாரப்பூர்வ விவரங்கள், நியமிக்கப்பட்ட மாவட்டம் மற்றும் தொடர்பு தகவல்களைப் புதுப்பிக்கவும்." : "Update your official details, assigned district, and contact information."}
                                    </p>
                                </div>
                                <button onClick={() => setShowEditModal(false)} style={{ background: "transparent", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "var(--text-muted)" }}>✕</button>
                            </div>

                            {saveSuccess && (
                                <div style={{ padding: "0.75rem 1rem", borderRadius: "0.5rem", background: "rgba(16,185,129,0.15)", color: "#10b981", fontSize: "0.85rem", fontWeight: "700", marginBottom: "1rem", textAlign: "center" }}>
                                    {t("profile_success")}
                                </div>
                            )}

                            <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                <div>
                                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.3rem" }}>
                                        {t("profile_fullname")}
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={editForm.username}
                                        onChange={e => setEditForm({ ...editForm, username: e.target.value })}
                                        style={{ width: "100%", padding: "0.7rem 0.85rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--bg-main)", color: "var(--text-main)", fontSize: "0.9rem" }}
                                    />
                                </div>

                                {user.role === "authority" && (
                                    <>
                                        <div>
                                            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.3rem" }}>
                                                <span>{t("profile_role")}</span>
                                                <span style={{ fontSize: "0.68rem", color: "#fbbf24" }}>🔒 {lang === "ta" ? "சரிபார்க்கப்பட்டது" : "Verified & Locked"}</span>
                                            </label>
                                            <input
                                                type="text"
                                                disabled
                                                value={editForm.authorityRole}
                                                style={{ width: "100%", padding: "0.7rem 0.85rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-muted)", fontSize: "0.9rem", cursor: "not-allowed", opacity: 0.8 }}
                                            />
                                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.35rem" }}>
                                                {t("profile_department")}: <strong style={{ color: "#34d399" }}>{getDepartmentForRole(editForm.authorityRole)}</strong>
                                            </div>
                                        </div>

                                        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "0.75rem" }}>
                                            <div>
                                                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.3rem" }}>
                                                    <span>{t("profile_location")}</span>
                                                    <span style={{ fontSize: "0.68rem", color: "#fbbf24" }}>🔒</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    disabled
                                                    value={editForm.district}
                                                    style={{ width: "100%", padding: "0.7rem 0.85rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-muted)", fontSize: "0.9rem", cursor: "not-allowed", opacity: 0.8 }}
                                                />
                                            </div>

                                            <div>
                                                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.3rem" }}>
                                                    {lang === "ta" ? "🗺️ மாநிலம்" : "🗺️ State"}
                                                </label>
                                                <input
                                                    type="text"
                                                    disabled
                                                    value={editForm.state || (lang === "ta" ? "தமிழ்நாடு" : "Tamil Nadu")}
                                                    style={{ width: "100%", padding: "0.7rem 0.85rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-muted)", fontSize: "0.9rem", cursor: "not-allowed", opacity: 0.8 }}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.3rem" }}>
                                                {t("profile_workplace_label")}
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={editForm.workingPlace}
                                                onChange={e => setEditForm({ ...editForm, workingPlace: e.target.value })}
                                                placeholder="e.g. Tiruchirappalli Municipal Administration Office"
                                                style={{ width: "100%", padding: "0.7rem 0.85rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--bg-main)", color: "var(--text-main)", fontSize: "0.9rem" }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.3rem" }}>
                                                <span>{t("profile_service_id")}</span>
                                                <span style={{ fontSize: "0.68rem", color: "#fbbf24" }}>🔒 {lang === "ta" ? "சரிபார்க்கப்பட்டது" : "Verified & Locked"}</span>
                                            </label>
                                            <input
                                                type="text"
                                                disabled
                                                value={editForm.serviceId}
                                                style={{ width: "100%", padding: "0.7rem 0.85rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-muted)", fontSize: "0.9rem", cursor: "not-allowed", opacity: 0.8 }}
                                            />
                                        </div>
                                    </>
                                )}

                                {user.role === "user" && (
                                    <>
                                        {/* 1. Location / District - Full width, clean single-line label and dropdown */}
                                        <div>
                                            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.3rem" }}>
                                                📍 {t("profile_location")}
                                            </label>
                                            <select
                                                value={editForm.district}
                                                onChange={e => setEditForm({ ...editForm, district: e.target.value, workingPlace: `${e.target.value} City Corporation` })}
                                                style={{ width: "100%", padding: "0.7rem 0.85rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--bg-main)", color: "var(--text-main)", fontSize: "0.9rem" }}
                                            >
                                                {TAMIL_NADU_DISTRICTS.map(d => (
                                                    <option key={d} value={d} style={{ background: "var(--bg-card)", color: "var(--text-main)" }}>
                                                        {d}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* 2. State & Pincode - Perfect 50/50 alignment, full room for "Tamil Nadu", zero truncation */}
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                                            <div>
                                                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.3rem" }}>
                                                    {lang === "ta" ? "🗺️ மாநிலம்" : "🗺️ State"}
                                                </label>
                                                <input
                                                    type="text"
                                                    disabled
                                                    value={editForm.state || (lang === "ta" ? "தமிழ்நாடு" : "Tamil Nadu")}
                                                    style={{ width: "100%", padding: "0.7rem 0.85rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-muted)", fontSize: "0.9rem", cursor: "not-allowed", opacity: 0.8 }}
                                                />
                                            </div>

                                            <div>
                                                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.3rem" }}>
                                                    📮 {t("profile_pincode_label")}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={editForm.pincode || ""}
                                                    onChange={e => setEditForm({ ...editForm, pincode: e.target.value.replace(/[^0-9\s]/g, "").slice(0, 7) })}
                                                    placeholder="620 001"
                                                    maxLength={7}
                                                    style={{ width: "100%", padding: "0.7rem 0.85rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--bg-main)", color: "var(--text-main)", fontSize: "0.9rem" }}
                                                />
                                            </div>
                                        </div>

                                        {/* 3. Email (Locked) + Change Password Button */}
                                        <div>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                                                <label style={{ fontSize: "0.78rem", fontWeight: "700", color: "var(--text-muted)", margin: 0 }}>
                                                    <span>📧 {t("profile_email")}</span>
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowEditModal(false);
                                                        handleOpenChangePw();
                                                    }}
                                                    style={{
                                                        background: "rgba(245, 158, 11, 0.12)",
                                                        border: "1px solid rgba(245, 158, 11, 0.35)",
                                                        borderRadius: "0.4rem",
                                                        color: "#fbbf24",
                                                        fontSize: "0.72rem",
                                                        fontWeight: "700",
                                                        cursor: "pointer",
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        gap: "0.25rem",
                                                        padding: "0.2rem 0.55rem",
                                                    }}
                                                >
                                                    🔑 {t("profile_change_pw")}
                                                </button>
                                            </div>
                                            <input
                                                type="text"
                                                disabled
                                                value={editForm.email}
                                                style={{ width: "100%", padding: "0.7rem 0.85rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-muted)", fontSize: "0.9rem", cursor: "not-allowed", opacity: 0.8 }}
                                            />
                                        </div>
                                    </>
                                )}

                                <div>
                                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.3rem" }}>
                                        {t("profile_phone_label")}
                                    </label>
                                    <input
                                        type="tel"
                                        value={editForm.phone}
                                        onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                                        placeholder="e.g. +91 98401 23456"
                                        style={{ width: "100%", padding: "0.7rem 0.85rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--bg-main)", color: "var(--text-main)", fontSize: "0.9rem" }}
                                    />
                                </div>

                                <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowEditModal(false)}
                                        style={{ flex: 1, padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontWeight: "700", cursor: "pointer" }}
                                    >
                                        {t("profile_cancel")}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        style={{ flex: 1.5, padding: "0.75rem", borderRadius: "0.5rem", border: "none", background: "linear-gradient(135deg, #f97316, #fb923c)", color: "white", fontWeight: "800", cursor: isSaving ? "wait" : "pointer" }}
                                    >
                                        {isSaving ? t("profile_saving") : t("profile_save")}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── Change Password Modal ── */}
                {showChangePwModal && (
                    <div style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.75)",
                        backdropFilter: "blur(6px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 9999,
                        padding: "1rem"
                    }} onClick={() => setShowChangePwModal(false)}>
                        <div
                            className="glass animate-slide-up"
                            style={{
                                width: "100%",
                                maxWidth: "460px",
                                maxHeight: "90vh",
                                overflowY: "auto",
                                borderRadius: "1.25rem",
                                padding: "2rem",
                                border: "1px solid var(--border)",
                                boxShadow: "var(--shadow-xl)",
                                background: "var(--bg-card)"
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <span style={{ fontSize: "1.3rem" }}>🔑</span>
                                    <h2 style={{ fontSize: "1.2rem", fontWeight: "800", margin: 0 }}>
                                        {t("profile_change_pw")}
                                    </h2>
                                </div>
                                <button
                                    onClick={() => setShowChangePwModal(false)}
                                    style={{ background: "transparent", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "var(--text-muted)" }}
                                >
                                    ✕
                                </button>
                            </div>
                            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "1.25rem" }}>
                                {t("profile_change_pw_desc")}
                            </p>

                            {pwSuccess && (
                                <div style={{ padding: "0.85rem 1rem", borderRadius: "0.6rem", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", fontSize: "0.85rem", fontWeight: "700", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <span>✅</span>
                                    <span>{t("profile_pw_success")}</span>
                                </div>
                            )}

                            {pwError && (
                                <div style={{ padding: "0.85rem 1rem", borderRadius: "0.6rem", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: "0.85rem", fontWeight: "700", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <span>⚠️</span>
                                    <span>{pwError}</span>
                                </div>
                            )}

                            <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                {/* Current / Old Password */}
                                <div>
                                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.3rem" }}>
                                        🔒 {t("profile_old_pw")}
                                    </label>
                                    <div style={{ position: "relative" }}>
                                        <input
                                            type={showOldPw ? "text" : "password"}
                                            required
                                            value={pwForm.oldPassword}
                                            onChange={e => setPwForm({ ...pwForm, oldPassword: e.target.value })}
                                            placeholder="••••••••"
                                            style={{ width: "100%", padding: "0.7rem 2.5rem 0.7rem 0.85rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--bg-main)", color: "var(--text-main)", fontSize: "0.9rem" }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowOldPw(!showOldPw)}
                                            style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.9rem" }}
                                        >
                                            {showOldPw ? "👁️" : "🙈"}
                                        </button>
                                    </div>
                                </div>

                                {/* New Password */}
                                <div>
                                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.3rem" }}>
                                        ✨ {t("profile_new_pw")}
                                    </label>
                                    <div style={{ position: "relative" }}>
                                        <input
                                            type={showNewPw ? "text" : "password"}
                                            required
                                            value={pwForm.newPassword}
                                            onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })}
                                            placeholder={lang === "ta" ? "குறைந்தது 8 எழுத்துக்கள்" : "At least 8 characters"}
                                            style={{ width: "100%", padding: "0.7rem 2.5rem 0.7rem 0.85rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--bg-main)", color: "var(--text-main)", fontSize: "0.9rem" }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPw(!showNewPw)}
                                            style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.9rem" }}
                                        >
                                            {showNewPw ? "👁️" : "🙈"}
                                        </button>
                                    </div>
                                </div>

                                {/* Confirm New Password */}
                                <div>
                                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.3rem" }}>
                                        🛡️ {t("profile_confirm_pw")}
                                    </label>
                                    <div style={{ position: "relative" }}>
                                        <input
                                            type={showConfirmPw ? "text" : "password"}
                                            required
                                            value={pwForm.confirmPassword}
                                            onChange={e => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                                            placeholder="••••••••"
                                            style={{ width: "100%", padding: "0.7rem 2.5rem 0.7rem 0.85rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--bg-main)", color: "var(--text-main)", fontSize: "0.9rem" }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPw(!showConfirmPw)}
                                            style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.9rem" }}
                                        >
                                            {showConfirmPw ? "👁️" : "🙈"}
                                        </button>
                                    </div>
                                </div>

                                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem" }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowChangePwModal(false)}
                                        style={{ flex: 1, padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontWeight: "700", cursor: "pointer" }}
                                    >
                                        {t("profile_cancel")}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={pwLoading}
                                        style={{ flex: 1.5, padding: "0.75rem", borderRadius: "0.5rem", border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", fontWeight: "800", cursor: pwLoading ? "wait" : "pointer" }}
                                    >
                                        {pwLoading ? (lang === "ta" ? "புதுப்பிக்கப்படுகிறது..." : "Updating...") : t("profile_update_pw")}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </ProtectedRoute>
    );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={
            <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ fontSize: "1.5rem" }}>⏳</div>
            </main>
        }>
            <ProfileContent />
        </Suspense>
    );
}
