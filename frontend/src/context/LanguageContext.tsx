"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

export type Language = "en" | "ta";

export const LANGUAGE_NAMES: Record<Language, string> = {
    en: "English",
    ta: "தமிழ்",
};

export type TranslationKey =
    | "nav_home" | "nav_track" | "nav_admin" | "nav_chief" | "nav_login" | "nav_logout"
    | "home_title" | "home_subtitle" | "home_form_title"
    | "form_subject" | "form_subject_placeholder"
    | "form_description" | "form_description_placeholder"
    | "form_location" | "form_location_placeholder"
    | "form_submit" | "form_submitting"
    | "form_voice_start" | "form_voice_stop" | "form_voice_listening"
    | "form_photo_analyze" | "form_photo_analyzing"
    | "track_title" | "track_subtitle" | "track_placeholder" | "track_btn"
    | "track_not_found" | "track_not_found_desc" | "track_timeline"
    | "track_progress" | "track_submit_another" | "track_priority"
    | "chat_placeholder" | "chat_title" | "chat_greeting"
    | "map_title" | "map_subtitle"
    | "feature_triage_title" | "feature_triage_desc"
    | "feature_priority_title" | "feature_priority_desc"
    | "feature_gps_title" | "feature_gps_desc"
    | "success_registered" | "success_tracking_id" | "success_category"
    | "btn_track_status" | "btn_new_complaint" | "btn_file_complaint"
    | "notif_title" | "notif_enable" | "notif_enabled"
    | "admin_title" | "admin_subtitle" | "admin_active_officers"
    | "admin_total" | "admin_pending" | "admin_in_progress" | "admin_resolved"
    | "admin_col_id" | "admin_col_subject" | "admin_col_citizen" | "admin_col_priority"
    | "admin_col_status" | "admin_col_attachments" | "admin_col_actions"
    | "admin_resolve" | "admin_done"
    | "login_welcome" | "login_select_role" | "login_email" | "login_password"
    | "login_signing_in" | "login_sign_in_as" | "login_error_role" | "login_error_creds"
    | "login_citizen_label" | "login_citizen_desc"
    | "login_authority_label" | "login_authority_desc"
    | "login_chief_label" | "login_chief_desc"
    | "chief_title" | "chief_subtitle" | "chief_export_pdf"
    | "chief_total" | "chief_pending" | "chief_in_progress" | "chief_resolved" | "chief_critical"
    | "chief_category_breakdown" | "chief_authority_status"
    | "chief_all_grievances" | "chief_complaints_total"
    | "chief_col_id" | "chief_col_subject" | "chief_col_citizen" | "chief_col_location"
    | "chief_col_priority" | "chief_col_status" | "chief_col_date"
    | "chief_active" | "chief_busy" | "chief_available" | "chief_active_cases"
    | "status_pending" | "status_in_progress" | "status_resolved"
    | "priority_critical" | "priority_high" | "priority_medium" | "priority_low";

type Translations = Record<TranslationKey, string>;

