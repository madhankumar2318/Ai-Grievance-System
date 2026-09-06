"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getComplaintsServerAction, DbComplaintRecord } from "@/app/actions/complaintActions";

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialComplaints?: any[];
}

function parseCoords(c: { id: string; location?: string | null }): { lat: number; lng: number } {
    let lat = 13.0827; // Default Chennai coordinates
    let lng = 80.2707;

    if (c.location) {
        // 1. Check for decimal GPS format "13.0827, 80.2707"
        const match = c.location.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
        if (match) {
            const pLat = parseFloat(match[1]);
            const pLng = parseFloat(match[2]);
            if (!isNaN(pLat) && !isNaN(pLng) && pLat >= -90 && pLat <= 90 && pLng >= -180 && pLng <= 180) {
                return { lat: pLat, lng: pLng };
            }
        }

        // 2. City landmark detection
        const locLower = c.location.toLowerCase();
        if (locLower.includes("delhi") || locLower.includes("noida") || locLower.includes("gurgaon")) {
            lat = 28.6139; lng = 77.2090;
        } else if (locLower.includes("bangalore") || locLower.includes("bengaluru")) {
            lat = 12.9716; lng = 77.5946;
        } else if (locLower.includes("mumbai") || locLower.includes("thane")) {
            lat = 19.0760; lng = 72.8777;
        } else if (locLower.includes("hyderabad")) {
            lat = 17.3850; lng = 78.4867;
        } else if (locLower.includes("kolkata")) {
            lat = 22.5726; lng = 88.3639;
        } else if (locLower.includes("chennai") || locLower.includes("tamil nadu")) {
            lat = 13.0827; lng = 80.2707;
        }
    }

    // Deterministic jitter based on complaint ID so overlapping pins in the same city are spread out
    const hash = (c.id || "").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const angle = (hash % 360) * (Math.PI / 180);
    const distance = 0.005 + (hash % 25) * 0.001; // ~500m to 2.5km scatter
    lat += Math.sin(angle) * distance;
    lng += Math.cos(angle) * distance;

    return { lat, lng };
}

