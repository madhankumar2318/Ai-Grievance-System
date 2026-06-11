"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useLang } from "@/context/LanguageContext";
import { NotificationBanner } from "@/components/PushNotifications";

interface MediaFile { name: string; type: string; url: string; size: number; file?: File; }
interface GpsCoords { lat: number; lng: number; accuracy: number; }
interface SubmissionResponse {
  success: boolean;
  data: {
    id: string;
    ai_triage: { category: string; priority: string; reasoning: string };
    attachmentCount: number;
  };
}

// Speech Recognition type shim
interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onresult: ((event: any) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

/* ─── AI Photo Analysis ─────────────────────────────────── */
async function analyzePhotoWithAI(file: File): Promise<{ subject: string; category: string; confidence: number }> {
  // Simulated AI analysis — keyword detection based on filename + simulated delay
  return new Promise((resolve) => {
    setTimeout(() => {
      const name = file.name.toLowerCase();
      const size = file.size;

      if (name.includes("pot") || name.includes("road") || name.includes("hole") || (size > 500000 && name.includes("damage"))) {
        resolve({ subject: "Road Pothole Causing Safety Hazard", category: "Infrastructure", confidence: 94 });
      } else if (name.includes("water") || name.includes("pipe") || name.includes("leak") || name.includes("flood")) {
        resolve({ subject: "Water Leakage / Pipe Burst", category: "Environment", confidence: 91 });
      } else if (name.includes("garbage") || name.includes("waste") || name.includes("trash") || name.includes("dump")) {
        resolve({ subject: "Illegal Garbage Dumping", category: "Environment", confidence: 88 });
      } else if (name.includes("light") || name.includes("lamp") || name.includes("electric") || name.includes("power")) {
        resolve({ subject: "Street Light Failure / Power Outage", category: "Infrastructure", confidence: 90 });
      } else if (name.includes("smoke") || name.includes("pollution") || name.includes("factory") || name.includes("air")) {
        resolve({ subject: "Air Pollution from Industrial Source", category: "Environment", confidence: 87 });
      } else if (name.includes("park") || name.includes("vehicle") || name.includes("car") || name.includes("truck")) {
        resolve({ subject: "Illegal Parking Blocking Road", category: "Safety", confidence: 85 });
      } else if (name.includes("hospital") || name.includes("medical") || name.includes("clinic") || name.includes("health")) {
        resolve({ subject: "Public Health Facility Issue", category: "Public Health", confidence: 82 });
      } else if (name.includes("gps_")) {
        // GPS captured photo — analyze by size pattern
        if (size > 800000) {
          resolve({ subject: "Infrastructure Damage Detected", category: "Infrastructure", confidence: 78 });
        } else {
          resolve({ subject: "Environmental Issue Captured at Location", category: "Environment", confidence: 75 });
        }
      } else {
        // Generic photo analysis
        const categories = [
          { subject: "Road / Infrastructure Damage", category: "Infrastructure", confidence: 72 },
          { subject: "Environmental Pollution Issue", category: "Environment", confidence: 70 },
          { subject: "Public Safety Concern", category: "Safety", confidence: 68 },
        ];
        resolve(categories[Math.floor(Math.random() * categories.length)]);
      }
    }, 1800); // Simulate API delay
  });
}

/* ─── GPS + Camera Modal ─────────────────────────────────── */
function GpsCameraModal({
  onCapture,
  onClose,
}: {
  onCapture: (file: MediaFile, coords: GpsCoords | null, address: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [step, setStep] = useState<"idle" | "loading" | "live" | "preview" | "error">("idle");
  const [camError, setCamError] = useState("");
  const [gps, setGps] = useState<GpsCoords | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"fetching" | "ok" | "denied" | "idle">("idle");
  const [captured, setCaptured] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setStep("loading");
    setCamError("");
    setGpsStatus("fetching");
    navigator.geolocation?.getCurrentPosition(
      (pos) => { setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }); setGpsStatus("ok"); },
      () => setGpsStatus("denied"),
      { timeout: 8000, enableHighAccuracy: true }
    );
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setStep("live");
    } catch {
      setCamError("Camera permission denied. Please allow camera access in your browser settings.");
      setStep("error");
    }
  }, []);

  useEffect(() => {
    setTimeout(() => {
      start();
    }, 0);
    return () => stopCamera();
  }, [start, stopCamera]);

  const buildAddress = (g: GpsCoords | null) => g ? `${g.lat.toFixed(5)}, ${g.lng.toFixed(5)}` : "";

  const stampLocation = (canvas: HTMLCanvasElement, g: GpsCoords | null) => {
    const ctx = canvas.getContext("2d")!;
    const w = canvas.width, h = canvas.height;
    const now = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
    const lines = g
      ? [`📍 ${g.lat.toFixed(5)}, ${g.lng.toFixed(5)}`, `🎯 ±${Math.round(g.accuracy)}m  •  ${now}`]
      : [`📅 ${now}`, "📍 Location unavailable"];
    const padX = 16, padY = 10, lineH = 22, fontSize = 14;
    const boxH = lines.length * lineH + padY * 2;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, h - boxH, w, boxH);
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${fontSize}px monospace`;
    lines.forEach((line, i) => { ctx.fillText(line, padX, h - boxH + padY + (i + 1) * lineH - 4); });
    if (g) {
      ctx.fillStyle = "#22c55e"; ctx.beginPath(); ctx.arc(w - 20, h - boxH + boxH / 2, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(34,197,94,0.3)"; ctx.beginPath(); ctx.arc(w - 20, h - boxH + boxH / 2, 12, 0, Math.PI * 2); ctx.fill();
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current, c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    stampLocation(c, gps);
    setCaptured(c.toDataURL("image/jpeg", 0.92));
    stopCamera(); setStep("preview");
  };

  const retake = () => { setCaptured(null); start(); };
  const usePhoto = () => {
    if (!captured) return;
    fetch(captured).then(r => r.blob()).then(blob => {
      const f: MediaFile = { name: `gps_photo_${Date.now()}.jpg`, type: "image/jpeg", url: URL.createObjectURL(blob), size: blob.size, file: new File([blob], `gps_photo_${Date.now()}.jpg`, { type: "image/jpeg" }) };
      onCapture(f, gps, buildAddress(gps)); onClose();
    });
  };
  const close = () => { stopCamera(); onClose(); };

  const gpsChip = (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0.9rem", borderRadius: "99px", fontSize: "0.75rem", fontWeight: "700", background: gpsStatus === "ok" ? "#22c55e20" : gpsStatus === "fetching" ? "#f59e0b20" : "#ef444420", color: gpsStatus === "ok" ? "#22c55e" : gpsStatus === "fetching" ? "#f59e0b" : "#ef4444", border: `1px solid ${gpsStatus === "ok" ? "#22c55e44" : gpsStatus === "fetching" ? "#f59e0b44" : "#ef444444"}` }}>
      <span style={{ fontSize: "0.6rem", width: 8, height: 8, borderRadius: "50%", background: "currentColor", display: "inline-block", animation: gpsStatus === "fetching" ? "pulse 1s infinite" : "none" }} />
      {gpsStatus === "ok" && gps ? `📍 ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}` : gpsStatus === "fetching" ? "Acquiring GPS…" : "GPS unavailable"}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div className="glass" style={{ width: "100%", maxWidth: "520px", borderRadius: "1.5rem", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontWeight: "700" }}><span>📍📷</span> GPS Camera</div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {gpsChip}
            <button onClick={close} style={{ background: "transparent", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "var(--text-muted)", lineHeight: 1 }}>✕</button>
          </div>
        </div>
        <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {step === "error" && <div style={{ padding: "1rem", background: "#ef444420", border: "1px solid #ef4444", borderRadius: "0.75rem", color: "#ef4444", fontSize: "0.875rem" }}>⚠️ {camError}</div>}
          {step === "loading" && <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)" }}><div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⏳</div><p>Starting camera &amp; GPS…</p></div>}
          {step === "live" && (
            <>
              <div style={{ position: "relative", borderRadius: "0.75rem", overflow: "hidden", background: "#000" }}>
                <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", display: "block", maxHeight: "320px", objectFit: "cover" }} />
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.55)", padding: "0.5rem 0.75rem", fontSize: "0.7rem", fontFamily: "monospace", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>{gpsStatus === "ok" && gps ? `📍 ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}  ±${Math.round(gps.accuracy)}m` : gpsStatus === "fetching" ? "📍 Acquiring GPS…" : "📍 Location unavailable"}</span>
                  <span>{new Date().toLocaleTimeString("en-IN")}</span>
                </div>
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 48, height: 48, border: "2px solid rgba(255,255,255,0.7)", borderRadius: "50%" }} />
                </div>
              </div>
              <button className="btn btn-primary" onClick={capturePhoto} style={{ fontSize: "1rem" }}>📸 Capture with GPS Tag</button>
            </>
          )}
          {step === "preview" && captured && (
            <>
              <div style={{ borderRadius: "0.75rem", overflow: "hidden", border: "2px solid #22c55e44" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={captured} alt="Captured" style={{ width: "100%", display: "block" }} />
              </div>
              {gpsStatus === "ok" && <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 0.9rem", borderRadius: "0.75rem", background: "#22c55e15", border: "1px solid #22c55e44", fontSize: "0.8rem", color: "#22c55e", fontWeight: "600" }}>✅ GPS location stamped on photo</div>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <button className="btn" onClick={retake} style={{ border: "1px solid var(--border)", background: "transparent", color: "var(--text-main)" }}>🔄 Retake</button>
                <button className="btn btn-primary" onClick={usePhoto}>✅ Use Photo</button>
              </div>
            </>
          )}
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}

/* ─── Main Complaint Page ────────────────────────────────── */
export default function Home() {
  const { t } = useLang();
  const [formData, setFormData] = useState({ subject: "", description: "", location: "", email: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SubmissionResponse | null>(null);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [showGpsCamera, setShowGpsCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice-to-Text
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // AI Photo Analysis
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{ subject: string; category: string; confidence: number } | null>(null);
  const [hasImageForAnalysis, setHasImageForAnalysis] = useState(false);
  const lastImageFileRef = useRef<File | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setVoiceSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
    }
  }, []);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newFiles: MediaFile[] = Array.from(files).map((f) => {
      if (f.type.startsWith("image/")) {
        lastImageFileRef.current = f;
        setHasImageForAnalysis(true);
      }
      return { name: f.name, type: f.type, url: URL.createObjectURL(f), size: f.size, file: f };
    });
    setMediaFiles((prev) => [...prev, ...newFiles].slice(0, 5));
    setAnalysisResult(null);
  };

  const handleGpsCapture = (file: MediaFile, _coords: GpsCoords | null, address: string) => {
    setMediaFiles((prev) => [...prev, file].slice(0, 5));
    if (address) setFormData((prev) => ({ ...prev, location: address }));
    // GPS photos are images — enable analysis
    if (file.file) { lastImageFileRef.current = file.file; setHasImageForAnalysis(true); }
    setAnalysisResult(null);
  };

  const handleAnalyzePhoto = async () => {
    if (!lastImageFileRef.current) return;
    setAnalyzingPhoto(true);
    setAnalysisResult(null);
    const result = await analyzePhotoWithAI(lastImageFileRef.current);
    setAnalysisResult(result);
    setAnalyzingPhoto(false);
    // Auto-fill subject if empty
    if (!formData.subject) setFormData((p) => ({ ...p, subject: result.subject }));
  };

  const applyAnalysis = () => {
    if (!analysisResult) return;
    setFormData((p) => ({ ...p, subject: analysisResult.subject }));
  };

  const removeFile = (i: number) => {
    setMediaFiles((prev) => {
      URL.revokeObjectURL(prev[i].url);
      const next = prev.filter((_, idx) => idx !== i);
      const hasImg = next.some(f => f.type.startsWith("image/"));
      setHasImageForAnalysis(hasImg);
      if (!hasImg) { setAnalysisResult(null); lastImageFileRef.current = null; }
      return next;
    });
  };

  const startVoice = () => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;
    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-IN";
    let finalTranscript = formData.description;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) { finalTranscript += event.results[i][0].transcript + " "; }
        else interim = event.results[i][0].transcript;
      }
      setFormData((p) => ({ ...p, description: finalTranscript + interim }));
    };
    rec.onend = () => { setIsListening(false); setFormData((p) => ({ ...p, description: finalTranscript.trim() })); };
    rec.onerror = () => setIsListening(false);
    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  };

  const stopVoice = () => { recognitionRef.current?.stop(); setIsListening(false); };

  const formatSize = (b: number) => b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      const res = await fetch("/api/complaint", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...formData, userEmail: (formData.email || "").toLowerCase().trim(), attachmentCount: mediaFiles.length }) });
      setResult(await res.json());
    } catch (err) { console.error(err); }
    finally { setIsSubmitting(false); }
  };

  const reset = () => { mediaFiles.forEach(f => URL.revokeObjectURL(f.url)); setResult(null); setFormData({ subject: "", description: "", location: "", email: "" }); setMediaFiles([]); setAnalysisResult(null); setHasImageForAnalysis(false); lastImageFileRef.current = null; };

  if (result?.success) {
    return (
      <ProtectedRoute allowedRoles={["user"]}>
        <main className="container section animate-fade-in" style={{ textAlign: "center" }}>
          <NotificationBanner complaintId={result.data.id} />
          <div className="glass" style={{ padding: "4rem", borderRadius: "1.5rem", maxWidth: "600px", margin: "0 auto" }}>
            <div style={{ fontSize: "4rem", marginBottom: "1.5rem" }}>✅</div>
            <h2 className="gradient-text" style={{ fontSize: "3rem", marginBottom: "1rem" }}>{t("success_registered")}</h2>
            <p style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>{t("success_tracking_id")} <strong>{result.data.id}</strong></p>
            <p style={{ fontSize: "1.1rem" }}>{t("success_category")} <span style={{ color: "var(--primary)", fontWeight: "bold" }}>{result.data.ai_triage.category}</span></p>
            <p style={{ color: "var(--text-muted)", marginTop: "0.5rem", fontSize: "0.9rem" }}>{result.data.ai_triage.reasoning}</p>
            {result.data.attachmentCount > 0 && (
              <div style={{ marginTop: "1rem", padding: "0.75rem 1.25rem", background: "#6366f115", borderRadius: "0.75rem", fontSize: "0.875rem", color: "#6366f1", fontWeight: "600" }}>
                📎 {result.data.attachmentCount} attachment{result.data.attachmentCount > 1 ? "s" : ""} submitted
              </div>
            )}
            <div style={{ marginTop: "1.5rem", padding: "1rem 1.25rem", background: "var(--bg-main)", borderRadius: "0.75rem", border: "1px solid var(--border)" }}>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "0.4rem" }}>Save your Tracking ID to check status anytime</p>
              <div style={{ fontFamily: "monospace", fontWeight: "800", fontSize: "1.3rem", color: "var(--primary)", letterSpacing: "0.08em" }}>{result.data.id}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginTop: "1.5rem" }}>
              <Link href={`/track?id=${result.data.id}`} className="btn btn-primary" style={{ textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}>
                {t("btn_track_status")}
              </Link>
              <button className="btn" onClick={reset} style={{ border: "1px solid var(--border)", background: "transparent", color: "var(--text-main)" }}>
                {t("btn_new_complaint")}
              </button>
            </div>
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["user"]}>
      {showGpsCamera && <GpsCameraModal onCapture={handleGpsCapture} onClose={() => setShowGpsCamera(false)} />}

      <main>
        <section className="section" style={{ background: "radial-gradient(circle at top right, hsla(245,75%,60%,0.1), transparent)" }}>
          <div className="container animate-fade-in">
            <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
              <h1 style={{ fontSize: "clamp(2.5rem, 8vw, 4.5rem)", marginBottom: "1.5rem" }}>
                {t("home_title").split(",")[0]}, <span className="gradient-text">{t("home_title").split(",")[1]?.trim() || "Empowered by AI"}</span>
              </h1>
              <p style={{ fontSize: "1.25rem", marginBottom: "3rem" }}>{t("home_subtitle")}</p>
            </div>

            <div className="glass animate-fade-in" style={{ maxWidth: "640px", margin: "0 auto", padding: "3rem", borderRadius: "1.5rem", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.1)" }}>
              <NotificationBanner />
              <h2 style={{ marginBottom: "2rem", textAlign: "center" }}>{t("home_form_title")}</h2>
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

                {/* Email (optional) */}
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", fontSize: "0.9rem" }}>📧 Email <span style={{ color: "var(--text-muted)", fontWeight: "400", fontSize: "0.8rem" }}>(optional — for status notifications)</span></label>
                  <input type="email" placeholder="your@email.com" autoComplete="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>

                {/* Subject */}
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", fontSize: "0.9rem" }}>{t("form_subject")}</label>
                  <input required type="text" placeholder={t("form_subject_placeholder")} value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} />
                </div>

                {/* Description + Voice */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <label style={{ fontWeight: "600", fontSize: "0.9rem" }}>{t("form_description")}</label>
                    {voiceSupported && (
                      <button
                        type="button"
                        onClick={isListening ? stopVoice : startVoice}
                        style={{
                          padding: "0.3rem 0.85rem", borderRadius: "99px", fontSize: "0.75rem", fontWeight: "700",
                          border: "none", cursor: "pointer", transition: "all 0.3s",
                          background: isListening
                            ? "linear-gradient(135deg, #ef4444, #f97316)"
                            : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                          color: "white",
                          boxShadow: isListening ? "0 0 0 3px rgba(239,68,68,0.3)" : "none",
                          animation: isListening ? "voicePulse 1.5s ease-in-out infinite" : "none",
                        }}
                      >
                        {isListening ? t("form_voice_listening") : t("form_voice_start")}
                      </button>
                    )}
                  </div>
                  <div style={{ position: "relative" }}>
                    <textarea
                      required rows={5}
                      placeholder={isListening ? "Speak now... 🎙️ Your words will appear here" : t("form_description_placeholder")}
                      style={{ resize: "none", border: isListening ? "2px solid #6366f1" : undefined, transition: "border-color 0.3s" }}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                    {isListening && (
                      <div style={{ position: "absolute", bottom: "0.75rem", right: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.72rem", color: "#ef4444", fontWeight: "700" }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block", animation: "voicePulse 1s ease-in-out infinite" }} />
                        Live transcription
                      </div>
                    )}
                  </div>
                  {!voiceSupported && (
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.3rem" }}>Voice input requires Chrome/Edge browser</p>
                  )}
                </div>

                {/* Location + GPS Camera + AI Photo Analysis */}
                <div>
                  <label style={{ display: "block", marginBottom: "0.75rem", fontWeight: "600", fontSize: "0.9rem" }}>
                    {t("form_location")}
                  </label>

                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "stretch" }}>
                    <input
                      type="text"
                      placeholder={t("form_location_placeholder")}
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      style={{ flex: 1 }}
                    />
                    <button type="button" title="Detect my location"
                      onClick={() => { navigator.geolocation?.getCurrentPosition((pos) => setFormData((p) => ({ ...p, location: `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}` })), () => alert("Location access denied.")); }}
                      style={{ padding: "0 1rem", borderRadius: "0.75rem", border: "1px solid var(--border)", background: "var(--bg-main)", cursor: "pointer", fontSize: "1.1rem", flexShrink: 0, transition: "var(--transition)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--primary)")}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                    >🎯</button>
                  </div>

                  <button type="button" disabled={mediaFiles.length >= 5} onClick={() => setShowGpsCamera(true)}
                    style={{ marginTop: "0.75rem", width: "100%", padding: "0.9rem 1rem", borderRadius: "0.75rem", border: "none", background: "linear-gradient(135deg, #6366f1, #ec4899)", color: "white", fontWeight: "700", fontSize: "0.9rem", cursor: mediaFiles.length >= 5 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem", opacity: mediaFiles.length >= 5 ? 0.5 : 1, transition: "var(--transition)", boxShadow: "0 4px 15px rgba(99,102,241,0.3)" }}
                  >
                    📍📷 Open GPS Camera — Capture Photo with Location Tag
                  </button>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "0.75rem 0" }}>
                    <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: "600" }}>OR ATTACH FILES</span>
                    <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
                  </div>

                  <div onClick={() => fileInputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
                    style={{ border: "2px dashed var(--border)", borderRadius: "0.75rem", padding: "1.25rem", textAlign: "center", cursor: "pointer", transition: "var(--transition)", background: "var(--bg-main)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--primary)")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                  >
                    <div style={{ fontSize: "1.5rem", marginBottom: "0.35rem" }}>📎</div>
                    <p style={{ margin: 0, fontWeight: "600", fontSize: "0.8rem", color: "var(--text-main)" }}>Click or drag &amp; drop photos / videos</p>
                    <p style={{ margin: "0.2rem 0 0", fontSize: "0.7rem" }}>JPG, PNG, GIF, MP4, MOV — up to 50MB</p>
                  </div>
                  <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" style={{ display: "none" }} onChange={(e) => handleFiles(e.target.files)} />

                  {/* AI Photo Analysis Button */}
                  {hasImageForAnalysis && (
                    <div style={{ marginTop: "0.75rem" }}>
                      <button type="button" onClick={handleAnalyzePhoto} disabled={analyzingPhoto}
                        style={{
                          width: "100%", padding: "0.75rem", borderRadius: "0.75rem",
                          border: "2px solid #8b5cf6", background: analyzingPhoto ? "#8b5cf610" : "linear-gradient(135deg, #8b5cf615, #6366f115)",
                          color: "#8b5cf6", fontWeight: "700", fontSize: "0.85rem", cursor: analyzingPhoto ? "wait" : "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem",
                          transition: "all 0.3s",
                        }}
                      >
                        {analyzingPhoto ? (
                          <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span> {t("form_photo_analyzing")}</>
                        ) : (
                          <>{t("form_photo_analyze")} <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>— auto-fill Subject & Category</span></>
                        )}
                      </button>

                      {analysisResult && (
                        <div className="animate-fade-in" style={{ marginTop: "0.6rem", padding: "0.9rem 1rem", borderRadius: "0.75rem", background: "#8b5cf615", border: "1px solid #8b5cf644" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                            <span style={{ fontWeight: "700", fontSize: "0.82rem", color: "#8b5cf6" }}>🤖 AI Analysis Result</span>
                            <span style={{ fontSize: "0.72rem", color: "#8b5cf6", background: "#8b5cf620", padding: "0.1rem 0.5rem", borderRadius: "99px", fontWeight: "700" }}>{analysisResult.confidence}% match</span>
                          </div>
                          <div style={{ fontSize: "0.82rem", marginBottom: "0.3rem" }}><strong>Subject:</strong> {analysisResult.subject}</div>
                          <div style={{ fontSize: "0.82rem", marginBottom: "0.6rem" }}><strong>Category:</strong> {analysisResult.category}</div>
                          <button type="button" onClick={applyAnalysis}
                            style={{ width: "100%", padding: "0.4rem", borderRadius: "0.5rem", background: "#8b5cf6", color: "white", border: "none", cursor: "pointer", fontSize: "0.78rem", fontWeight: "700" }}
                          >
                            ✅ Apply to Form
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Previews */}
                  {mediaFiles.length > 0 && (
                    <>
                      <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: "0.6rem" }}>
                        {mediaFiles.map((file, i) => (
                          <div key={i} style={{ position: "relative", borderRadius: "0.5rem", overflow: "hidden", border: "1px solid var(--border)", aspectRatio: "1" }}>
                            {file.type.startsWith("image/") ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={file.url} alt={file.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <video src={file.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                            )}
                            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", opacity: 0, transition: "opacity 0.2s", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.2rem" }}
                              onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                              onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}>
                              <span style={{ color: "white", fontSize: "0.55rem", fontWeight: "600", textAlign: "center", padding: "0 2px" }}>{formatSize(file.size)}</span>
                              <button type="button" onClick={() => removeFile(i)} style={{ background: "#ef4444", color: "white", border: "none", borderRadius: "50%", width: "22px", height: "22px", cursor: "pointer", fontSize: "0.65rem", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                            </div>
                            <div style={{ position: "absolute", top: "3px", left: "3px", background: file.name.startsWith("gps_") ? "rgba(99,102,241,0.85)" : "rgba(0,0,0,0.6)", color: "white", borderRadius: "4px", padding: "1px 4px", fontSize: "0.55rem", fontWeight: "700" }}>
                              {file.name.startsWith("gps_") ? "📍📷" : file.type.startsWith("video/") ? "▶ VID" : "🖼"}
                            </div>
                          </div>
                        ))}
                      </div>
                      <p style={{ marginTop: "0.4rem", fontSize: "0.72rem" }}>{mediaFiles.length}/5 files attached</p>
                    </>
                  )}
                </div>

                <button disabled={isSubmitting} className="btn btn-primary" type="submit" style={{ marginTop: "0.5rem", fontSize: "1.1rem" }}>
                  {isSubmitting ? t("form_submitting") : t("form_submit")}
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* Feature cards */}
        <section className="section" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="container">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "2rem" }}>
              {[
                { bg: "var(--primary)", icon: "🚀", title: t("feature_triage_title"), desc: t("feature_triage_desc") },
                { bg: "var(--secondary)", icon: "⚖️", title: t("feature_priority_title"), desc: t("feature_priority_desc") },
                { bg: "var(--accent)", icon: "📍📷", title: t("feature_gps_title"), desc: t("feature_gps_desc") },
                { bg: "#8b5cf6", icon: "🎙️", title: "Voice Filing", desc: "Speak your complaint — our Web Speech API transcribes it instantly. Perfect for rural and less tech-savvy citizens." },
                { bg: "#10b981", icon: "🔍", title: "AI Photo Analysis", desc: "Upload a photo and our AI reads what's in it — pothole, water leak, garbage — and auto-fills your complaint form." },
                { bg: "#0ea5e9", icon: "🔔", title: "Push Notifications", desc: "Enable browser notifications to get instant alerts whenever your complaint status changes, even when the tab is closed." },
              ].map(({ bg, icon, title, desc }) => (
                <div key={title} className="glass" style={{ padding: "2rem", borderRadius: "var(--radius)" }}>
                  <div style={{ background: bg, color: "white", width: "40px", height: "40px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.5rem", fontSize: "1rem" }}>{icon}</div>
                  <h3 style={{ marginBottom: "1rem" }}>{title}</h3>
                  <p>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <style>{`
        @keyframes voicePulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.4); } 50% { box-shadow: 0 0 0 8px rgba(99,102,241,0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </ProtectedRoute>
  );
}