const translations: Record<Language, Translations> = {
    en: {
        nav_home: "File Complaint",
        nav_track: "Track",
        nav_admin: "Admin",
        nav_chief: "Chief",
        nav_login: "Login",
        nav_logout: "Logout",
        home_title: "Voice Your Concerns, Empowered by AI",
        home_subtitle: "Our AI-driven system ensures your complaints are heard, categorized, and prioritized with precision.",
        home_form_title: "File a Grievance",
        form_subject: "Subject",
        form_subject_placeholder: "What is this regarding?",
        form_description: "Detailed Description",
        form_description_placeholder: "Explain the issue in detail...",
        form_location: "📍 Location & Photo Evidence",
        form_location_placeholder: "City, District, or Landmark",
        form_submit: "Submit Grievance",
        form_submitting: "Processing with AI…",
        form_voice_start: "🎙️ Voice Input",
        form_voice_stop: "⏹️ Stop Recording",
        form_voice_listening: "🔴 Listening...",
        form_photo_analyze: "🔍 AI Analyze Photo",
        form_photo_analyzing: "⏳ Analyzing...",
        track_title: "Track Your Grievance",
        track_subtitle: "Enter your Tracking ID to view the real-time status and progress of your complaint.",
        track_placeholder: "e.g. GRV-49033",
        track_btn: "Track →",
        track_not_found: "Complaint Not Found",
        track_timeline: "📅 Complaint Timeline",
        chat_placeholder: "Ask anything about filing a complaint...",
        chat_title: "AI Assistant",
        chat_greeting: "👋 Hi! I'm your AI grievance assistant. How can I help you today? Try asking:\n• How do I file a water complaint?\n• What is my complaint status?\n• How long does resolution take?",
        map_title: "🗺️ Live Complaint Map",
        map_subtitle: "View all active complaints across the city in real time.",
        feature_triage_title: "Instant Triage",
        feature_triage_desc: "AI analyzes your text to identify the right department and urgency level automatically.",
        feature_priority_title: "Fair Prioritization",
        feature_priority_desc: "Critical issues like health and safety are flagged instantly for immediate action.",
        feature_gps_title: "GPS Photo Evidence",
        feature_gps_desc: "Capture photos stamped with GPS coordinates and timestamp — undeniable evidence.",
        success_registered: "Complaint Registered",
        success_tracking_id: "Tracking ID:",
        success_category: "Category:",
        btn_track_status: "🔍 Track Status",
        btn_new_complaint: "+ New Complaint",
        btn_file_complaint: "File a New Complaint",
        notif_title: "Status Update",
        notif_enable: "🔔 Enable Notifications",
        notif_enabled: "🔔 Notifications On",
        track_not_found_desc: "No complaint found for this ID. Please double-check your Tracking ID.",
        track_progress: "Resolution Progress",
        track_submit_another: "Submit Another Complaint",
        track_priority: "Priority",
        admin_title: "Admin Command Center",
        admin_subtitle: "Overseeing AI-Triaged Grievances & Resolution Workflows",
        admin_active_officers: "🟢 4 Active Officers",
        admin_total: "Total",
        admin_pending: "Pending",
        admin_in_progress: "In Progress",
        admin_resolved: "Resolved",
        admin_col_id: "ID",
        admin_col_subject: "Subject & Category",
        admin_col_citizen: "Citizen",
        admin_col_priority: "Priority",
        admin_col_status: "Status",
        admin_col_attachments: "Attachments",
        admin_col_actions: "Actions",
        admin_resolve: "✓ Resolve",
        admin_done: "✓ Done",
        login_welcome: "Welcome to",
        login_select_role: "Select your role to continue",
        login_email: "Email",
        login_password: "Password",
        login_signing_in: "Signing in...",
        login_sign_in_as: "Sign in as",
        login_error_role: "Please select a role first.",
        login_error_creds: "Invalid credentials. Check the hint below each role card.",
        login_citizen_label: "Citizen User",
        login_citizen_desc: "File & track your grievances",
        login_authority_label: "Authority Officer",
        login_authority_desc: "Manage & resolve complaints",
        login_chief_label: "Chief Admin",
        login_chief_desc: "System-wide oversight & analytics",
        chief_title: "Chief Command Center",
        chief_subtitle: "System-wide analytics, grievance oversight, and authority management",
        chief_export_pdf: "📄 Export PDF Report",
        chief_total: "Total Grievances",
        chief_pending: "Pending",
        chief_in_progress: "In Progress",
        chief_resolved: "Resolved",
        chief_critical: "Critical",
        chief_category_breakdown: "📊 Category Breakdown",
        chief_authority_status: "🏗️ Authority Status",
        chief_all_grievances: "🗂️ All System Grievances",
        chief_complaints_total: "complaints total",
        chief_col_id: "ID",
        chief_col_subject: "Subject & Category",
        chief_col_citizen: "Citizen",
        chief_col_location: "Location",
        chief_col_priority: "Priority",
        chief_col_status: "Status",
        chief_col_date: "Date",
        chief_active: "Active",
        chief_busy: "Busy",
        chief_available: "Available",
        chief_active_cases: "active",
        status_pending: "Pending",
        status_in_progress: "In Progress",
        status_resolved: "Resolved",
        priority_critical: "Critical",
        priority_high: "High",
        priority_medium: "Medium",
        priority_low: "Low",
    },
    ta: {
        nav_home: "புகார் பதிவு",
        nav_track: "கண்காணி",
        nav_admin: "நிர்வாகி",
        nav_chief: "தலைமை",
        nav_login: "உள்நுழை",
        nav_logout: "வெளியேறு",
        home_title: "உங்கள் குரலை எழுப்புங்கள், AI ஆற்றலுடன்",
        home_subtitle: "எங்கள் AI அமைப்பு உங்கள் புகார்களை கேட்டு, வகைப்படுத்தி, முன்னுரிமை அளிக்கிறது.",
        home_form_title: "புகார் தாக்கல் செய்யுங்கள்",
        form_subject: "தலைப்பு",
        form_subject_placeholder: "இது எதைப் பற்றியது?",
        form_description: "விரிவான விவரம்",
        form_description_placeholder: "பிரச்சினையை விரிவாக விளக்குங்கள்...",
        form_location: "📍 இடம் மற்றும் புகைப்பட சான்று",
        form_location_placeholder: "நகரம், மாவட்டம் அல்லது இடம்",
        form_submit: "புகாரை சமர்ப்பிக்க",
        form_submitting: "AI செயல்படுகிறது…",
        form_voice_start: "🎙️ குரல் உள்ளீடு",
        form_voice_stop: "⏹️ பதிவை நிறுத்து",
        form_voice_listening: "🔴 கேட்கிறது...",
        form_photo_analyze: "🔍 AI புகைப்பட பகுப்பாய்வு",
        form_photo_analyzing: "⏳ பகுப்பாய்வு செய்கிறது...",
        track_title: "உங்கள் புகாரை கண்காணிக்கவும்",
        track_subtitle: "உங்கள் புகாரின் நிலையை பார்க்க கண்காணிப்பு ID ஐ உள்ளிடுங்கள்.",
        track_placeholder: "எ.கா. GRV-49033",
        track_btn: "கண்காணி →",
        track_not_found: "புகார் கிடைக்கவில்லை",
        track_timeline: "📅 புகார் காலவரிசை",
        chat_placeholder: "புகார் பதிவு பற்றி எதையும் கேளுங்கள்...",
        chat_title: "AI உதவியாளர்",
        chat_greeting: "👋 வணக்கம்! நான் உங்கள் AI புகார் உதவியாளர். இன்று நான் உங்களுக்கு எவ்வாறு உதவ முடியும்?",
        map_title: "🗺️ நேரடி புகார் வரைபடம்",
        map_subtitle: "நகரம் முழுவதும் உள்ள சுறுசுறுப்பான புகார்களை நேரடியாக பார்க்கவும்.",
        feature_triage_title: "உடனடி வகைப்பாடு",
        feature_triage_desc: "AI உங்கள் உரையை பகுப்பாய்வு செய்து சரியான துறை மற்றும் அவசரநிலையை தீர்மானிக்கிறது.",
        feature_priority_title: "நியாயமான முன்னுரிமை",
        feature_priority_desc: "சுகாதாரம் மற்றும் பாதுகாப்பு போன்ற முக்கியமான சிக்கல்கள் உடனடியாக கொடியிடப்படும்.",
        feature_gps_title: "GPS புகைப்பட சான்று",
        feature_gps_desc: "GPS ஆயத்தொகுப்புகள் மற்றும் நேரமுத்திரையுடன் புகைப்படங்களை பதிவுசெய்யுங்கள்.",
        success_registered: "புகார் பதிவு செய்யப்பட்டது",
        success_tracking_id: "கண்காணிப்பு ID:",
        success_category: "வகை:",
        btn_track_status: "🔍 நிலையை கண்காணி",
        btn_new_complaint: "+ புதிய புகார்",
        btn_file_complaint: "புதிய புகார் பதிவு",
        notif_title: "நிலை புதுப்பிப்பு",
        notif_enable: "🔔 அறிவிப்புகளை இயக்கு",
        notif_enabled: "🔔 அறிவிப்புகள் இயக்கப்பட்டுள்ளன",
        track_not_found_desc: "இந்த ID இல் புகார் எதுவும் காணவில்லை. கண்காணிப்பு IDஐ மீண்டும் சரிபார்க்கவும்.",
        track_progress: "தீர்வு முன்னேற்றம்",
        track_submit_another: "மற்றொரு புகாரை சமர்ப்பிக்கவும்",
        track_priority: "முன்னுரிமை",
        admin_title: "நிர்வாக கட்டளை மையம்",
        admin_subtitle: "AI வகைப்படுத்தல் மற்றும் தீர்வு பணிப்பாய்வுகளை மேற்பார்வை",
        admin_active_officers: "🟢 4 செயலில் உள்ள அதிகாரிகள்",
        admin_total: "மொத்தம்",
        admin_pending: "நிலுவையில்",
        admin_in_progress: "நடைபெறுகிறது",
        admin_resolved: "தீர்க்கப்பட்டது",
        admin_col_id: "ஐடி",
        admin_col_subject: "தலைப்பு & வகை",
        admin_col_citizen: "குடிமகன்",
        admin_col_priority: "முன்னுரிமை",
        admin_col_status: "நிலை",
        admin_col_attachments: "இணைப்புகள்",
        admin_col_actions: "செயல்கள்",
        admin_resolve: "✓ தீர்க்க",
        admin_done: "✓ முடிந்தது",
        login_welcome: "வரவேற்கிறோம்",
        login_select_role: "தொடர உங்கள் பங்கை தேர்ந்தெடுங்கள்",
        login_email: "மின்னஞ்சல்",
        login_password: "கடவுச்சொல்",
        login_signing_in: "உள்நுழைகிறது...",
        login_sign_in_as: "உள்நுழை",
        login_error_role: "முதலில் ஒரு பங்கை தேர்ந்தெடுக்கவும்.",
        login_error_creds: "தவறான நற்சான்றிதழ்கள். குறிப்பை சரிபார்க்கவும்.",
        login_citizen_label: "குடிமக்கள் பயனர்",
        login_citizen_desc: "புகார்களை பதிவு செய்து கண்காணிக்கவும்",
        login_authority_label: "அதிகாரி அலுவலர்",
        login_authority_desc: "புகார்களை நிர்வகிக்கவும் மற்றும் தீர்க்கவும்",
        login_chief_label: "தலைமை நிர்வாகி",
        login_chief_desc: "அமைப்பு அளவிலான கண்காணிப்பு & பகுப்பாய்வு",
        chief_title: "தலைமை கட்டளை மையம்",
        chief_subtitle: "அமைப்பு அளவிலான பகுப்பாய்வு, புகார் மேற்பார்வை மற்றும் அதிகார நிர்வகம்",
        chief_export_pdf: "📄 PDF முதல் ஏற்றுமதி செய்",
        chief_total: "மொத்த புகார்கள்",
        chief_pending: "நிலுவையில்",
        chief_in_progress: "நடைபெறுகிறது",
        chief_resolved: "தீர்க்கப்பட்டது",
        chief_critical: "குரிப்பிட்டம்",
        chief_category_breakdown: "📊 வகை பகுப்பு",
        chief_authority_status: "🏗️ அதிகார நிலை",
        chief_all_grievances: "🗂️ அனைத்து புகார்கள்",
        chief_complaints_total: "மொத்த புகார்கள்",
        chief_col_id: "ஐடி",
        chief_col_subject: "தலைப்பு & வகை",
        chief_col_citizen: "குடிமகன்",
        chief_col_location: "இடம்",
        chief_col_priority: "முன்னுரிமை",
        chief_col_status: "நிலை",
        chief_col_date: "தேதி",
        chief_active: "செயலில்",
        chief_busy: "முடிப்பு",
        chief_available: "கிடைக்கிறது",
        chief_active_cases: "செயலில்",
        status_pending: "நிலுவையில்",
        status_in_progress: "நடைபெறுகிறது",
        status_resolved: "தீர்க்கப்பட்டது",
        priority_critical: "குரிப்பிட்டம்",
        priority_high: "உயர்வு",
        priority_medium: "மத்திமம்",
        priority_low: "தாழ்வு",
    },
};

interface LanguageContextType {
    lang: Language;
    setLang: (lang: Language) => void;
    t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [lang, setLang] = useState<Language>("en");
    const t = (key: TranslationKey) => translations[lang][key] ?? key;
    return (
        <LanguageContext.Provider value={{ lang, setLang, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLang() {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error("useLang must be used within LanguageProvider");
    return ctx;
}
