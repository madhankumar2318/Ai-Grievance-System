"use server";

export interface DbComplaintRecord {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  user_email: string | null;
  attachment_count: number | null;
  description: string;
  location: string | null;
  created_at: string;
  updated_at?: string;
  ai_reasoning: string | null;
}

import { getVerifiedSessionServerAction } from "./authActions";
import { cookies } from "next/headers";
import { checkRateLimit, getClientIp } from "@/lib/rateLimiter";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lxjevqkbkxafqknevbwf.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_TbfQF0Q4zPSBZn_XsyZHhA_E_oNyx-M";
const SPRING_BOOT_URL = process.env.NEXT_PUBLIC_SPRING_BOOT_URL || "http://localhost:8080";

/**
 * Server-side PII masking helper.
 * Runs on the server before any JSON is serialised to the browser.
 * e.g. "rajan.kumar@gmail.com" → "r***r@gmail.com"
 */
function maskEmailServerSide(email: string | null | undefined): string {
  if (!email || !email.includes("@")) return "Registered Citizen";
  const [local, domain] = email.split("@");
  if (local.length <= 1) return `${local}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Fetch all complaints with Spring Boot local check + Supabase cloud fallback
 */
export async function getComplaintsServerAction(): Promise<{
  success: boolean;
  complaints: DbComplaintRecord[];
  source: "spring-boot" | "supabase" | "empty";
  error?: string;
}> {
  // Enforce server-side authorization check: only officers or chiefs can view all complaints
  const session = await getVerifiedSessionServerAction();
  if (!session.authenticated || !session.user) {
    return {
      success: false,
      complaints: [],
      source: "empty",
      error: "Unauthorized: Please log in with authorized credentials.",
    };
  }

  if (session.user.role !== "authority" && session.user.role !== "chief") {
    return {
      success: false,
      complaints: [],
      source: "empty",
      error: "Access Denied: Only field officers and chief administrators can view all complaints.",
    };
  }

  // 1. Try Java Spring Boot REST API first if running locally
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${SPRING_BOOT_URL}/api/complaints`, {
      method: "GET",
      headers,
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.complaints || [];
      if (list.length > 0) {
        return {
          success: true,
          complaints: list,
          source: "spring-boot",
        };
      }
    }
  } catch {
    // Spring Boot offline or on Vercel cloud, proceed with direct Supabase fetch
  }

  // 2. Direct Supabase Cloud REST API Fetch
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/complaints?select=*&order=created_at.desc`,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      return {
        success: true,
        complaints: list,
        source: "supabase",
      };
    } else {
      console.error("Supabase complaints fetch error status:", res.status);
    }
  } catch (err) {
    console.error("Supabase complaints fetch network error:", err);
  }

  return {
    success: false,
    complaints: [],
    source: "empty",
    error: "Failed to load complaints from backend or database.",
  };
}

/**
 * Update complaint status (Resolved / Rejected / In Progress)
 */
export async function updateComplaintStatusServerAction(
  id: string,
  newStatus: "Pending" | "In Progress" | "Resolved" | "Rejected"
): Promise<{ success: boolean; error?: string }> {
  if (!id || !newStatus) {
    return { success: false, error: "Complaint ID and status are required." };
  }

  // Enforce server-side authorization check: only officers or chiefs can update status
  const session = await getVerifiedSessionServerAction();
  if (!session.authenticated || !session.user) {
    return { success: false, error: "Unauthorized: Please log in with authorized credentials." };
  }

  if (session.user.role !== "authority" && session.user.role !== "chief") {
    return { success: false, error: "Access Denied: Only field officers and chief administrators can update complaint status." };
  }

  const now = new Date().toISOString();

  // 1. Try Java Spring Boot REST API
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${SPRING_BOOT_URL}/api/complaints/update-status`, {
      method: "POST",
      headers,
      body: JSON.stringify({ id, status: newStatus }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      // Also update Supabase in background to keep cloud DB synchronized
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/complaints?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ status: newStatus, updated_at: now }),
        });
      } catch {}
      return { success: true };
    }
  } catch {
    // Spring Boot offline
  }

  // 2. Direct Supabase Cloud REST API Update
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/complaints?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          status: newStatus,
          updated_at: now,
        }),
      }
    );

    if (res.ok) {
      return { success: true };
    } else {
      const errText = await res.text();
      console.error("Supabase update error:", errText);
      return { success: false, error: errText };
    }
  } catch (err) {
    console.error("Supabase status update network error:", err);
    return { success: false, error: "Network error updating status." };
  }
}

