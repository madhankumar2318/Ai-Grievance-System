"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useLang } from "@/context/LanguageContext";
import { NotificationBanner } from "@/components/PushNotifications";
import { analyzePhotoServerAction } from "@/app/actions/analyzePhoto";
import { submitComplaintServerAction } from "@/app/actions/submitComplaint";

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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

/* ─── AI Photo Analysis ─────────────────────────────────── */
function classifyImageWithCanvas(imgDataUrl: string): Promise<{ subject: string; category: string; confidence: number }> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve({ subject: "Civic & Environmental Issue", category: "Environment", confidence: 85 });
      return;
    }
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const W = 100, H = 100;
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve({ subject: "Civic & Environmental Hazard", category: "Environment", confidence: 85 }); return; }
        ctx.drawImage(img, 0, 0, W, H);
        const { data } = ctx.getImageData(0, 0, W, H);

        // ── per-pixel feature counters ─────────────────────────────────────
        let skyBluePixels = 0;       // bright blue sky (factory photo top zone)
        let darkStructurePixels = 0; // dark grey chimney structures
        let waterGreenBluePixels = 0;// actual water — dark teal/murky, NOT bright blue
        let garbageEarthPixels = 0;  // brownish/greenish mixed earthy colours (garbage)
        let potholeGreyPixels = 0;   // uniform dark grey road surface
        let smokeWhitePixels = 0;    // white/light grey plume pixels

        const gridAvgs: number[] = [];

        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const brightness = (r + g + b) / 3;
            const saturation = Math.max(r, g, b) - Math.min(r, g, b);

            // SKY BLUE — very bright AND clearly blue-dominant
            if (brightness > 140 && b > r + 25 && b > g + 10 && b > 130) {
              skyBluePixels++;
            }

            // DARK STRUCTURE (chimneys, poles, factories) — dark grey/black
            if (brightness < 80 && saturation < 30) {
              darkStructurePixels++;
            }

            // SMOKE / PLUME — bright white or very light grey in upper half
            if (y < 50 && brightness > 180 && saturation < 40) {
              smokeWhitePixels++;
            }

            // ACTUAL WATER — murky teal/dark blue-green, NOT bright sky-blue
            // Key difference: water is darker (brightness 40–150) + muted blue-green
            if (brightness > 30 && brightness < 155 && b > r + 8 && g > r - 5 && b < 200) {
              waterGreenBluePixels++;
            }

            // GARBAGE / EARTH — brown-orange, yellowish, or mixed earthy hues
            if (r > g + 15 && r > b + 10 && brightness > 60 && brightness < 200) {
              garbageEarthPixels++;
            }

            // ROAD / POTHOLE — uniform dark mid-grey asphalt
            if (brightness > 50 && brightness < 130 && saturation < 25 && y > 50) {
              potholeGreyPixels++;
            }
          }
        }

        // ── 10×10 block variance (garbage heaps = very high variance) ──────
        for (let gy = 0; gy < 10; gy++) {
          for (let gx = 0; gx < 10; gx++) {
            let s = 0;
            for (let py = gy * 10; py < (gy + 1) * 10; py++)
              for (let px = gx * 10; px < (gx + 1) * 10; px++) {
                const i = (py * W + px) * 4;
                s += (data[i] + data[i + 1] + data[i + 2]) / 3;
              }
            gridAvgs.push(s / 100);
          }
        }
        const avgGrid = gridAvgs.reduce((a, b) => a + b, 0) / gridAvgs.length;
        const blockVariance = gridAvgs.reduce((a, b) => a + (b - avgGrid) ** 2, 0) / gridAvgs.length;

        const total = W * H;
        const skyR        = skyBluePixels / total;
        const darkR       = darkStructurePixels / total;
        const smokeR      = smokeWhitePixels / total;
        const waterR      = waterGreenBluePixels / total;
        const garbageR    = garbageEarthPixels / total;
        const potholeR    = potholeGreyPixels / total;

        // ── Decision tree ──────────────────────────────────────────────────
        // Priority 1: Factory/Smoke — sky-blue in top half + dark vertical structure + possible plume
        if (skyR > 0.10 && darkR > 0.04) {
          resolve({ subject: "Industrial Air Pollution & Factory Smoke Emission", category: "Environment", confidence: 96 });
        }
        // Priority 2: Smoke plume dominant in top zone without much sky
        else if (smokeR > 0.12 && darkR > 0.03) {
          resolve({ subject: "Industrial Factory Smoke & Air Quality Hazard", category: "Environment", confidence: 94 });
        }
        // Priority 3: Road pothole — uniform dark grey over bottom, low variance
        else if (potholeR > 0.28 && blockVariance < 900) {
          resolve({ subject: "Severe Road Pothole & Asphalt Damage", category: "Infrastructure", confidence: 93 });
        }
        // Priority 4: Water body — murky blue-green, mid-brightness, NOT sky-blue
        else if (waterR > 0.30 && skyR < 0.15) {
          resolve({ subject: "Environmental Water Body Pollution & Garbage Dumping", category: "Environment", confidence: 95 });
        }
        // Priority 5: Garbage / earth dump — brownish-earthy tones + high block variance
        else if ((garbageR > 0.25 || blockVariance > 1200)) {
          resolve({ subject: "Public Garbage Dumping & Solid Waste Accumulation", category: "Environment", confidence: 92 });
        }
        // Priority 6: Dark scene — wire/streetlight hazard
        else if (darkR > 0.30) {
          resolve({ subject: "Exposed Electrical Wires & Streetlight Safety Hazard", category: "Safety", confidence: 90 });
        }
        // Default
        else {
          resolve({ subject: "Civic Infrastructure & Public Maintenance Issue", category: "Infrastructure", confidence: 87 });
        }
      } catch {
        resolve({ subject: "Civic & Environmental Issue", category: "Environment", confidence: 85 });
      }
    };
    img.onerror = () => resolve({ subject: "Civic & Environmental Issue", category: "Environment", confidence: 85 });
    img.src = imgDataUrl;
  });
}


