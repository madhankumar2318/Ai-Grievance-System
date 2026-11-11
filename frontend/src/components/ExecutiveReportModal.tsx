"use client";

import React, { useState, useEffect } from "react";
import ChiefPrintReport, { ChiefComplaint, TrendDay } from "./ChiefPrintReport";

interface ExecutiveReportModalProps {
    isOpen: boolean;
    onClose: () => void;
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
}

export default function ExecutiveReportModal({
    isOpen,
    onClose,
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
}: ExecutiveReportModalProps) {
    const [activePage, setActivePage] = useState<"all" | "1" | "2">("all");
    const [zoom, setZoom] = useState<number>(100);
    const [isExporting, setIsExporting] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Keyboard listener (Escape key closes viewer)
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };

        // Push state for safe browser "Back" navigation
        try {
            window.history.pushState({ executiveModalOpen: true }, "", window.location.href);
        } catch {
            // fallback
        }

        const handlePopState = () => {
            onClose();
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("popstate", handlePopState);

        // Prevent background body scroll while modal is open
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("popstate", handlePopState);
            document.body.style.overflow = originalOverflow;
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleDownloadPDF = () => {
        setIsExporting(true);
        setToastMessage("Preparing High-Resolution Vector PDF... In your print window, select 'Save as PDF' (Portrait).");

        setTimeout(() => {
            window.print();
            setTimeout(() => {
                setIsExporting(false);
                setToastMessage(null);
            }, 1200);
        }, 300);
    };

    const handlePhysicalPrint = () => {
        window.print();
    };

    return (
        <div className="executive-modal-backdrop no-print">
            {/* ── Top Floating Command Bar ── */}
            <header className="executive-modal-toolbar">
                {/* Left: Branding & Status */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                    <div className="modal-toolbar-emblem">🏛️</div>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ color: "#ffffff", fontWeight: 800, fontSize: "0.95rem", letterSpacing: "-0.01em" }}>
                                Executive Audit Dossier
                            </span>
                            <span className="modal-toolbar-badge">
                                TIER-1 CIVIC RECORD
                            </span>
                        </div>
                        <div style={{ color: "#94a3b8", fontSize: "0.72rem" }}>
                            Official Municipal Redressal Oversight Ledger · A4 Standard
                        </div>
                    </div>
                </div>

                {/* Center: Page Controls & Zoom */}
                <div className="modal-toolbar-center">
                    {/* Page View Selector */}
                    <div className="modal-pill-group">
                        <button
                            onClick={() => setActivePage("all")}
                            className={`modal-pill-btn ${activePage === "all" ? "active" : ""}`}
                        >
                            📄 All Pages (2)
                        </button>
                        <button
                            onClick={() => setActivePage("1")}
                            className={`modal-pill-btn ${activePage === "1" ? "active" : ""}`}
                        >
                            Page 1
                        </button>
                        <button
                            onClick={() => setActivePage("2")}
                            className={`modal-pill-btn ${activePage === "2" ? "active" : ""}`}
                        >
                            Page 2
                        </button>
                    </div>

                    {/* Zoom Selector */}
                    <div className="modal-pill-group">
                        <button
                            onClick={() => setZoom(Math.max(70, zoom - 15))}
                            className="modal-pill-btn"
                            title="Zoom Out"
                        >
                            −
                        </button>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#cbd5e1", padding: "0 0.4rem" }}>
                            {zoom}%
                        </span>
                        <button
                            onClick={() => setZoom(Math.min(130, zoom + 15))}
                            className="modal-pill-btn"
                            title="Zoom In"
                        >
                            +
                        </button>
                    </div>
                </div>

                {/* Right: Action Buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    {/* Primary: Download PDF */}
                    <button
                        onClick={handleDownloadPDF}
                        disabled={isExporting}
                        className="modal-btn-download"
                    >
                        <span>📥</span>
                        <span>{isExporting ? "Compiling PDF..." : "Download PDF"}</span>
                    </button>

                    {/* Secondary: Physical Print */}
                    <button
                        onClick={handlePhysicalPrint}
                        className="modal-btn-print"
                        title="Send directly to physical printer"
                    >
                        <span>🖨️</span>
                        <span className="btn-text-desktop">Print</span>
                    </button>

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="modal-btn-close"
                        title="Close viewer (Esc)"
                    >
                        ✕
                    </button>
                </div>
            </header>

            {/* Toast guidance banner if downloading */}
            {toastMessage && (
                <div className="modal-toast-banner">
                    <span>✨ {toastMessage}</span>
                </div>
            )}

            {/* ── Main Viewport (Dark Canvas) ── */}
            <main className="executive-modal-viewport">
                <div
                    className="executive-canvas-scaler"
                    style={{
                        transform: `scale(${zoom / 100})`,
                        transformOrigin: "top center",
                        transition: "transform 0.15s ease",
                    }}
                >
                    {/* PAGE 1 */}
                    {(activePage === "all" || activePage === "1") && (
                        <div className="executive-sheet-container">
                            <div className="executive-sheet-tag">
                                <span>PAGE 1 OF 2 · EXECUTIVE OVERVIEW & CIVIC INTELLIGENCE</span>
                            </div>
                            <div className="executive-a4-sheet">
                                <ChiefPrintReport
                                    total={total}
                                    pending={pending}
                                    inProgress={inProgress}
                                    resolved={resolved}
                                    critical={critical}
                                    resolutionRate={resolutionRate}
                                    complaints={complaints}
                                    categoryCounts={categoryCounts}
                                    trendData={trendData}
                                    priorityCounts={priorityCounts}
                                    renderMode="page1-only"
                                />
                            </div>
                        </div>
                    )}

                    {/* PAGE 2 */}
                    {(activePage === "all" || activePage === "2") && (
                        <div className="executive-sheet-container">
                            <div className="executive-sheet-tag">
                                <span>PAGE 2 OF 2 · GRIEVANCE AUDIT LEDGER & MUNICIPAL SIGN-OFF</span>
                            </div>
                            <div className="executive-a4-sheet">
                                <ChiefPrintReport
                                    total={total}
                                    pending={pending}
                                    inProgress={inProgress}
                                    resolved={resolved}
                                    critical={critical}
                                    resolutionRate={resolutionRate}
                                    complaints={complaints}
                                    categoryCounts={categoryCounts}
                                    trendData={trendData}
                                    priorityCounts={priorityCounts}
                                    renderMode="page2-only"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
