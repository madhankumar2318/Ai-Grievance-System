"use server";

import { checkRateLimit, getClientIp } from "@/lib/rateLimiter";

interface GeoCacheEntry {
  landmark: string;
  timestamp: number;
}

// In-memory cache for reverse-geocoded coordinates (1 hour TTL)
const geoCache = new Map<string, GeoCacheEntry>();

/**
 * Server-side reverse geocoding action.
 * Complies with OpenStreetMap Nominatim Usage Policy:
 *  - Enforces identifying User-Agent with project contact info
 *  - Rate-limits per client IP to prevent upstream abuse
 *  - Caches resolution by rounded lat/lng (~11m resolution)
 *  - Shields citizen IP address from third-party map servers
 */
export async function reverseGeocodeServerAction(
  lat: number,
  lng: number
): Promise<{ success: boolean; landmark?: string; error?: string }> {
  // 1. Validate coordinates range
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    isNaN(lat) ||
    isNaN(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return { success: false, error: "Invalid geographic coordinates." };
  }

  // 2. Enforce rate limiting: max 15 reverse geocoding lookups per minute per IP
  const ip = await getClientIp();
  const rateResult = checkRateLimit(ip, "reverse_geocode", 15, 60000);
  if (!rateResult.success) {
    return {
      success: false,
      error: `Geocoding rate limit exceeded. Please wait ${rateResult.retryAfterSeconds}s.`,
    };
  }

  // 3. Coordinate rounding for caching (~11 meter precision reduces upstream calls)
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = geoCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.timestamp < 60 * 60 * 1000) {
    return { success: true, landmark: cached.landmark };
  }

  // 4. Query OpenStreetMap Nominatim with compliant User-Agent
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "AIGrievanceSystem/1.0 (contact: support@aigrievance.gov.in)",
        "Accept-Language": "en",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const road = addr.road || addr.street || addr.suburb || addr.neighbourhood || "";
      const town = addr.town || addr.city || addr.county || addr.district || "";
      const state = addr.state || "";
      const parts = [road, town, state].filter(Boolean);

      let landmark = "";
      if (parts.length > 0) {
        landmark = parts.join(", ");
      } else if (data.display_name) {
        landmark = data.display_name.split(",").slice(0, 3).join(",").trim();
      }

      // Sanitize landmark output (strip any control chars or HTML tags)
      landmark = landmark.replace(/<[^>]*>/g, "").replace(/[\r\n\t]/g, " ").trim().slice(0, 200);

      if (landmark) {
        // Cache landmark result
        geoCache.set(cacheKey, { landmark, timestamp: now });
        return { success: true, landmark };
      }
    }
  } catch (err) {
    console.warn("⚠️ Reverse geocoding lookup failed:", err);
  }

  return { success: false, error: "Unable to resolve landmark." };
}
