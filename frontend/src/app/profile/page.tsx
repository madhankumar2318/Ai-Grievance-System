"use client";

import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getFullUserProfileServerAction, updateUserProfileServerAction } from "@/app/actions/authActions";
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

                    {/* Top Row: Back button + Edit Action */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                        <Link
                            href={user.role === "user" ? "/" : user.role === "authority" ? "/admin" : "/chief"}
                            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.875rem", color: "var(--text-muted)", textDecoration: "none", fontWeight: "600" }}
                        >
                            {user.role === "authority" ? t("profile_back_authority") : user.role === "chief" ? t("profile_back_chief") : t("profile_back_citizen")}
                        </Link>

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
                                            <div style={{ fontSize: "0.88rem", fontWeight: "700", color: "#10b981" }}>
                                                {t("profile_duty_status_val")}
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
                        </div>
                    </div>
                </div>

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
                                        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "0.75rem" }}>
                                            <div>
                                                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.3rem" }}>
                                                    <span>📍 {t("profile_location")}</span>
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
                                            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.3rem" }}>
                                                <span>📧 {t("profile_email")}</span>
                                                <span style={{ fontSize: "0.68rem", color: "#fbbf24" }}>🔒 {lang === "ta" ? "சரிபார்க்கப்பட்டது & பூட்டப்பட்டது" : "Verified & Locked"}</span>
                                            </label>
                                            <input
                                                type="text"
                                                disabled
                                                value={editForm.email}
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
