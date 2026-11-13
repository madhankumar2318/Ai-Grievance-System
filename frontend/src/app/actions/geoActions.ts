"use server";

import { checkRateLimit, getClientIp } from "@/lib/rateLimiter";

export interface ReverseGeocodeResult {
  success: boolean;
  landmark?: string;
  state?: string;
  district?: string;
  town?: string;
  street?: string;
  error?: string;
}

interface GeoCacheEntry {
  landmark: string;
  state?: string;
  district?: string;
  town?: string;
  street?: string;
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
): Promise<ReverseGeocodeResult> {
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
    return {
      success: true,
      landmark: cached.landmark,
      state: cached.state,
      district: cached.district,
      town: cached.town,
      street: cached.street,
    };
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
      const road = (addr.road || addr.street || addr.neighbourhood || addr.suburb || "").trim();
      const town = (addr.town || addr.city || addr.suburb || addr.village || addr.municipality || "").trim();
      const rawDistrict = (addr.state_district || addr.district || addr.county || "").trim();
      const cleanDistrict = rawDistrict.replace(/\s+district$/i, "").trim();
      const state = (addr.state || "").trim();
      const parts = [road, town, cleanDistrict, state].filter(Boolean);

      let landmark = "";
      if (parts.length > 0) {
        landmark = parts.join(", ");
      } else if (data.display_name) {
        landmark = data.display_name.split(",").slice(0, 3).join(",").trim();
      }

      // Sanitize landmark output (strip any control chars or HTML tags)
      landmark = landmark.replace(/<[^>]*>/g, "").replace(/[\r\n\t]/g, " ").trim().slice(0, 200);

      if (landmark) {
        const entry: GeoCacheEntry = {
          landmark,
          state,
          district: cleanDistrict,
          town,
          street: road,
          timestamp: now,
        };
        geoCache.set(cacheKey, entry);
        return {
          success: true,
          landmark,
          state,
          district: cleanDistrict,
          town,
          street: road,
        };
      }
    }
  } catch (err) {
    console.warn("⚠️ Reverse geocoding lookup failed:", err);
  }

  return { success: false, error: "Unable to resolve landmark." };
}
