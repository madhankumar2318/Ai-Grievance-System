"use client";

import React, { useState, useRef, useEffect } from "react";
import { updateComplaintStatusServerAction, ActionTakenReportData } from "@/app/actions/complaintActions";

interface ActionTakenReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    complaint: {
        id: string;
        subject: string;
        category: string;
        location: string;
        citizenEvidencePhoto?: string | null;
    } | null;
    officerDistrict?: string;
    onResolveSuccess: (id: string, atr: ActionTakenReportData) => void;
}

/**
 * Client-side high-efficiency canvas image compressor.
 * Resizes large smartphone camera photos to max 1000px and quality 0.7 JPEG (~40KB - 80KB)
 * to ensure instant uploads and seamless storage without database bloat.
 */
function compressImageFile(file: File, maxDim = 1000, quality = 0.7): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxDim) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    }
                } else {
                    if (height > maxDim) {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    resolve(event.target?.result as string);
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);
                const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
                resolve(compressedDataUrl);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

export default function ActionTakenReportModal({
    isOpen,
    onClose,
    complaint,
    officerDistrict = "District Authority",
    onResolveSuccess,
}: ActionTakenReportModalProps) {
    const [officerName, setOfficerName] = useState("");
    const [actionDescription, setActionDescription] = useState("");
    const [resolutionPhoto, setResolutionPhoto] = useState<string | null>(null);
    const [photoSizeKb, setPhotoSizeKb] = useState<number>(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    // Reset state when modal opens for a new complaint
    useEffect(() => {
        if (isOpen) {
            setOfficerName("");
            setActionDescription("");
            setResolutionPhoto(null);
            setPhotoSizeKb(0);
            setErrorMessage(null);
            setIsSubmitting(false);
        }
    }, [isOpen, complaint?.id]);

    // Handle ESC key to dismiss modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen && !isSubmitting) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, isSubmitting, onClose]);

    if (!isOpen || !complaint) return null;

    const handleFileProcess = async (file: File) => {
        if (!file.type.startsWith("image/")) {
            setErrorMessage("Please select a valid image file (JPG, PNG, WEBP).");
            return;
        }

        try {
            setErrorMessage(null);
            const compressed = await compressImageFile(file, 1000, 0.7);
            setResolutionPhoto(compressed);
            const approxKb = Math.round((compressed.length * 3) / 4 / 1024);
            setPhotoSizeKb(approxKb);
        } catch (err) {
            console.error("Compression error:", err);
            setErrorMessage("Could not process the selected image. Please try another photo.");
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFileProcess(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFileProcess(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        // Validation 1: Officer Name
        if (!officerName.trim()) {
            setErrorMessage("Please enter the Official Staff / Engineer Name who executed the repair.");
            return;
        }

        // Validation 2: Description
        if (actionDescription.trim().length < 15) {
            setErrorMessage("Action Taken Description must be at least 15 characters detailing the work done.");
            return;
        }

        // Validation 3: Resolution Photo
        if (!resolutionPhoto) {
            setErrorMessage("A Proof of Resolution Photo is mandatory to verify that the ground work is completed.");
            return;
        }

        setIsSubmitting(true);

        const atrPayload: ActionTakenReportData = {
            officerName: officerName.trim(),
            actionDescription: actionDescription.trim(),
            department: complaint.category,
            resolvedAt: new Date().toISOString(),
            resolutionPhoto,
        };

        try {
            const res = await updateComplaintStatusServerAction(complaint.id, "Resolved", atrPayload);
            if (res.success) {
                onResolveSuccess(complaint.id, atrPayload);
                onClose();
            } else {
                setErrorMessage(res.error || "Failed to update complaint status. Please try again.");
            }
        } catch (err) {
            console.error("Submission error:", err);
            setErrorMessage("A network error occurred while submitting the report. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(5, 5, 12, 0.85)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            overflowY: "auto",
        }}>
            <div
                className="animate-fade-in"
                style={{
                    background: "rgba(18, 20, 34, 0.98)",
                    border: "1px solid rgba(99, 102, 241, 0.35)",
                    borderRadius: "1.25rem",
                    width: "100%",
                    maxWidth: "680px",
                    boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 30px rgba(99, 102, 241, 0.15)",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    maxHeight: "92vh",
                }}
            >
                {/* Header */}
                <div style={{
                    padding: "1.25rem 1.75rem",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                    background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12), transparent)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div style={{
                            width: "42px",
                            height: "42px",
                            borderRadius: "10px",
                            background: "linear-gradient(135deg, #10b981, #06b6d4)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "1.3rem",
                            boxShadow: "0 4px 14px rgba(16, 185, 129, 0.35)",
                        }}>
                            📝
                        </div>
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <h3 style={{ fontSize: "1.15rem", fontWeight: "800", color: "#ffffff", margin: 0 }}>
                                    File Action Taken Report (ATR)
                                </h3>
                                <span style={{
                                    fontSize: "0.7rem",
                                    fontWeight: "800",
                                    padding: "0.15rem 0.5rem",
                                    borderRadius: "99px",
                                    background: "rgba(16, 185, 129, 0.2)",
                                    color: "#10b981",
                                    border: "1px solid rgba(16, 185, 129, 0.35)",
                                }}>
                                    Mandatory Proof
                                </span>
                            </div>
                            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: "0.2rem 0 0" }}>
                                Record official work details and photographic proof before closing this complaint.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--text-muted)",
                            fontSize: "1.4rem",
                            cursor: isSubmitting ? "not-allowed" : "pointer",
                            padding: "0.25rem 0.5rem",
                            borderRadius: "0.5rem",
                            lineHeight: 1,
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Complaint Brief Summary Card */}
                <div style={{
                    padding: "0.85rem 1.75rem",
                    background: "rgba(255, 255, 255, 0.02)",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "0.75rem",
                }}>
                    <div>
                        <span style={{ fontFamily: "monospace", fontSize: "0.75rem", fontWeight: "700", color: "#a5b4fc" }}>
                            {complaint.id}
                        </span>
                        <div style={{ fontWeight: "700", fontSize: "0.9rem", color: "var(--text-main)" }}>
                            {complaint.subject}
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        <span>📂 {complaint.category}</span>
                        <span>•</span>
                        <span>📍 {complaint.location || officerDistrict}</span>
                    </div>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} style={{ padding: "1.5rem 1.75rem", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                    {/* Error Banner */}
                    {errorMessage && (
                        <div style={{
                            padding: "0.75rem 1rem",
                            borderRadius: "0.6rem",
                            background: "rgba(239, 68, 68, 0.15)",
                            border: "1px solid rgba(239, 68, 68, 0.35)",
                            color: "#fca5a5",
                            fontSize: "0.82rem",
                            fontWeight: "600",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                        }}>
                            <span>⚠️</span>
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {/* Field 1: Official Staff / Engineer Name */}
                    <div>
                        <label style={{ display: "block", fontSize: "0.82rem", fontWeight: "700", color: "#e2e8f0", marginBottom: "0.35rem" }}>
                            👷 Official Staff / Engineer Name <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={officerName}
                            onChange={(e) => setOfficerName(e.target.value)}
                            placeholder="e.g., S. Ramanathan, Ward 4 Junior Engineer"
                            style={{
                                width: "100%",
                                padding: "0.65rem 0.85rem",
                                borderRadius: "0.6rem",
                                border: "1px solid var(--border)",
                                background: "var(--bg-main)",
                                color: "var(--text-main)",
                                fontSize: "0.88rem",
                                outline: "none",
                            }}
                        />
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
                            Designation and name of the official who supervised or executed the ground work.
                        </span>
                    </div>

                    {/* Field 2: Action Taken Report Description */}
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                            <label style={{ fontSize: "0.82rem", fontWeight: "700", color: "#e2e8f0" }}>
                                📝 Action Taken Description <span style={{ color: "#ef4444" }}>*</span>
                            </label>
                            <span style={{ fontSize: "0.72rem", color: actionDescription.length >= 15 ? "#10b981" : "var(--text-muted)" }}>
                                {actionDescription.length} / 15 min chars
                            </span>
                        </div>
                        <textarea
                            required
                            rows={3}
                            value={actionDescription}
                            onChange={(e) => setActionDescription(e.target.value)}
                            placeholder="e.g., Dispatched sanitation truck #TN45-9821. 2 tons of waste cleared and bleaching powder sprayed. Site inspected and confirmed sanitized."
                            style={{
                                width: "100%",
                                padding: "0.65rem 0.85rem",
                                borderRadius: "0.6rem",
                                border: "1px solid var(--border)",
                                background: "var(--bg-main)",
                                color: "var(--text-main)",
                                fontSize: "0.85rem",
                                lineHeight: "1.5",
                                resize: "vertical",
                                outline: "none",
                            }}
                        />
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
                            Provide a transparent summary of vehicles dispatched, materials used, or repairs executed.
                        </span>
                    </div>

                    {/* Field 3: Proof of Resolution Photo Evidence (Mandatory) */}
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                            <label style={{ fontSize: "0.82rem", fontWeight: "700", color: "#e2e8f0" }}>
                                📸 Proof of Resolution Photo <span style={{ color: "#ef4444" }}>*</span>
                            </label>
                            <span style={{ fontSize: "0.72rem", fontWeight: "700", color: resolutionPhoto ? "#10b981" : "#f59e0b" }}>
                                {resolutionPhoto ? `✓ Photo Attached (${photoSizeKb} KB)` : "Required"}
                            </span>
                        </div>

                        {resolutionPhoto ? (
                            /* Photo Uploaded Preview Card */
                            <div style={{
                                position: "relative",
                                borderRadius: "0.75rem",
                                overflow: "hidden",
                                border: "1.5px solid rgba(16, 185, 129, 0.4)",
                                background: "#0b0f19",
                                display: "flex",
                                flexDirection: "column",
                            }}>
                                <div style={{ position: "relative", height: "180px", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <img
                                        src={resolutionPhoto}
                                        alt="Resolution Proof"
                                        style={{ maxHeight: "180px", width: "100%", objectFit: "contain" }}
                                    />
                                    <div style={{
                                        position: "absolute",
                                        top: "0.5rem",
                                        left: "0.5rem",
                                        background: "rgba(16, 185, 129, 0.9)",
                                        color: "#ffffff",
                                        fontSize: "0.68rem",
                                        fontWeight: "800",
                                        padding: "0.2rem 0.55rem",
                                        borderRadius: "99px",
                                    }}>
                                        ✓ After Work Proof
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setResolutionPhoto(null);
                                            setPhotoSizeKb(0);
                                        }}
                                        style={{
                                            position: "absolute",
                                            top: "0.5rem",
                                            right: "0.5rem",
                                            background: "rgba(239, 68, 68, 0.85)",
                                            border: "none",
                                            borderRadius: "99px",
                                            padding: "0.25rem 0.65rem",
                                            color: "#ffffff",
                                            fontSize: "0.72rem",
                                            fontWeight: "700",
                                            cursor: "pointer",
                                        }}
                                    >
                                        ✕ Remove
                                    </button>
                                </div>
                                <div style={{
                                    padding: "0.6rem 0.85rem",
                                    background: "rgba(16, 185, 129, 0.08)",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    fontSize: "0.75rem",
                                }}>
                                    <span style={{ color: "#34d399", fontWeight: "600" }}>✓ Ground repair photo verified &amp; ready</span>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        style={{
                                            background: "none",
                                            border: "none",
                                            color: "#a5b4fc",
                                            fontSize: "0.75rem",
                                            cursor: "pointer",
                                            textDecoration: "underline",
                                        }}
                                    >
                                        Replace photo
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Dropzone / Upload Trigger */
                            <div
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                style={{
                                    borderRadius: "0.75rem",
                                    border: isDragging ? "2px dashed #10b981" : "2px dashed rgba(99, 102, 241, 0.4)",
                                    background: isDragging ? "rgba(16, 185, 129, 0.08)" : "rgba(255, 255, 255, 0.02)",
                                    padding: "1.5rem 1rem",
                                    textAlign: "center",
                                    cursor: "pointer",
                                    transition: "all 0.2s ease",
                                }}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <div style={{ fontSize: "2rem", marginBottom: "0.4rem" }}>📸</div>
                                <div style={{ fontWeight: "700", fontSize: "0.9rem", color: "#e2e8f0", marginBottom: "0.25rem" }}>
                                    Click or Drag &amp; Drop Resolution Photo
                                </div>
                                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "0 0 0.85rem" }}>
                                    Take a photo of the completed spot (JPG, PNG, WebP)
                                </p>
                                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            cameraInputRef.current?.click();
                                        }}
                                        style={{
                                            padding: "0.35rem 0.85rem",
                                            borderRadius: "0.5rem",
                                            border: "1px solid rgba(16, 185, 129, 0.4)",
                                            background: "rgba(16, 185, 129, 0.15)",
                                            color: "#34d399",
                                            fontSize: "0.75rem",
                                            fontWeight: "700",
                                            cursor: "pointer",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "0.35rem",
                                        }}
                                    >
                                        📷 Open Camera
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            fileInputRef.current?.click();
                                        }}
                                        style={{
                                            padding: "0.35rem 0.85rem",
                                            borderRadius: "0.5rem",
                                            border: "1px solid var(--border)",
                                            background: "rgba(255, 255, 255, 0.05)",
                                            color: "var(--text-main)",
                                            fontSize: "0.75rem",
                                            fontWeight: "600",
                                            cursor: "pointer",
                                        }}
                                    >
                                        Browse Files
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Hidden file inputs */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            style={{ display: "none" }}
                        />
                        <input
                            ref={cameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleFileChange}
                            style={{ display: "none" }}
                        />
                    </div>

                    {/* Optional Reference: Citizen's Before Photo */}
                    {complaint.citizenEvidencePhoto && (
                        <div style={{
                            padding: "0.75rem",
                            borderRadius: "0.6rem",
                            background: "rgba(255, 255, 255, 0.02)",
                            border: "1px solid var(--border)",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.75rem",
                        }}>
                            <img
                                src={complaint.citizenEvidencePhoto}
                                alt="Citizen Original Evidence"
                                style={{ width: "48px", height: "48px", borderRadius: "0.4rem", objectFit: "cover", flexShrink: 0 }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: "0.72rem", fontWeight: "700", color: "#a5b4fc" }}>
                                    Citizen's Original Problem Photo (Reference)
                                </div>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>
                                    Ensure your resolution photo captures the same spot to verify completion.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div style={{
                        marginTop: "0.5rem",
                        paddingTop: "1rem",
                        borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "0.75rem",
                    }}>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            style={{
                                padding: "0.65rem 1.25rem",
                                borderRadius: "0.6rem",
                                border: "1px solid var(--border)",
                                background: "transparent",
                                color: "var(--text-muted)",
                                fontSize: "0.85rem",
                                fontWeight: "600",
                                cursor: isSubmitting ? "not-allowed" : "pointer",
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !officerName.trim() || actionDescription.trim().length < 15 || !resolutionPhoto}
                            style={{
                                padding: "0.65rem 1.5rem",
                                borderRadius: "0.6rem",
                                border: "none",
                                background: isSubmitting || !officerName.trim() || actionDescription.trim().length < 15 || !resolutionPhoto
                                    ? "rgba(16, 185, 129, 0.3)"
                                    : "linear-gradient(135deg, #10b981, #06b6d4)",
                                color: "#ffffff",
                                fontSize: "0.85rem",
                                fontWeight: "800",
                                cursor: isSubmitting || !officerName.trim() || actionDescription.trim().length < 15 || !resolutionPhoto
                                    ? "not-allowed"
                                    : "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                boxShadow: "0 4px 14px rgba(16, 185, 129, 0.3)",
                                transition: "all 0.2s ease",
                            }}
                        >
                            {isSubmitting ? "⏳ Submitting ATR & Resolving..." : "✓ Submit ATR & Mark Resolved"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