export default function ComplaintMap({
    title = "🗺️ Live Complaint Map",
    subtitle = "View all active complaints across the city in real time.",
    initialComplaints,
}: Props) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const markersLayerRef = useRef<any>(null);
    const [selected, setSelected] = useState<ComplaintPin | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [pins, setPins] = useState<ComplaintPin[]>([]);
    const [mapLoading, setMapLoading] = useState(true);

    const mapComplaintsToPins = useCallback((list: DbComplaintRecord[]): ComplaintPin[] => {
        return list.map((c) => {
            const { lat, lng } = parseCoords(c);
            const dateStr = c.created_at
                ? new Date(c.created_at).toLocaleDateString("en-IN")
                : new Date().toLocaleDateString("en-IN");
            return {
                id: c.id,
                subject: c.subject || "Civic Complaint",
                category: c.category || "General",
                priority: c.priority || "Medium",
                status: c.status || "Pending",
                location: c.location || "Location recorded",
                lat,
                lng,
                date: dateStr,
                user: c.user_email || "Anonymous",
            };
        });
    }, []);

    // 1. Load complaints from initialComplaints or fetch directly from Supabase
    useEffect(() => {
        setIsClient(true);

        if (initialComplaints && initialComplaints.length > 0) {
            setPins(mapComplaintsToPins(initialComplaints));
            setMapLoading(false);
            return;
        }

        const fetchPins = async () => {
            try {
                const res = await getComplaintsServerAction();
                if (res.success && res.complaints && res.complaints.length > 0) {
                    setPins(mapComplaintsToPins(res.complaints));
                }
            } catch (err) {
                console.error("Error fetching map pins:", err);
            } finally {
                setMapLoading(false);
            }
        };

        fetchPins();
    }, [initialComplaints, mapComplaintsToPins]);

    // 2. Initialize Leaflet Map ONCE on client mount
    useEffect(() => {
        if (!isClient || !mapRef.current || mapInstanceRef.current) return;

        let isCancelled = false;

        import("leaflet").then((L) => {
            if (isCancelled || !mapRef.current || mapInstanceRef.current) return;

            // Fix default leaflet icons
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (L.Icon.Default.prototype as any)._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
                iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
                shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
            });

            // Determine initial map center
            const defaultCenter: [number, number] = [13.0827, 80.2707];

            const map = L.map(mapRef.current, {
                center: defaultCenter,
                zoom: 12,
                zoomControl: true,
                scrollWheelZoom: false,
            });

            // OpenStreetMap tile layer with high-reliability CDN
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19,
            }).addTo(map);

            // Layer group for pin markers
            const markersLayer = L.layerGroup().addTo(map);
            markersLayerRef.current = markersLayer;
            mapInstanceRef.current = map;

            // Invalidate size after layout settles to guarantee tiles render
            setTimeout(() => {
                map.invalidateSize();
            }, 200);
            setTimeout(() => {
                map.invalidateSize();
            }, 600);
        });

        return () => {
            isCancelled = true;
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
                markersLayerRef.current = null;
            }
        };
    }, [isClient]);

    // 3. Update Markers whenever pins change
    useEffect(() => {
        if (!mapInstanceRef.current || !markersLayerRef.current || pins.length === 0) return;

        import("leaflet").then((L) => {
            const map = mapInstanceRef.current;
            const markersLayer = markersLayerRef.current;
            if (!map || !markersLayer) return;

            markersLayer.clearLayers();
            const coords: [number, number][] = [];

            pins.forEach((pin) => {
                const color = PRIORITY_COLORS[pin.priority] || "#6366f1";
                const statusColor = STATUS_COLORS[pin.status] || "#f59e0b";
                coords.push([pin.lat, pin.lng]);

                const svgIcon = L.divIcon({
                    html: `
            <div style="
              position:relative;
              width:34px;height:34px;
              background:${color};
              border-radius:50% 50% 50% 0;
              transform:rotate(-45deg);
              border:2.5px solid white;
              box-shadow:0 3px 12px rgba(0,0,0,0.4);
              display:flex;align-items:center;justify-content:center;
              cursor:pointer;
              transition:transform 0.15s ease;
            ">
              <div style="
                transform:rotate(45deg);
                font-size:13px;line-height:1;
                color:white;font-weight:800;
              ">${pin.priority === "Critical" ? "🚨" : pin.priority === "High" ? "⚠️" : pin.priority === "Medium" ? "📍" : "✅"}</div>
            </div>
            <div style="
              position:absolute;bottom:-5px;left:50%;
              transform:translateX(-50%);
              width:7px;height:7px;
              border-radius:50%;
              background:${statusColor};
              border:1.5px solid white;
              box-shadow:0 0 6px ${statusColor};
            "></div>
          `,
                    className: "",
                    iconSize: [34, 44],
                    iconAnchor: [17, 44],
                    popupAnchor: [0, -48],
                });

                const marker = L.marker([pin.lat, pin.lng], { icon: svgIcon }).addTo(markersLayer);
                marker.on("click", () => {
                    setSelected(pin);
                });

                marker.bindTooltip(`
                    <div style="font-weight:700;font-size:0.8rem;margin-bottom:2px;">${pin.id}</div>
                    <div style="font-size:0.75rem;color:#334155;margin-bottom:2px;">${pin.subject}</div>
                    <div style="font-weight:700;font-size:0.72rem;color:${color};">${pin.priority} • ${pin.status}</div>
                `, {
                    direction: "top",
                    className: "leaflet-tooltip-custom",
                });
            });

            // Fit bounds to show all pins
            if (coords.length > 0) {
                map.fitBounds(L.latLngBounds(coords), { padding: [50, 50], maxZoom: 14 });
            }

            map.invalidateSize();
        });
    }, [pins]);

    return (
        <div style={{ fontFamily: "inherit" }}>
            {/* Header */}
            <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <h2 style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", marginBottom: "0.4rem" }}>{title}</h2>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.92rem" }}>{subtitle}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: "700", color: "var(--primary)" }}>
                        📍 {pins.length} Grievance{pins.length !== 1 ? "s" : ""} Plotted
                    </span>
                </div>
            </div>

            {/* Legend */}
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--text-muted)" }}>Priority:</span>
                {Object.entries(PRIORITY_COLORS).map(([p, c]) => (
                    <div key={p} style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.78rem", fontWeight: "600" }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: c, boxShadow: `0 0 6px ${c}` }} />
                        {p}
                    </div>
                ))}
                <div style={{ marginLeft: "auto", display: "flex", gap: "1rem", alignItems: "center" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--text-muted)" }}>Status:</span>
                    {Object.entries(STATUS_COLORS).map(([s, c]) => (
                        <div key={s} style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
                            {s}
                        </div>
                    ))}
                </div>
            </div>

            {/* Map Container */}
            <div style={{ position: "relative", borderRadius: "1.25rem", overflow: "hidden", border: "1px solid var(--border)", boxShadow: "0 20px 40px -10px rgba(0,0,0,0.15)", background: "#111" }}>
                <div ref={mapRef} style={{ height: "460px", width: "100%", zIndex: 1 }} />

                {/* Loading indicator */}
                {mapLoading && (
                    <div style={{
                        position: "absolute", inset: 0,
                        background: "rgba(15,15,26,0.7)",
                        backdropFilter: "blur(4px)",
                        display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center",
                        gap: "0.75rem", zIndex: 900,
                    }}>
                        <div style={{ fontSize: "2rem", animation: "spin 1s linear infinite" }}>⏳</div>
                        <p style={{ fontSize: "0.88rem", fontWeight: "600", color: "#e2e8f0" }}>Loading satellite &amp; complaints coordinates...</p>
                    </div>
                )}

                {/* Selected Complaint Card Overlay */}
                {selected && (
                    <div style={{
                        position: "absolute", bottom: "1rem", left: "1rem", right: "1rem",
                        zIndex: 1000, maxWidth: "420px", margin: "0 auto",
                    }}>
                        <div className="glass animate-fade-in" style={{
                            padding: "1.25rem", borderRadius: "1rem",
                            borderLeft: `4px solid ${PRIORITY_COLORS[selected.priority] || "#6366f1"}`,
                            boxShadow: "0 12px 36px rgba(0,0,0,0.35)",
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                                <div>
                                    <div style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>{selected.id}</div>
                                    <div style={{ fontWeight: "700", fontSize: "1rem", lineHeight: 1.3 }}>{selected.subject}</div>
                                </div>
                                <button
                                    onClick={() => setSelected(null)}
                                    style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "var(--text-muted)", flexShrink: 0, padding: "0 0.25rem" }}
                                >✕</button>
                            </div>
                            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                                <span style={{ padding: "0.2rem 0.65rem", borderRadius: "99px", fontSize: "0.7rem", fontWeight: "700", background: `${PRIORITY_COLORS[selected.priority]}22`, color: PRIORITY_COLORS[selected.priority], border: `1px solid ${PRIORITY_COLORS[selected.priority]}44` }}>
                                    {selected.priority}
                                </span>
                                <span style={{ padding: "0.2rem 0.65rem", borderRadius: "99px", fontSize: "0.7rem", fontWeight: "700", background: `${STATUS_COLORS[selected.status] || "#6366f1"}22`, color: STATUS_COLORS[selected.status] || "#6366f1", border: `1px solid ${STATUS_COLORS[selected.status] || "#6366f1"}44` }}>
                                    ● {selected.status}
                                </span>
                                <span style={{ padding: "0.2rem 0.65rem", borderRadius: "99px", fontSize: "0.7rem", background: "var(--bg-main)", color: "var(--text-muted)", fontWeight: "600" }}>
                                    {selected.category}
                                </span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                                <span>📍 {selected.location}</span>
                                <span>📅 Filed on {selected.date} • {selected.user}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .leaflet-tooltip-custom {
                    background: #ffffff !important;
                    border: 1px solid #cbd5e1 !important;
                    border-radius: 8px !important;
                    padding: 0.5rem 0.75rem !important;
                    box-shadow: 0 6px 18px rgba(0,0,0,0.15) !important;
                    color: #0f172a !important;
                }
                .leaflet-container {
                    font-family: inherit !important;
                    background: #0f1523 !important;
                }
            `}</style>
        </div>
    );
}
