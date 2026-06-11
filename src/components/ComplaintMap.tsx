"use client";

import { useEffect, useRef, useState } from "react";

interface ComplaintPin {
    id: string;
    subject: string;
    category: string;
    priority: string;
    status: string;
    location: string;
    lat: number;
    lng: number;
    date: string;
    user: string;
}


const PRIORITY_COLORS: Record<string, string> = {
    Critical: "#ef4444",
    High: "#f97316",
    Medium: "#f59e0b",
    Low: "#10b981",
};

const STATUS_COLORS: Record<string, string> = {
    Pending: "#f59e0b",
    "In Progress": "#6366f1",
    Resolved: "#10b981",
};

interface Props {
    title?: string;
    subtitle?: string;
}

export default function ComplaintMap({ title = "🗺️ Live Complaint Map", subtitle = "View all active complaints across the city in real time." }: Props) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
    const [selected, setSelected] = useState<ComplaintPin | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [pins, setPins] = useState<ComplaintPin[]>([]);

    useEffect(() => {
        setIsClient(true);
        const fetchPins = async () => {
            try {
                const { supabase } = await import("@/lib/supabase");
                const { data } = await supabase.from("complaints").select("*");
                if (data) {
                    const parsed = data.map((c: { id: string; subject: string; category: string; priority: string; status: string; location: string | null; created_at: string; user_email: string | null }) => {
                        let lat = 28.6139;
                        let lng = 77.2090;
                        const coords = c.location ? c.location.split(",") : [];
                        if (coords.length === 2) {
                            const parsedLat = parseFloat(coords[0]);
                            const parsedLng = parseFloat(coords[1]);
                            if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
                                lat = parsedLat;
                                lng = parsedLng;
                            }
                        } else {
                            const hash = c.id.split("-")[1] ? parseInt(c.id.split("-")[1]) : 12000;
                            lat = 28.6000 + (hash % 100) * 0.0004;
                            lng = 77.2000 + (hash % 70) * 0.0005;
                        }
                        return {
                            id: c.id,
                            subject: c.subject,
                            category: c.category,
                            priority: c.priority,
                            status: c.status,
                            location: c.location || "Unknown",
                            lat,
                            lng,
                            date: new Date(c.created_at).toLocaleDateString("en-IN"),
                            user: c.user_email || "Anonymous"
                        };
                    });
                    setPins(parsed);
                }
            } catch (err) {
                console.error("Error fetching map pins:", err);
            }
        };
        fetchPins();
    }, []);

    useEffect(() => {
        if (!isClient || !mapRef.current || mapInstanceRef.current || pins.length === 0) return;

        // Dynamically import leaflet (client-only)
        import("leaflet").then((L) => {
            // Fix default icon
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (L.Icon.Default.prototype as any)._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
                iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
                shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
            });

            const map = L.map(mapRef.current!, {
                center: [28.6139, 77.2090],
                zoom: 13,
                zoomControl: true,
            });

            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
                maxZoom: 19,
            }).addTo(map);

            pins.forEach((pin) => {
                const color = PRIORITY_COLORS[pin.priority] || "#6366f1";
                const statusColor = STATUS_COLORS[pin.status] || "#6366f1";

                const svgIcon = L.divIcon({
                    html: `
            <div style="
              position:relative;
              width:36px;height:36px;
              background:${color};
              border-radius:50% 50% 50% 0;
              transform:rotate(-45deg);
              border:3px solid white;
              box-shadow:0 3px 14px rgba(0,0,0,0.4);
              display:flex;align-items:center;justify-content:center;
            ">
              <div style="
                transform:rotate(45deg);
                font-size:14px;line-height:1;
                color:white;font-weight:800;
              ">${pin.priority === "Critical" ? "🚨" : pin.priority === "High" ? "⚠️" : pin.priority === "Medium" ? "📍" : "✅"}</div>
            </div>
            <div style="
              position:absolute;bottom:-6px;left:50%;
              transform:translateX(-50%);
              width:8px;height:8px;
              border-radius:50%;
              background:${statusColor};
              border:2px solid white;
              box-shadow:0 0 6px ${statusColor};
            "></div>
          `,
                    className: "",
                    iconSize: [36, 46],
                    iconAnchor: [18, 46],
                    popupAnchor: [0, -50],
                });

                const marker = L.marker([pin.lat, pin.lng], { icon: svgIcon }).addTo(map);
                marker.on("click", () => {
                    setSelected(pin);
                });

                marker.bindTooltip(`<strong>${pin.id}</strong><br/>${pin.subject}<br/><span style="color:${color}">${pin.priority}</span>`, {
                    direction: "top",
                    className: "leaflet-tooltip-custom",
                });
            });

            mapInstanceRef.current = map;
        });

        return () => {
            mapInstanceRef.current?.remove();
            mapInstanceRef.current = null;
        };
    }, [isClient, pins]);

    return (
        <div style={{ fontFamily: "inherit" }}>
            {/* Header */}
            <div style={{ marginBottom: "1.5rem" }}>
                <h2 style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", marginBottom: "0.5rem" }}>{title}</h2>
                <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>{subtitle}</p>
            </div>

            {/* Legend */}
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                {Object.entries(PRIORITY_COLORS).map(([p, c]) => (
                    <div key={p} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", fontWeight: "600" }}>
                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: c, boxShadow: `0 0 6px ${c}` }} />
                        {p}
                    </div>
                ))}
                <div style={{ marginLeft: "auto", display: "flex", gap: "1rem" }}>
                    {Object.entries(STATUS_COLORS).map(([s, c]) => (
                        <div key={s} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
                            {s}
                        </div>
                    ))}
                </div>
            </div>

            {/* Map Container */}
            <div style={{ position: "relative", borderRadius: "1rem", overflow: "hidden", border: "1px solid var(--border)", boxShadow: "0 20px 40px -10px rgba(0,0,0,0.15)" }}>
                <div ref={mapRef} style={{ height: "450px", width: "100%" }} />

                {/* Selected Complaint Popup */}
                {selected && (
                    <div style={{
                        position: "absolute", bottom: "1rem", left: "1rem", right: "1rem",
                        zIndex: 1000, maxWidth: "400px", margin: "0 auto",
                    }}>
                        <div className="glass" style={{
                            padding: "1.25rem", borderRadius: "1rem",
                            borderLeft: `4px solid ${PRIORITY_COLORS[selected.priority]}`,
                            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                                <div>
                                    <div style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>{selected.id}</div>
                                    <div style={{ fontWeight: "700", fontSize: "1rem" }}>{selected.subject}</div>
                                </div>
                                <button
                                    onClick={() => setSelected(null)}
                                    style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "var(--text-muted)", flexShrink: 0 }}
                                >✕</button>
                            </div>
                            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                                <span style={{ padding: "0.2rem 0.7rem", borderRadius: "99px", fontSize: "0.7rem", fontWeight: "700", background: `${PRIORITY_COLORS[selected.priority]}22`, color: PRIORITY_COLORS[selected.priority], border: `1px solid ${PRIORITY_COLORS[selected.priority]}44` }}>
                                    {selected.priority}
                                </span>
                                <span style={{ padding: "0.2rem 0.7rem", borderRadius: "99px", fontSize: "0.7rem", fontWeight: "700", background: `${STATUS_COLORS[selected.status]}22`, color: STATUS_COLORS[selected.status], border: `1px solid ${STATUS_COLORS[selected.status]}44` }}>
                                    ● {selected.status}
                                </span>
                                <span style={{ padding: "0.2rem 0.7rem", borderRadius: "99px", fontSize: "0.7rem", background: "var(--bg-main)", color: "var(--text-muted)", fontWeight: "600" }}>
                                    {selected.category}
                                </span>
                            </div>
                            <div style={{ display: "flex", gap: "1rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                                <span>📍 {selected.location}</span>
                                <span>📅 {selected.date}</span>
                                <span>👤 {selected.user}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
        .leaflet-tooltip-custom {
          background: var(--bg-card, #fff);
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 8px;
          padding: 0.5rem 0.75rem;
          font-size: 0.8rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .leaflet-container {
          font-family: inherit !important;
        }
      `}</style>
        </div>
    );
}