/**
 * Public complaint lookup by ID — fully server-side.
 *
 * Security guarantees:
 *  1. Anti-scraping: max 20 tracking queries per minute per IP.
 *  2. PII masking: user_email is masked on the server (r***r@domain.com) before
 *     the JSON is serialised to the browser. Raw emails NEVER leave the server
 *     for unauthenticated / citizen callers.
 *  3. Elevated access: authenticated field officers and chief admins receive the
 *     full record (unmasked) for case management.
 */
export async function getComplaintByIdServerAction(id: string): Promise<{
  success: boolean;
  complaint?: DbComplaintRecord | null;
  error?: string;
  rateLimited?: boolean;
}> {
  // 1. Sanitise input
  const cleanId = (id || "").trim().toUpperCase();
  if (!cleanId || cleanId.length > 60) {
    return { success: false, error: "Invalid complaint ID format." };
  }

  // 2. Anti-scraping rate limit: max 20 tracking lookups per minute per IP
  const ip = await getClientIp();
  const rateResult = checkRateLimit(ip, "track_complaint", 20, 60000);
  if (!rateResult.success) {
    return {
      success: false,
      rateLimited: true,
      error: `Too many tracking requests. Please wait ${rateResult.retryAfterSeconds}s before searching again.`,
    };
  }

  // 3. Determine if caller holds an elevated role (unmasked access)
  const session = await getVerifiedSessionServerAction();
  const isElevated =
    session.authenticated &&
    session.user &&
    (session.user.role === "authority" || session.user.role === "chief");

  // 4. Try Java Spring Boot REST API first (forwards auth token for role-aware masking at backend too)
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    const reqHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (token) reqHeaders["Authorization"] = `Bearer ${token}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(
      `${SPRING_BOOT_URL}/api/complaints/${encodeURIComponent(cleanId)}`,
      { method: "GET", headers: reqHeaders, signal: controller.signal, cache: "no-store" }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      if (data && data.id) {
        const rawEmail = data.userEmail ?? data.user_email ?? "";
        return {
          success: true,
          complaint: {
            id: data.id,
            subject: data.subject ?? "",
            description: data.description ?? "",
            category: data.category ?? "Other",
            priority: data.priority ?? "Medium",
            status: data.status ?? "Pending",
            // ── Server-side PII masking ─────────────────────────────────────
            user_email: isElevated ? rawEmail : maskEmailServerSide(rawEmail),
            location: data.location ?? "",
            attachment_count: data.attachmentCount ?? data.attachment_count ?? 0,
            created_at: data.createdAt ?? data.created_at ?? new Date().toISOString(),
            updated_at: data.updatedAt ?? data.updated_at ?? data.createdAt ?? data.created_at,
            ai_reasoning: data.aiReasoning ?? data.ai_reasoning ?? "",
          },
        };
      }
    }
  } catch {
    // Spring Boot offline — fall through to Supabase server-side query
  }

  // 5. Supabase server-to-server query (API key stays on the server — never sent to browser)
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/complaints?id=eq.${encodeURIComponent(cleanId)}&select=*`,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0) {
        const item = list[0];
        const rawEmail = item.user_email ?? "";
        return {
          success: true,
          complaint: {
            id: item.id,
            subject: item.subject ?? "",
            description: item.description ?? "",
            category: item.category ?? "Other",
            priority: item.priority ?? "Medium",
            status: item.status ?? "Pending",
            // ── Server-side PII masking ─────────────────────────────────────
            user_email: isElevated ? rawEmail : maskEmailServerSide(rawEmail),
            location: item.location ?? "",
            attachment_count: item.attachment_count ?? 0,
            created_at: item.created_at ?? new Date().toISOString(),
            updated_at: item.updated_at ?? item.created_at,
            ai_reasoning: item.ai_reasoning ?? "",
          },
        };
      }
    }
  } catch (err) {
    console.error("Server-side Supabase complaint lookup error:", err);
  }

  return { success: false, error: "Complaint not found. Please check the ID and try again." };
}

