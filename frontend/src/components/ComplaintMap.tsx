"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { getComplaintsServerAction, DbComplaintRecord } from "@/app/actions/complaintActions";

interface ComplaintPin {
    id: string;
    subject: string;
    category: string;
    priority: string;
    status: string;
    location: string;
    districtName: string;
    baseLat: number;
    baseLng: number;
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

function escapeHtml(str: string): string {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* ── Comprehensive District & City Geocoding Dictionary ──────────────────── */
const DISTRICT_COORDS: Record<string, { lat: number; lng: number; displayName: string }> = {
    // Tamil Nadu Districts & Hubs
    "tiruchirappalli": { lat: 10.7905, lng: 78.7047, displayName: "Tiruchirappalli" },
    "trichy": { lat: 10.7905, lng: 78.7047, displayName: "Tiruchirappalli" },
    "coimbatore": { lat: 11.0168, lng: 76.9558, displayName: "Coimbatore" },
    "tiruppur": { lat: 11.1085, lng: 77.3411, displayName: "Tiruppur" },
    "chennai": { lat: 13.0827, lng: 80.2707, displayName: "Chennai" },
    "madurai": { lat: 9.9252, lng: 78.1198, displayName: "Madurai" },
    "salem": { lat: 11.6643, lng: 78.1460, displayName: "Salem" },
    "erode": { lat: 11.3410, lng: 77.7172, displayName: "Erode" },
    "thanjavur": { lat: 10.7870, lng: 79.1378, displayName: "Thanjavur" },
    "dindigul": { lat: 10.3673, lng: 77.9803, displayName: "Dindigul" },
    "tirunelveli": { lat: 8.7139, lng: 77.7567, displayName: "Tirunelveli" },
    "vellore": { lat: 12.9165, lng: 79.1325, displayName: "Vellore" },
    "kancheepuram": { lat: 12.8342, lng: 79.7036, displayName: "Kancheepuram" },
    "kanchipuram": { lat: 12.8342, lng: 79.7036, displayName: "Kancheepuram" },
    "chengalpattu": { lat: 12.6841, lng: 79.9836, displayName: "Chengalpattu" },
    "cuddalore": { lat: 11.7480, lng: 79.7714, displayName: "Cuddalore" },
    "dharmapuri": { lat: 12.1211, lng: 78.1582, displayName: "Dharmapuri" },
    "karur": { lat: 10.9601, lng: 78.0766, displayName: "Karur" },
    "krishnagiri": { lat: 12.5186, lng: 78.2137, displayName: "Krishnagiri" },
    "hosur": { lat: 12.7409, lng: 77.8253, displayName: "Hosur" },
    "nagapattinam": { lat: 10.7672, lng: 79.8449, displayName: "Nagapattinam" },
    "namakkal": { lat: 11.2189, lng: 78.1674, displayName: "Namakkal" },
    "nilgiris": { lat: 11.4102, lng: 76.6950, displayName: "Nilgiris" },
    "ooty": { lat: 11.4102, lng: 76.6950, displayName: "Nilgiris" },
    "perambalur": { lat: 11.2342, lng: 78.8820, displayName: "Perambalur" },
    "pudukkottai": { lat: 10.3833, lng: 78.8001, displayName: "Pudukkottai" },
    "ramanathapuram": { lat: 9.3639, lng: 78.8395, displayName: "Ramanathapuram" },
    "ranipet": { lat: 12.9272, lng: 79.3330, displayName: "Ranipet" },
    "sivaganga": { lat: 9.8433, lng: 78.4809, displayName: "Sivaganga" },
    "tenkasi": { lat: 8.9594, lng: 77.3150, displayName: "Tenkasi" },
    "theni": { lat: 10.0104, lng: 77.4768, displayName: "Theni" },
    "thoothukudi": { lat: 8.7642, lng: 78.1348, displayName: "Thoothukudi" },
    "tuticorin": { lat: 8.7642, lng: 78.1348, displayName: "Thoothukudi" },
    "tirupathur": { lat: 12.4967, lng: 78.5678, displayName: "Tirupathur" },
    "tiruvallur": { lat: 13.1432, lng: 79.9079, displayName: "Tiruvallur" },
    "tiruvannamalai": { lat: 12.2253, lng: 79.0747, displayName: "Tiruvannamalai" },
    "tiruvarur": { lat: 10.7712, lng: 79.6365, displayName: "Tiruvarur" },
    "viluppuram": { lat: 11.9401, lng: 79.4861, displayName: "Viluppuram" },
    "villupuram": { lat: 11.9401, lng: 79.4861, displayName: "Viluppuram" },
    "virudhunagar": { lat: 9.5680, lng: 77.9624, displayName: "Virudhunagar" },
    "kanyakumari": { lat: 8.0883, lng: 77.5385, displayName: "Kanyakumari" },
    "nagercoil": { lat: 8.1833, lng: 77.4119, displayName: "Kanyakumari" },
    "ariyalur": { lat: 11.1401, lng: 79.0786, displayName: "Ariyalur" },
    "kallakurichi": { lat: 11.7383, lng: 78.9639, displayName: "Kallakurichi" },
    "mayiladuthurai": { lat: 11.1075, lng: 79.6524, displayName: "Mayiladuthurai" },
    "pollachi": { lat: 10.6609, lng: 77.0048, displayName: "Coimbatore" },
    "kumbakonam": { lat: 10.9602, lng: 79.3845, displayName: "Thanjavur" },
    "srirangam": { lat: 10.8624, lng: 78.6923, displayName: "Tiruchirappalli" },

    // National Metros & Capitals
    "bengaluru": { lat: 12.9716, lng: 77.5946, displayName: "Bengaluru" },
    "bangalore": { lat: 12.9716, lng: 77.5946, displayName: "Bengaluru" },
    "delhi": { lat: 28.6139, lng: 77.2090, displayName: "Delhi" },
    "new delhi": { lat: 28.6139, lng: 77.2090, displayName: "Delhi" },
    "noida": { lat: 28.5355, lng: 77.3910, displayName: "Delhi NCR" },
    "gurgaon": { lat: 28.4595, lng: 77.0266, displayName: "Delhi NCR" },
    "gurugram": { lat: 28.4595, lng: 77.0266, displayName: "Delhi NCR" },
    "mumbai": { lat: 19.0760, lng: 72.8777, displayName: "Mumbai" },
    "pune": { lat: 18.5204, lng: 73.8567, displayName: "Pune" },
    "hyderabad": { lat: 17.3850, lng: 78.4867, displayName: "Hyderabad" },
    "kolkata": { lat: 22.5726, lng: 88.3639, displayName: "Kolkata" },
    "kochi": { lat: 9.9312, lng: 76.2673, displayName: "Kochi" },
    "ernakulam": { lat: 9.9816, lng: 76.2999, displayName: "Kochi" },
    "thiruvananthapuram": { lat: 8.5241, lng: 76.9366, displayName: "Thiruvananthapuram" },
};

function parseBaseCoords(c: { id: string; location?: string | null }): { lat: number; lng: number; districtName: string } {
    let lat = 10.7905; // Default central Tamil Nadu (Tiruchirappalli)
    let lng = 78.7047;
    let districtName = "Tiruchirappalli";

    if (c.location) {
        // 1. Check for decimal GPS format "10.95181, 78.44000"
        const match = c.location.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
        if (match) {
            const pLat = parseFloat(match[1]);
            const pLng = parseFloat(match[2]);
            if (!isNaN(pLat) && !isNaN(pLng) && pLat >= -90 && pLat <= 90 && pLng >= -180 && pLng <= 180) {
                // If coordinates are near Trichy (lat ~10.7 - 11.1, lng ~78.2 - 79.0)
                if (Math.abs(pLat - 10.79) < 0.5 && Math.abs(pLng - 78.70) < 0.5) {
                    districtName = "Tiruchirappalli";
                } else if (Math.abs(pLat - 11.01) < 0.5 && Math.abs(pLng - 76.95) < 0.5) {
                    districtName = "Coimbatore";
                } else if (Math.abs(pLat - 11.10) < 0.5 && Math.abs(pLng - 77.34) < 0.5) {
                    districtName = "Tiruppur";
                } else if (Math.abs(pLat - 13.08) < 0.5 && Math.abs(pLng - 80.27) < 0.5) {
                    districtName = "Chennai";
                } else if (Math.abs(pLat - 9.92) < 0.5 && Math.abs(pLng - 78.11) < 0.5) {
                    districtName = "Madurai";
                } else if (Math.abs(pLat - 11.66) < 0.5 && Math.abs(pLng - 78.14) < 0.5) {
                    districtName = "Salem";
                } else {
                    districtName = "Tamil Nadu";
                }
                return { lat: pLat, lng: pLng, districtName };
            }
        }

        // 2. Named District / City detection (sort keys longest first to match "tiruchirappalli" before "trichy")
        const locLower = c.location.toLowerCase();
        const sortedKeys = Object.keys(DISTRICT_COORDS).sort((a, b) => b.length - a.length);

        for (const key of sortedKeys) {
            if (locLower.includes(key)) {
                const matchData = DISTRICT_COORDS[key];
                return { lat: matchData.lat, lng: matchData.lng, districtName: matchData.displayName };
            }
        }

        // If only generic "tamil nadu" is mentioned
        if (locLower.includes("tamil nadu")) {
            return { lat: 10.7905, lng: 78.7047, districtName: "Tiruchirappalli" };
        }
    }

    return { lat, lng, districtName };
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const markerInstancesRef = useRef<Map<string, any>>(new Map());

    const [selected, setSelected] = useState<ComplaintPin | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [allPins, setAllPins] = useState<ComplaintPin[]>([]);
    const [mapLoading, setMapLoading] = useState(true);

    // Interactive Navigation & UX Controls
    const [scrollZoomEnabled, setScrollZoomEnabled] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedDistrict, setSelectedDistrict] = useState<string>("All");
    const [selectedPriority, setSelectedPriority] = useState<string>("All");
    const [searchQuery, setSearchQuery] = useState<string>("");

    // Transform complaints into ComplaintPin objects with deterministic radial dispersion
    const mapComplaintsToPins = useCallback((list: (DbComplaintRecord | Record<string, unknown>)[]): ComplaintPin[] => {
        // 1. Calculate raw base coordinates
        const rawList = list.map((c) => {
            const id = (c.id as string) || `GRV-${Math.floor(10000 + Math.random() * 90000)}`;
            const locationStr = (c.location as string) || "Location recorded";
            const { lat: baseLat, lng: baseLng, districtName } = parseBaseCoords({ id, location: locationStr });
            const record = c as Record<string, unknown>;
            const dateStr = record.created_at
                ? new Date(record.created_at as string).toLocaleDateString("en-IN")
                : (record.date as string) || new Date().toLocaleDateString("en-IN");
            const userStr = (record.user_email as string) || (record.user as string) || "Registered Citizen";

            return {
                id,
                subject: (c.subject as string) || "Civic Complaint",
                category: (c.category as string) || "General",
                priority: (c.priority as string) || "Medium",
                status: (c.status as string) || "Pending",
                location: locationStr,
                districtName,
                baseLat,
                baseLng,
                lat: baseLat,
                lng: baseLng,
                date: dateStr,
                user: userStr,
            };
        });

        // 2. Group pins by quantized location (key rounded to 3 decimal places ~100m)
        const groups = new Map<string, number[]>();
        rawList.forEach((pin, idx) => {
            const key = `${pin.baseLat.toFixed(3)}_${pin.baseLng.toFixed(3)}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(idx);
        });

        // 3. Apply Golden-Ratio Sunflower Spiral Dispersion to overlapping/clustered pins
        // This guarantees EVERY pin has its own distinctive, clickable position and none are hidden!
        groups.forEach((indices) => {
            if (indices.length <= 1) return; // Single pin: keep exact base coordinate

            indices.forEach((pinIdx, spiralIdx) => {
                const baseLat = rawList[pinIdx].baseLat;
                const baseLng = rawList[pinIdx].baseLng;

                // Golden ratio angle (~137.5 deg) provides uniform, natural omnidirectional scatter
                const goldenAngle = spiralIdx * 2.399963;
                // Scatter radius: 350m for inner ring, expanding gently for larger clusters
                const radius = 0.0035 + (Math.floor(spiralIdx / 6) * 0.0022);

                const latOffset = Math.sin(goldenAngle) * radius;
                // Adjust longitude for Earth curvature based on latitude
                const lngOffset = (Math.cos(goldenAngle) * radius) / Math.cos((baseLat * Math.PI) / 180);

                rawList[pinIdx].lat = baseLat + latOffset;
                rawList[pinIdx].lng = baseLng + lngOffset;
            });
        });

        return rawList;
    }, []);

    // 1. Load complaints from initialComplaints or fetch directly from Supabase
    useEffect(() => {
        setIsClient(true);

        if (initialComplaints && initialComplaints.length > 0) {
            setAllPins(mapComplaintsToPins(initialComplaints));
            setMapLoading(false);
            return;
        }

        const fetchPins = async () => {
            try {
                const res = await getComplaintsServerAction();
                if (res.success && res.complaints && res.complaints.length > 0) {
                    setAllPins(mapComplaintsToPins(res.complaints));
                }
            } catch (err) {
                console.error("Error fetching map pins:", err);
            } finally {
                setMapLoading(false);
            }
        };

        fetchPins();
    }, [initialComplaints, mapComplaintsToPins]);

    // Filter pins based on user criteria (District, Priority, Search)
    const filteredPins = useMemo(() => {
        return allPins.filter((p) => {
            if (selectedDistrict !== "All" && p.districtName !== selectedDistrict) return false;
            if (selectedPriority !== "All" && p.priority !== selectedPriority) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchSubject = p.subject.toLowerCase().includes(q);
                const matchId = p.id.toLowerCase().includes(q);
                const matchLoc = p.location.toLowerCase().includes(q);
                if (!matchSubject && !matchId && !matchLoc) return false;
            }
            return true;
        });
    }, [allPins, selectedDistrict, selectedPriority, searchQuery]);

    // Available districts computed dynamically from active complaints
    const availableDistricts = useMemo(() => {
        const counts: Record<string, number> = {};
        allPins.forEach((p) => {
            counts[p.districtName] = (counts[p.districtName] || 0) + 1;
        });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    }, [allPins]);

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

            // Central Tamil Nadu default center
            const defaultCenter: [number, number] = [10.7905, 78.7047];

            const map = L.map(mapRef.current, {
                center: defaultCenter,
                zoom: 12,
                zoomControl: false, // We render clean, custom accessible zoom controls
                scrollWheelZoom: false, // OFF by default to eliminate page scroll trapping!
                dragging: true,
                touchZoom: true,
                doubleClickZoom: true,
                boxZoom: true,
                keyboard: true,
            });

            // High-reliability OpenStreetMap tile layer
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19,
            }).addTo(map);

            // Layer group for pin markers
            const markersLayer = L.layerGroup().addTo(map);
            markersLayerRef.current = markersLayer;
            mapInstanceRef.current = map;

            // Invalidate size to guarantee crisp rendering
            setTimeout(() => { map.invalidateSize(); }, 200);
            setTimeout(() => { map.invalidateSize(); }, 600);
        });

        return () => {
            isCancelled = true;
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
                markersLayerRef.current = null;
                markerInstancesRef.current.clear();
            }
        };
    }, [isClient]);

    // 3. Update Markers whenever filteredPins changes
    useEffect(() => {
        if (!mapInstanceRef.current || !markersLayerRef.current) return;

        import("leaflet").then((L) => {
            const map = mapInstanceRef.current;
            const markersLayer = markersLayerRef.current;
            if (!map || !markersLayer) return;

            markersLayer.clearLayers();
            markerInstancesRef.current.clear();
            const coords: [number, number][] = [];

            filteredPins.forEach((pin) => {
                const color = PRIORITY_COLORS[pin.priority] || "#6366f1";
                const statusColor = STATUS_COLORS[pin.status] || "#f59e0b";
                const isPinSelected = selected?.id === pin.id;
                coords.push([pin.lat, pin.lng]);

                const svgIcon = L.divIcon({
                    html: `
            <div style="
              position:relative;
              width:${isPinSelected ? "38px" : "32px"};
              height:${isPinSelected ? "38px" : "32px"};
              background:${color};
              border-radius:50% 50% 50% 0;
              transform:rotate(-45deg);
              border:2.5px solid white;
              box-shadow:${isPinSelected ? `0 0 16px ${color}, 0 6px 16px rgba(0,0,0,0.5)` : "0 3px 10px rgba(0,0,0,0.35)"};
              display:flex;align-items:center;justify-content:center;
              cursor:pointer;
              transition:transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
            ">
              <div style="
                transform:rotate(45deg);
                font-size:${isPinSelected ? "15px" : "13px"};
                line-height:1;
                color:white;
                font-weight:800;
              ">${pin.priority === "Critical" ? "🚨" : pin.priority === "High" ? "⚠️" : pin.priority === "Medium" ? "📍" : "✅"}</div>
            </div>
            <div style="
              position:absolute;bottom:-6px;left:50%;
              transform:translateX(-50%);
              width:8px;height:8px;
              border-radius:50%;
              background:${statusColor};
              border:1.5px solid white;
              box-shadow:0 0 8px ${statusColor};
            "></div>
          `,
                    className: "complaint-marker-custom",
                    iconSize: isPinSelected ? [38, 48] : [32, 42],
                    iconAnchor: isPinSelected ? [19, 48] : [16, 42],
                    popupAnchor: [0, -50],
                });

                const marker = L.marker([pin.lat, pin.lng], { icon: svgIcon, title: `${pin.id} - ${pin.subject}` }).addTo(markersLayer);
                markerInstancesRef.current.set(pin.id, marker);

                marker.on("click", () => {
                    setSelected(pin);
                    map.flyTo([pin.lat, pin.lng], Math.max(map.getZoom(), 14), { duration: 0.8 });
                });

                marker.bindTooltip(`
                    <div style="font-weight:700;font-size:0.82rem;color:#0f172a;margin-bottom:2px;">${escapeHtml(pin.id)}</div>
                    <div style="font-size:0.75rem;color:#334155;margin-bottom:4px;max-width:220px;white-space:normal;line-height:1.3;">${escapeHtml(pin.subject)}</div>
                    <div style="display:flex;align-items:center;gap:6px;font-size:0.72rem;font-weight:700;">
                        <span style="color:${color};">● ${escapeHtml(pin.priority)}</span>
                        <span style="color:#64748b;">•</span>
                        <span style="color:${statusColor};">● ${escapeHtml(pin.status)}</span>
                        <span style="color:#64748b;">•</span>
                        <span style="color:#475569;">📍 ${escapeHtml(pin.districtName)}</span>
                    </div>
                `, {
                    direction: "top",
                    className: "leaflet-tooltip-custom",
                    offset: [0, -10],
                });
            });

            // Smoothly frame all matching pins
            if (coords.length > 0) {
                map.fitBounds(L.latLngBounds(coords), { padding: [60, 60], maxZoom: 14 });
            }

            map.invalidateSize();
        });
    }, [filteredPins, selected]);

    // Handle scroll wheel zoom toggle
    const handleToggleScrollZoom = () => {
        if (!mapInstanceRef.current) return;
        const nextState = !scrollZoomEnabled;
        setScrollZoomEnabled(nextState);
        if (nextState) {
            mapInstanceRef.current.scrollWheelZoom.enable();
        } else {
            mapInstanceRef.current.scrollWheelZoom.disable();
        }
    };

    // Handle Zoom In / Out
    const handleZoomIn = () => {
        mapInstanceRef.current?.zoomIn();
    };

    const handleZoomOut = () => {
        mapInstanceRef.current?.zoomOut();
    };

    // Handle Fit All Pins
    const handleFitAll = () => {
        if (!mapInstanceRef.current || filteredPins.length === 0) return;
        import("leaflet").then((L) => {
            const coords: [number, number][] = filteredPins.map((p) => [p.lat, p.lng]);
            mapInstanceRef.current?.fitBounds(L.latLngBounds(coords), { padding: [60, 60], maxZoom: 14 });
        });
    };

    // Fly to specific district
    const handleFlyToDistrict = (districtName: string) => {
        setSelectedDistrict(districtName);
        if (!mapInstanceRef.current) return;

        if (districtName === "All") {
            handleFitAll();
            return;
        }

        const match = Object.values(DISTRICT_COORDS).find(
            (d) => d.displayName.toLowerCase() === districtName.toLowerCase()
        );

        if (match) {
            mapInstanceRef.current.flyTo([match.lat, match.lng], 13, { duration: 1.0 });
        } else {
            const districtPins = allPins.filter((p) => p.districtName === districtName);
            if (districtPins.length > 0) {
                import("leaflet").then((L) => {
                    const coords: [number, number][] = districtPins.map((p) => [p.lat, p.lng]);
                    mapInstanceRef.current?.fitBounds(L.latLngBounds(coords), { padding: [60, 60], maxZoom: 14 });
                });
            }
        }
    };

    // Quick select a pin from the bottom complaint drawer
    const handleSelectComplaintFromList = (pin: ComplaintPin) => {
        setSelected(pin);
        if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([pin.lat, pin.lng], 15, { duration: 0.8 });
            const marker = markerInstancesRef.current.get(pin.id);
            if (marker) {
                marker.openTooltip();
            }
        }
    };

    // Handle map height expansion toggle
    const handleToggleExpand = () => {
        setIsExpanded((prev) => !prev);
        setTimeout(() => {
            mapInstanceRef.current?.invalidateSize();
        }, 320);
    };

    return (
        <div style={{ fontFamily: "inherit" }}>
            {/* Header Toolbar */}
            <div style={{ marginBottom: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <h2 style={{ fontSize: "clamp(1.4rem, 2.5vw, 1.85rem)", fontWeight: "800", marginBottom: "0.3rem" }}>{title}</h2>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>{subtitle}</p>
                </div>

                {/* Primary Map Actions Bar */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                    {/* Safe Scroll Indicator & Toggle */}
                    <button
                        type="button"
                        onClick={handleToggleScrollZoom}
                        title={scrollZoomEnabled ? "Scroll zoom is ACTIVE. Click to lock page scroll." : "Scroll zoom is OFF. Prevents page scroll hijacking. Click to enable mouse wheel zoom."}
                        style={{
                            padding: "0.45rem 0.85rem",
                            borderRadius: "0.6rem",
                            border: `1px solid ${scrollZoomEnabled ? "rgba(99,102,241,0.6)" : "var(--border)"}`,
                            background: scrollZoomEnabled ? "rgba(99,102,241,0.18)" : "var(--bg-card)",
                            color: scrollZoomEnabled ? "#a5b4fc" : "var(--text-muted)",
                            fontSize: "0.78rem",
                            fontWeight: "700",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.4rem",
                            transition: "var(--transition)",
                        }}
                    >
                        <span>{scrollZoomEnabled ? "🔓 Scroll Zoom: ON" : "🔒 Scroll Zoom: OFF"}</span>
                    </button>

                    {/* Fit All Button */}
                    <button
                        type="button"
                        onClick={handleFitAll}
                        style={{
                            padding: "0.45rem 0.85rem",
                            borderRadius: "0.6rem",
                            border: "1px solid var(--border)",
                            background: "var(--bg-card)",
                            color: "var(--text-main)",
                            fontSize: "0.78rem",
                            fontWeight: "700",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            transition: "var(--transition)",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--primary)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
                    >
                        🎯 Fit All Pins
                    </button>

                    {/* Expand Height Toggle */}
                    <button
                        type="button"
                        onClick={handleToggleExpand}
                        title={isExpanded ? "Collapse map height" : "Expand map height"}
                        style={{
                            padding: "0.45rem 0.85rem",
                            borderRadius: "0.6rem",
                            border: "1px solid var(--border)",
                            background: "var(--bg-card)",
                            color: "var(--text-main)",
                            fontSize: "0.78rem",
                            fontWeight: "700",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            transition: "var(--transition)",
                        }}
                    >
                        {isExpanded ? "📐 Compact View" : "⛶ Expand Map"}
                    </button>

                    {/* Plotted Badge */}
                    <div style={{
                        padding: "0.4rem 0.85rem",
                        borderRadius: "99px",
                        background: "rgba(99,102,241,0.15)",
                        border: "1px solid rgba(99,102,241,0.35)",
                        fontSize: "0.82rem",
                        fontWeight: "800",
                        color: "var(--primary)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                    }}>
                        <span>📍</span>
                        <span>{filteredPins.length} of {allPins.length} Plotted</span>
                    </div>
                </div>
            </div>

            {/* Quick District Navigation Bar */}
            <div style={{
                marginBottom: "1rem",
                padding: "0.75rem 1rem",
                borderRadius: "0.85rem",
                background: "rgba(15,15,26,0.65)",
                border: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.5rem",
            }}>
                <span style={{ fontSize: "0.75rem", fontWeight: "800", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginRight: "0.25rem" }}>
                    Quick Jump:
                </span>

                {/* All Option */}
                <button
                    type="button"
                    onClick={() => handleFlyToDistrict("All")}
                    style={{
                        padding: "0.3rem 0.75rem",
                        borderRadius: "99px",
                        fontSize: "0.75rem",
                        fontWeight: "700",
                        cursor: "pointer",
                        border: selectedDistrict === "All" ? "1px solid var(--primary)" : "1px solid var(--border)",
                        background: selectedDistrict === "All" ? "var(--primary)" : "rgba(255,255,255,0.04)",
                        color: selectedDistrict === "All" ? "#ffffff" : "var(--text-main)",
                        transition: "all 0.15s ease",
                    }}
                >
                    🎯 All ({allPins.length})
                </button>

                {/* Dynamic buttons for districts containing complaints */}
                {availableDistricts.map(([district, count]) => {
                    const isSelected = selectedDistrict === district;
                    return (
                        <button
                            key={district}
                            type="button"
                            onClick={() => handleFlyToDistrict(district)}
                            style={{
                                padding: "0.3rem 0.75rem",
                                borderRadius: "99px",
                                fontSize: "0.75rem",
                                fontWeight: "700",
                                cursor: "pointer",
                                border: isSelected ? "1px solid #6366f1" : "1px solid rgba(255,255,255,0.1)",
                                background: isSelected ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.04)",
                                color: isSelected ? "#ffffff" : "var(--text-main)",
                                transition: "all 0.15s ease",
                            }}
                        >
                            📍 {district} ({count})
                        </button>
                    );
                })}

                {/* Major State Hubs Quick Jump if not already listed */}
                {["Coimbatore", "Chennai", "Madurai", "Salem"].filter(d => !availableDistricts.some(([ad]) => ad === d)).map((hub) => (
                    <button
                        key={hub}
                        type="button"
                        onClick={() => handleFlyToDistrict(hub)}
                        style={{
                            padding: "0.3rem 0.75rem",
                            borderRadius: "99px",
                            fontSize: "0.75rem",
                            fontWeight: "600",
                            cursor: "pointer",
                            border: "1px solid rgba(255,255,255,0.08)",
                            background: "transparent",
                            color: "var(--text-muted)",
                            transition: "all 0.15s ease",
                        }}
                    >
                        {hub}
                    </button>
                ))}
            </div>

            {/* Filter & Priority Bar */}
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "0.9rem", alignItems: "center", justifyContent: "space-between" }}>
                {/* Priority Filter */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--text-muted)", marginRight: "0.2rem" }}>Priority:</span>
                    <button
                        type="button"
                        onClick={() => setSelectedPriority("All")}
                        style={{
                            padding: "0.25rem 0.6rem",
                            borderRadius: "0.4rem",
                            fontSize: "0.72rem",
                            fontWeight: "700",
                            cursor: "pointer",
                            border: selectedPriority === "All" ? "1px solid var(--primary)" : "1px solid var(--border)",
                            background: selectedPriority === "All" ? "rgba(99,102,241,0.2)" : "transparent",
                            color: selectedPriority === "All" ? "var(--primary)" : "var(--text-muted)",
                        }}
                    >
                        All
                    </button>
                    {Object.entries(PRIORITY_COLORS).map(([p, c]) => {
                        const isChosen = selectedPriority === p;
                        return (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setSelectedPriority(isChosen ? "All" : p)}
                                style={{
                                    padding: "0.25rem 0.6rem",
                                    borderRadius: "0.4rem",
                                    fontSize: "0.72rem",
                                    fontWeight: "700",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.3rem",
                                    border: isChosen ? `1px solid ${c}` : "1px solid var(--border)",
                                    background: isChosen ? `${c}22` : "transparent",
                                    color: isChosen ? c : "var(--text-main)",
                                }}
                            >
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: c, boxShadow: `0 0 6px ${c}` }} />
                                {p}
                            </button>
                        );
                    })}
                </div>

                {/* Search Bar */}
                <div style={{ position: "relative", minWidth: "220px" }}>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search ID, title, locality..."
                        style={{
                            width: "100%",
                            padding: "0.38rem 0.75rem 0.38rem 1.85rem",
                            fontSize: "0.78rem",
                            borderRadius: "0.5rem",
                            border: "1px solid var(--border)",
                            background: "var(--bg-card)",
                            color: "var(--text-main)",
                            outline: "none",
                        }}
                    />
                    <span style={{ position: "absolute", left: "0.6rem", top: "50%", transform: "translateY(-50%)", fontSize: "0.78rem", opacity: 0.6 }}>🔍</span>
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            style={{ position: "absolute", right: "0.5rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.8rem" }}
                        >✕</button>
                    )}
                </div>
            </div>

            {/* Map Container */}
            <div style={{
                position: "relative",
                borderRadius: "1.25rem",
                overflow: "hidden",
                border: "1px solid var(--border)",
                boxShadow: "0 20px 40px -10px rgba(0,0,0,0.3)",
                background: "#0f1523",
                transition: "height 0.3s ease",
            }}>
                <div
                    ref={mapRef}
                    style={{
                        height: isExpanded ? "640px" : "480px",
                        width: "100%",
                        zIndex: 1,
                        transition: "height 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                />

                {/* Custom Floating Sleek Zoom & Navigation Controls */}
                <div style={{
                    position: "absolute",
                    top: "1rem",
                    right: "1rem",
                    zIndex: 500,
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.4rem",
                }}>
                    <button
                        type="button"
                        onClick={handleZoomIn}
                        title="Zoom In"
                        style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "8px",
                            background: "rgba(15,15,26,0.9)",
                            border: "1px solid rgba(255,255,255,0.15)",
                            color: "#ffffff",
                            fontSize: "1.2rem",
                            fontWeight: "700",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                            backdropFilter: "blur(6px)",
                        }}
                    >+</button>
                    <button
                        type="button"
                        onClick={handleZoomOut}
                        title="Zoom Out"
                        style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "8px",
                            background: "rgba(15,15,26,0.9)",
                            border: "1px solid rgba(255,255,255,0.15)",
                            color: "#ffffff",
                            fontSize: "1.2rem",
                            fontWeight: "700",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                            backdropFilter: "blur(6px)",
                        }}
                    >−</button>
                    <button
                        type="button"
                        onClick={handleFitAll}
                        title="Fit All Markers"
                        style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "8px",
                            background: "rgba(15,15,26,0.9)",
                            border: "1px solid rgba(255,255,255,0.15)",
                            color: "#ffffff",
                            fontSize: "0.9rem",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                            backdropFilter: "blur(6px)",
                        }}
                    >🎯</button>
                </div>

                {/* Safe Scroll Notification Pill (Bottom-Right) */}
                <div style={{
                    position: "absolute",
                    bottom: "0.85rem",
                    right: "0.85rem",
                    zIndex: 500,
                    padding: "0.3rem 0.65rem",
                    borderRadius: "6px",
                    background: "rgba(15,15,26,0.85)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "var(--text-muted)",
                    fontSize: "0.7rem",
                    pointerEvents: "none",
                    backdropFilter: "blur(4px)",
                }}>
                    🖐️ Drag to pan • {scrollZoomEnabled ? "🔍 Wheel zoom active" : "🔒 Page scroll protected"}
                </div>

                {/* Loading Indicator */}
                {mapLoading && (
                    <div style={{
                        position: "absolute",
                        inset: 0,
                        background: "rgba(15,15,26,0.78)",
                        backdropFilter: "blur(4px)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.75rem",
                        zIndex: 900,
                    }}>
                        <div style={{ fontSize: "2rem", animation: "spin 1s linear infinite" }}>⏳</div>
                        <p style={{ fontSize: "0.88rem", fontWeight: "600", color: "#e2e8f0" }}>Plotting dispersed live coordinates...</p>
                    </div>
                )}

                {/* Selected Complaint Card Overlay */}
                {selected && (
                    <div style={{
                        position: "absolute",
                        bottom: "1rem",
                        left: "1rem",
                        right: "1rem",
                        zIndex: 1000,
                        maxWidth: "460px",
                        margin: "0 auto",
                    }}>
                        <div className="glass animate-fade-in" style={{
                            padding: "1.25rem",
                            borderRadius: "1rem",
                            borderLeft: `4px solid ${PRIORITY_COLORS[selected.priority] || "#6366f1"}`,
                            boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
                            background: "rgba(15,15,26,0.95)",
                            backdropFilter: "blur(12px)",
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                                <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem" }}>
                                        <span style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "var(--primary)", fontWeight: "700" }}>{selected.id}</span>
                                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>• 📍 {selected.districtName}</span>
                                    </div>
                                    <div style={{ fontWeight: "800", fontSize: "1rem", lineHeight: 1.35, color: "var(--text-main)" }}>{selected.subject}</div>
                                </div>
                                <button
                                    type="button"
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
                                <span style={{ padding: "0.2rem 0.65rem", borderRadius: "99px", fontSize: "0.7rem", background: "rgba(255,255,255,0.06)", color: "var(--text-muted)", fontWeight: "600" }}>
                                    {selected.category}
                                </span>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "0.85rem" }}>
                                <span>📍 Location: {selected.location}</span>
                                <span>📅 Filed on {selected.date} • {selected.user}</span>
                            </div>

                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (mapInstanceRef.current) {
                                            mapInstanceRef.current.flyTo([selected.lat, selected.lng], 16, { duration: 0.6 });
                                        }
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: "0.45rem",
                                        borderRadius: "0.5rem",
                                        background: "var(--primary)",
                                        color: "#ffffff",
                                        border: "none",
                                        fontSize: "0.75rem",
                                        fontWeight: "700",
                                        cursor: "pointer",
                                    }}
                                >
                                    🔍 Zoom Into Spot
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelected(null)}
                                    style={{
                                        padding: "0.45rem 0.85rem",
                                        borderRadius: "0.5rem",
                                        background: "transparent",
                                        border: "1px solid var(--border)",
                                        color: "var(--text-muted)",
                                        fontSize: "0.75rem",
                                        cursor: "pointer",
                                    }}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Interactive "Plotted Complaints Quick-Jump" Bar */}
            {filteredPins.length > 0 && (
                <div style={{ marginTop: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                        <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "var(--text-muted)" }}>
                            📋 Tap Any Complaint Below to Fly Directly to Pin:
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-faint)" }}>
                            {filteredPins.length} complaints shown
                        </span>
                    </div>

                    <div style={{
                        display: "flex",
                        gap: "0.6rem",
                        overflowX: "auto",
                        paddingBottom: "0.5rem",
                        scrollbarWidth: "thin",
                    }}>
                        {filteredPins.map((pin) => {
                            const isPinSelected = selected?.id === pin.id;
                            const pColor = PRIORITY_COLORS[pin.priority] || "#6366f1";
                            return (
                                <button
                                    key={pin.id}
                                    type="button"
                                    onClick={() => handleSelectComplaintFromList(pin)}
                                    style={{
                                        flexShrink: 0,
                                        padding: "0.6rem 0.85rem",
                                        borderRadius: "0.75rem",
                                        background: isPinSelected ? "rgba(99,102,241,0.18)" : "var(--bg-card)",
                                        border: isPinSelected ? `1.5px solid ${pColor}` : "1px solid var(--border)",
                                        textAlign: "left",
                                        cursor: "pointer",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "0.2rem",
                                        maxWidth: "240px",
                                        transition: "all 0.15s ease",
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isPinSelected) (e.currentTarget as HTMLElement).style.borderColor = "var(--primary)";
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isPinSelected) (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                                    }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", gap: "0.5rem" }}>
                                        <span style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: "700" }}>{pin.id}</span>
                                        <span style={{ fontSize: "0.68rem", fontWeight: "800", color: pColor }}>{pin.priority}</span>
                                    </div>
                                    <div style={{
                                        fontSize: "0.78rem",
                                        fontWeight: "600",
                                        color: "var(--text-main)",
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        width: "100%",
                                    }}>
                                        {pin.subject}
                                    </div>
                                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                                        📍 {pin.districtName}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <style>{`
                .leaflet-tooltip-custom {
                    background: #ffffff !important;
                    border: 1px solid #cbd5e1 !important;
                    border-radius: 8px !important;
                    padding: 0.6rem 0.85rem !important;
                    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3) !important;
                    color: #0f172a !important;
                    z-index: 1000 !important;
                }
                .leaflet-container {
                    font-family: inherit !important;
                    background: #0f1523 !important;
                    cursor: grab !important;
                }
                .leaflet-container:active {
                    cursor: grabbing !important;
                }
                .complaint-marker-custom:hover > div:first-child {
                    transform: rotate(-45deg) scale(1.15) !important;
                }
            `}</style>
        </div>
    );
}