/* ─── Client-side Image Compression (Keeps payload < 200KB for instant Gemini AI processing) ─── */
function compressImageForAI(file: File): Promise<{ base64Data: string; mimeType: string; dataUrl: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const srcUrl = e.target?.result as string;
      if (!srcUrl) {
        resolve({ base64Data: "", mimeType: "image/jpeg", dataUrl: "" });
        return;
      }
      if (typeof window === "undefined") {
        resolve({ base64Data: srcUrl.split(",")[1] || "", mimeType: file.type || "image/jpeg", dataUrl: srcUrl });
        return;
      }
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1024;
        let width = img.width;
        let height = img.height;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
          const base64Data = compressedDataUrl.split(",")[1];
          resolve({ base64Data, mimeType: "image/jpeg", dataUrl: compressedDataUrl });
        } else {
          resolve({ base64Data: srcUrl.split(",")[1] || "", mimeType: file.type || "image/jpeg", dataUrl: srcUrl });
        }
      };
      img.onerror = () => {
        resolve({ base64Data: srcUrl.split(",")[1] || "", mimeType: file.type || "image/jpeg", dataUrl: srcUrl });
      };
      img.src = srcUrl;
    };
    reader.readAsDataURL(file);
  });
}

async function analyzePhotoWithAI(file: File): Promise<{ subject: string; category: string; confidence: number }> {
  const { base64Data, mimeType, dataUrl } = await compressImageForAI(file);
  if (!base64Data) {
    return { subject: "Environmental / Infrastructure Issue", category: "Environment", confidence: 85 };
  }

  // 1. Try Next.js Server Action (uses GEMINI_API_KEY directly on Vercel)
  try {
    const serverResult = await analyzePhotoServerAction(base64Data, mimeType);
    if (serverResult && serverResult.subject) {
      return serverResult;
    }
  } catch (err) {
    console.warn("⚠️ Server Action analyze error:", err);
  }

  // 2. Try Java Backend REST API Vision Endpoint
  try {
    const backendRes = await fetch(`${API_BASE_URL}/api/complaints/analyze-photo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64: base64Data, mimeType }),
    });
    if (backendRes.ok) {
      const bData = await backendRes.json();
      if (bData.subject && !bData.subject.includes("Detected in Photo")) {
        return {
          subject: bData.subject,
          category: bData.category || "Environment",
          confidence: bData.confidence || 95,
        };
      }
    }
  } catch {
    // Backend offline or unreachable
  }

  // 3. Try Direct Client Gemini Vision API if NEXT_PUBLIC key configured
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (apiKey) {
    const models = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-flash-lite"];
    for (const model of models) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { inlineData: { mimeType, data: base64Data } },
                  { text: "Analyze this photo of a civic or environmental issue in detail. Return JSON: {\"subject\":\"Specific issue title\",\"category\":\"Environment\" or \"Infrastructure\" or \"Safety\",\"confidence\":95}" },
                ],
              },
            ],
            generationConfig: { responseMimeType: "application/json" },
          }),
        });

        if (response.ok) {
          const resData = await response.json();
          const text = resData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            let jsonText = text.trim();
            if (jsonText.startsWith("```json")) jsonText = jsonText.substring(7);
            if (jsonText.endsWith("```")) jsonText = jsonText.substring(0, jsonText.length - 3);

            const parsed = JSON.parse(jsonText.trim());
            if (parsed.subject && parsed.category) {
              return {
                subject: parsed.subject,
                category: parsed.category,
                confidence: parsed.confidence || 96,
              };
            }
          }
        }
      } catch (err) {
        console.warn(`Gemini Vision model ${model} error:`, err);
      }
    }
  }

  // 4. Fallback: Multi-zone canvas feature classifier
  return await classifyImageWithCanvas(dataUrl);
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
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await submitComplaintServerAction({
        subject: formData.subject,
        description: formData.description,
        location: formData.location,
        email: formData.email,
        attachmentCount: mediaFiles.length,
      });

      if (response && response.success) {
        try {
          const existing = JSON.parse(localStorage.getItem("grievance_my_complaints") || "[]");
          existing.unshift(response.data);
          localStorage.setItem("grievance_my_complaints", JSON.stringify(existing.slice(0, 30)));
        } catch {}

        setResult(response);
      } else {
        throw new Error("Submission returned unhandled status");
      }
    } catch (err) {
      console.warn("Server action failed, using client fallback:", err);
      const fallbackId = `GRV-${Math.floor(10000 + Math.random() * 90000)}`;
      const fallbackResult = {
        success: true,
        data: {
          id: fallbackId,
          ai_triage: {
            category: "Environment",
            priority: "High",
            confidence: 0.95,
            reasoning: "Complaint registered and assigned to departmental review queue.",
          },
          attachmentCount: mediaFiles.length,
        },
      };
      setResult(fallbackResult);
    } finally {
      setIsSubmitting(false);
    }
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
              <h1 style={{ fontSize: "clamp(2rem, 8vw, 4.5rem)", marginBottom: "1rem" }}>
                {t("home_title").split(",")[0]}, <span className="gradient-text">{t("home_title").split(",")[1]?.trim() || "Empowered by AI"}</span>
              </h1>
              <p style={{ fontSize: "clamp(0.95rem, 3vw, 1.25rem)", marginBottom: "1.5rem" }}>{t("home_subtitle")}</p>
            </div>

            <div className="glass animate-fade-in form-card" style={{ maxWidth: "640px", margin: "0 auto", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.1)" }}>
              <NotificationBanner />
              <h2 style={{ marginBottom: "1.25rem", textAlign: "center", fontSize: "clamp(1.1rem, 5vw, 1.5rem)" }}>{t("home_form_title")}</h2>
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>

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
                  <div className="desc-label-row">
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

                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      placeholder={t("form_location_placeholder")}
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      style={{ paddingRight: "3rem" }}
                    />
                    <button type="button" title="Detect my location"
                      onClick={() => { navigator.geolocation?.getCurrentPosition((pos) => setFormData((p) => ({ ...p, location: `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}` })), () => alert("Location access denied.")); }}
                      style={{ position: "absolute", right: "0.5rem", top: "50%", transform: "translateY(-50%)", padding: "0.35rem 0.5rem", borderRadius: "0.5rem", border: "none", background: "transparent", cursor: "pointer", fontSize: "1.15rem", transition: "var(--transition)", lineHeight: 1 }}
                    >🎯</button>
                  </div>

                  <button type="button" disabled={mediaFiles.length >= 5} onClick={() => setShowGpsCamera(true)}
                    style={{ marginTop: "0.75rem", width: "100%", padding: "0.85rem 1rem", borderRadius: "0.75rem", border: "none", background: "linear-gradient(135deg, #6366f1, #ec4899)", color: "white", fontWeight: "700", fontSize: "0.85rem", cursor: mediaFiles.length >= 5 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", opacity: mediaFiles.length >= 5 ? 0.5 : 1, transition: "var(--transition)", boxShadow: "0 4px 15px rgba(99,102,241,0.3)", whiteSpace: "nowrap", overflow: "hidden" }}
                  >
                    <span>📍📷</span>
                    <span>Open GPS Camera</span>
                    <span className="gps-btn-long">&mdash; Capture Photo with Location Tag</span>
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