/**
 * Fetch complaints submitted by a specific citizen.
 *
 * Security & IDOR guarantees:
 *  1. Authenticated session required (getVerifiedSessionServerAction).
 *  2. IDOR Enforcement: If caller has citizen role (user), they can ONLY fetch
 *     complaints matching their own authenticated email address.
 *  3. Elevated access: Field officers (authority) and chiefs can query any citizen's complaints.
 *  4. Cloud resilience: Tries Java Spring Boot (GET /api/complaints/user/{email}) first,
 *     then falls back to server-to-server Supabase query.
 */
export async function getUserComplaintsServerAction(targetEmail?: string): Promise<{
  success: boolean;
  complaints: DbComplaintRecord[];
  error?: string;
}> {
  // 1. Enforce authenticated session
  const session = await getVerifiedSessionServerAction();
  if (!session.authenticated || !session.user) {
    return {
      success: false,
      complaints: [],
      error: "Unauthorized: Please log in to view your complaints.",
    };
  }

  const authenticatedEmail = session.user.email.toLowerCase().trim();
  const isElevated = session.user.role === "authority" || session.user.role === "chief";

  // If no target email provided, default to caller's own email
  const requestedEmail = (targetEmail || authenticatedEmail).toLowerCase().trim();

  // 2. IDOR Ownership Check
  if (!isElevated && requestedEmail !== authenticatedEmail) {
    return {
      success: false,
      complaints: [],
      error: "Access Denied: You may only view your own submitted complaints.",
    };
  }

  // 3. Try Spring Boot REST API
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    const reqHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (token) reqHeaders["Authorization"] = `Bearer ${token}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(
      `${SPRING_BOOT_URL}/api/complaints/user/${encodeURIComponent(requestedEmail)}`,
      { method: "GET", headers: reqHeaders, signal: controller.signal, cache: "no-store" }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      const list = Array.isArray(data) ? data : data.complaints || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: DbComplaintRecord[] = list.map((c: any) => ({
        id: c.id,
        subject: c.subject ?? "",
        description: c.description ?? "",
        category: c.category ?? "Other",
        priority: c.priority ?? "Medium",
        status: c.status ?? "Pending",
        user_email: c.userEmail ?? c.user_email ?? requestedEmail,
        location: c.location ?? "",
        attachment_count: c.attachmentCount ?? c.attachment_count ?? 0,
        created_at: c.createdAt ?? c.created_at ?? new Date().toISOString(),
        updated_at: c.updatedAt ?? c.updated_at ?? c.createdAt ?? c.created_at,
        ai_reasoning: c.aiReasoning ?? c.ai_reasoning ?? "",
      }));
      return { success: true, complaints: mapped };
    }
  } catch {
    // Spring Boot offline — fall through to Supabase
  }

  // 4. Try Supabase cloud database
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/complaints?user_email=eq.${encodeURIComponent(requestedEmail)}&order=created_at.desc`,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list)) {
        return { success: true, complaints: list };
      }
    }
  } catch (err) {
    console.error("⚠️ Supabase user complaints lookup error:", err);
  }

  return { success: false, complaints: [], error: "Failed to load user grievances." };
}

