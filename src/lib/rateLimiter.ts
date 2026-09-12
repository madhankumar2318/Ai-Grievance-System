import { headers } from "next/headers";

interface RateLimitRecord {
  timestamps: number[];
}

// In-memory sliding window store
const requestStore = new Map<string, RateLimitRecord>();

// Periodic garbage collection to prevent memory leaks (runs every 5 minutes)
if (typeof setInterval !== "undefined") {
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of requestStore.entries()) {
      record.timestamps = record.timestamps.filter((t) => now - t < 10 * 60 * 1000);
      if (record.timestamps.length === 0) {
        requestStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  // Unref timer in Node.js environment to not block process shutdown
  if (cleanupTimer && typeof cleanupTimer.unref === "function") {
    cleanupTimer.unref();
  }
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * In-memory sliding window rate limiter
 * @param identifier Client identifier (IP address, user email, or session token)
 * @param action Name of the action being rate limited
 * @param maxRequests Maximum allowed requests in the time window
 * @param windowMs Time window in milliseconds (default: 60,000 ms = 1 minute)
 */
export function checkRateLimit(
  identifier: string,
  action: string,
  maxRequests: number,
  windowMs: number = 60000
): RateLimitResult {
  const now = Date.now();
  const safeId = identifier ? identifier.trim() : "127.0.0.1";
  const key = `${action}:${safeId}`;

  let record = requestStore.get(key);
  if (!record) {
    record = { timestamps: [] };
    requestStore.set(key, record);
  }

  // Filter out timestamps outside the sliding window
  record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

  if (record.timestamps.length >= maxRequests) {
    const oldestTimestamp = record.timestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldestTimestamp + windowMs - now) / 1000));
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  record.timestamps.push(now);
  return {
    success: true,
    limit: maxRequests,
    remaining: maxRequests - record.timestamps.length,
    retryAfterSeconds: 0,
  };
}

/**
 * Helper to safely extract client IP address in Next.js Server Actions
 */
export async function getClientIp(): Promise<string> {
  try {
    const headerList = await headers();
    const forwardedFor = headerList.get("x-forwarded-for");
    if (forwardedFor) {
      return forwardedFor.split(",")[0].trim();
    }
    const realIp = headerList.get("x-real-ip");
    if (realIp) {
      return realIp.trim();
    }
    const cfConnectingIp = headerList.get("cf-connecting-ip");
    if (cfConnectingIp) {
      return cfConnectingIp.trim();
    }
  } catch {
    // Fallback if headers() is unavailable
  }
  return "127.0.0.1";
}
