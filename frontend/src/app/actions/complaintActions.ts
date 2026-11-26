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
 * Fast-path check: On Vercel cloud / production, localhost does not exist.
 * Skipping dead localhost timeouts cuts 2.5 to 5.0 seconds off page loading.
 */
function shouldAttemptSpringBoot(): boolean {
  if (!SPRING_BOOT_URL) return false;
  const isLocalhost = SPRING_BOOT_URL.includes("localhost") || SPRING_BOOT_URL.includes("127.0.0.1");
  const isCloudOrProd = !!process.env.VERCEL || process.env.NODE_ENV === "production";
  if (isLocalhost && isCloudOrProd) {
    return false;
  }
  return true;
}

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

  // 1. Try Java Spring Boot REST API only if reachable (local dev with Spring Boot active)
  if (shouldAttemptSpringBoot()) {
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get("auth_token")?.value;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 400); // Fast 400ms local timeout
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
      // Spring Boot offline, proceed with direct Supabase fetch
    }
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
/**
 * Approved complaint workflow statuses.
 * Any value outside this set is rejected immediately with a 400-equivalent error.
 */
const VALID_COMPLAINT_STATUSES = new Set([
  "Pending",
  "In Progress",
  "Under Review",
  "Resolved",
  "Escalated",
  "Rejected",
]);

/**
 * Update complaint status (Resolved / Rejected / In Progress / etc.)
 * Security:
 *  1. Status whitelist — only approved enum values accepted (prevents arbitrary string injection).
 *  2. Role enforcement — only authority / chief may call this action.
 *  3. Rate limiting — 30 updates per minute per IP (anti-mass-tampering).
 *  4. Structured security audit log on every call (allowed or blocked).
 */
export interface ActionTakenReportData {
  actionDescription: string;
  officerName: string;
  department?: string;
  resolvedAt: string;
  resolutionPhoto?: string | null;
}

export interface CollectorDirectiveData {
  orderId: string;
  directiveNote: string;
  priorityTarget: string;
  officerTitle: string;
  officerName: string;
  issuedAt: string;
  deadlineHours?: number;
}

export async function updateComplaintStatusServerAction(
  id: string,
  newStatus: "Pending" | "In Progress" | "Under Review" | "Resolved" | "Escalated" | "Rejected",
  atr?: ActionTakenReportData | null
): Promise<{ success: boolean; conflict?: boolean; error?: string }> {
  const ip = await getClientIp();

  // 1. Rate limit: 30 status updates per minute per IP
  const rateResult = checkRateLimit(ip, "update_status", 30, 60000);
  if (!rateResult.success) {
    console.log(
      `SECURITY_AUDIT: timestamp=${new Date().toISOString()} ip=${ip} event=STATUS_UPDATE_RATE_LIMITED outcome=BLOCKED_429`
    );
    return {
      success: false,
      error: `Rate limit exceeded. Please wait ${rateResult.retryAfterSeconds}s before updating another complaint.`,
    };
  }

  if (!id || !newStatus) {
    return { success: false, error: "Complaint ID and status are required." };
  }

  // 2. Status whitelist validation
  if (!VALID_COMPLAINT_STATUSES.has(newStatus)) {
    console.log(
      `SECURITY_AUDIT: timestamp=${new Date().toISOString()} ip=${ip} event=INVALID_STATUS_INJECTION outcome=BLOCKED_400 value=${newStatus}`
    );
    return {
      success: false,
      error: `Invalid status value. Allowed: Pending, In Progress, Under Review, Resolved, Escalated, Rejected`,
    };
  }

  // 3. Enforce server-side authorization check: only officers or chiefs can update status
  const session = await getVerifiedSessionServerAction();
  if (!session.authenticated || !session.user) {
    console.log(
      `SECURITY_AUDIT: timestamp=${new Date().toISOString()} ip=${ip} event=STATUS_UPDATE_UNAUTHORIZED outcome=BLOCKED_401`
    );
    return { success: false, error: "Unauthorized: Please log in with authorized credentials." };
  }

  if (session.user.role !== "authority" && session.user.role !== "chief") {
    console.log(
      `SECURITY_AUDIT: timestamp=${new Date().toISOString()} ip=${ip} event=STATUS_UPDATE_FORBIDDEN user=${session.user.email} role=${session.user.role} outcome=BLOCKED_403`
    );
    return { success: false, error: "Access Denied: Only field officers and chief administrators can update complaint status." };
  }

  // 4. Audit log — legitimate operation proceeding
  console.log(
    `SECURITY_AUDIT: timestamp=${new Date().toISOString()} ip=${ip} event=STATUS_UPDATE user=${session.user.email} id=${id} newStatus=${newStatus} outcome=ALLOWED`
  );

  const now = new Date().toISOString();

  // 4b. Optimistic concurrency & claim lock check against live Supabase row
  let existingRawDesc = "";
  try {
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/complaints?id=eq.${encodeURIComponent(id)}&select=status,description`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        cache: "no-store",
      }
    );
    if (checkRes.ok) {
      const rows = await checkRes.json();
      if (rows && rows.length > 0) {
        const currentStatus = rows[0].status as string;
        existingRawDesc = (rows[0].description as string) || "";

        if (currentStatus === "Resolved" || currentStatus === "Rejected") {
          const atrMatch = existingRawDesc.match(/\[ACTION_TAKEN_REPORT:([\s\S]*?)\]/);
          const claimMatch = existingRawDesc.match(/\[CLAIMED_BY:([\s\S]*?)\]/);
          let byOfficer = "another officer";
          if (atrMatch) {
            try {
              const parsed = JSON.parse(atrMatch[1]);
              if (parsed?.officerName) byOfficer = parsed.officerName;
            } catch {}
          } else if (claimMatch) {
            try {
              const parsed = JSON.parse(claimMatch[1]);
              if (parsed?.officerName) byOfficer = parsed.officerName;
            } catch {}
          }
          return {
            success: false,
            conflict: true,
            error: `⚠️ This grievance was already ${currentStatus} by ${byOfficer}. Refreshing your dashboard.`,
          };
        }

        const roleStr = (session.user.authorityRole || "").toLowerCase();
        const isHead =
          roleStr.includes("collector") ||
          roleStr.includes("magistrate") ||
          roleStr.includes("commissioner") ||
          session.user.role === "chief";

        const claimMatch = existingRawDesc.match(/\[CLAIMED_BY:([\s\S]*?)\]/);
        if (claimMatch && !isHead) {
          try {
            const claim = JSON.parse(claimMatch[1]);
            if (
              claim?.officerEmail &&
              claim.officerEmail.toLowerCase() !== session.user.email.toLowerCase()
            ) {
              return {
                success: false,
                conflict: true,
                error: `⚠️ This grievance is already claimed by ${claim.officerName || "another officer"}. Only the assigned officer can update or resolve it.`,
              };
            }
          } catch {}
        }
      }
    }
  } catch (err) {
    console.error("Concurrency check error:", err);
  }

  // If Action Taken Report (ATR) is attached for resolution, prepare updated description
  let updatedDescription: string | undefined = undefined;
  if (atr && newStatus === "Resolved") {
    if (existingRawDesc) {
      const baseDesc = existingRawDesc.replace(/\n\n\[ACTION_TAKEN_REPORT:[\s\S]*?\]/g, "").trim();
      updatedDescription = `${baseDesc}\n\n[ACTION_TAKEN_REPORT:${JSON.stringify(atr)}]`;
    } else {
      updatedDescription = `Official resolution recorded.\n\n[ACTION_TAKEN_REPORT:${JSON.stringify(atr)}]`;
    }
  }

  const patchPayload: Record<string, unknown> = {
    status: newStatus,
    updated_at: now,
  };
  if (updatedDescription) {
    patchPayload.description = updatedDescription;
  }

  // 5. Try Java Spring Boot REST API
  if (shouldAttemptSpringBoot()) try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 400);
    const res = await fetch(`${SPRING_BOOT_URL}/api/complaints/update-status`, {
      method: "POST",
      headers,
      body: JSON.stringify({ id, status: newStatus, description: updatedDescription }),
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
          body: JSON.stringify(patchPayload),
        });
      } catch {}
      return { success: true };
    }
  } catch {
    // Spring Boot offline
  }

  // 6. Direct Supabase Cloud REST API Update
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
        body: JSON.stringify(patchPayload),
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
 * Transfer complaint department / category.
 * Executive authority: Only District Collectors and Chief Administrators can re-route complaints between departments.
 */
export async function transferComplaintDepartmentServerAction(
  id: string,
  newDepartment: "Administrative" | "Environment" | "Infrastructure" | "Public Health" | "Safety"
): Promise<{ success: boolean; error?: string }> {
  const ip = await getClientIp();

  // 1. Rate limiting
  const rateResult = checkRateLimit(ip, "transfer_department", 30, 60000);
  if (!rateResult.success) {
    return { success: false, error: "Too many transfer requests. Please slow down." };
  }

  if (!id || !newDepartment) {
    return { success: false, error: "Complaint ID and target department are required." };
  }

  // 2. Department whitelist validation
  const VALID_DEPARTMENTS = new Set([
    "Administrative",
    "Environment",
    "Infrastructure",
    "Public Health",
    "Safety",
  ]);
  if (!VALID_DEPARTMENTS.has(newDepartment)) {
    return { success: false, error: "Invalid target department." };
  }

  // 3. Enforce server-side authorization check: only Collectors and Chiefs can re-route
  const session = await getVerifiedSessionServerAction();
  if (!session.authenticated || !session.user) {
    return { success: false, error: "Authentication required to transfer department." };
  }

  const roleStr = (session.user.authorityRole || "").toLowerCase();
  const isDistrictHead =
    roleStr.includes("collector") ||
    roleStr.includes("magistrate") ||
    roleStr.includes("commissioner") ||
    session.user.role === "chief";

  if (!isDistrictHead) {
    return {
      success: false,
      error: "Access Denied: Only District Collectors and Chief Administrators have the executive power to transfer complaints between departments.",
    };
  }

  const now = new Date().toISOString();
  const patchPayload = {
    category: newDepartment,
    updated_at: now,
  };

  // 4. Try Spring Boot if running locally
  if (shouldAttemptSpringBoot()) try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 400);
    const res = await fetch(`${SPRING_BOOT_URL}/api/complaints/update-category`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, category: newDepartment }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      // Also update Supabase in background
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/complaints?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify(patchPayload),
        });
      } catch {}
      return { success: true };
    }
  } catch {}

  // 5. Direct Supabase Cloud REST API Update
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
        body: JSON.stringify(patchPayload),
      }
    );

    if (res.ok) {
      return { success: true };
    } else {
      const errText = await res.text();
      console.error("Supabase category update error:", errText);
      return { success: false, error: errText };
    }
  } catch (err) {
    console.error("Supabase category update network error:", err);
    return { success: false, error: "Network error transferring department." };
  }
}

/**
 * Issues an executive priority directive or 24h expedite order from the District Collector / Magistrate.
 *
 * Security guarantees:
 *  1. Only users with Collector/Magistrate/Chief authorization can issue orders.
 *  2. Rate limiting prevents spam.
 *  3. Elevates complaint priority to Critical automatically and records directive in description.
 */
export interface ClaimGrievanceResult {
  success: boolean;
  conflict?: boolean;
  claim?: {
    officerName: string;
    officerEmail: string;
    officerRole?: string;
    claimedAt: string;
  };
  error?: string;
}

/**
 * Allows an authenticated field officer to claim ownership of a Pending grievance
 * and move it to "In Progress", preventing duplicate work or silent overwrites.
 */
export async function claimComplaintServerAction(id: string): Promise<ClaimGrievanceResult> {
  const ip = await getClientIp();
  const rateResult = checkRateLimit(ip, "claim_complaint", 30, 60000);
  if (!rateResult.success) {
    return {
      success: false,
      error: `Rate limit exceeded. Please wait ${rateResult.retryAfterSeconds}s.`,
    };
  }

  const session = await getVerifiedSessionServerAction();
  if (!session.authenticated || !session.user) {
    return { success: false, error: "Unauthorized: Please log in." };
  }
  if (session.user.role !== "authority" && session.user.role !== "chief") {
    return { success: false, error: "Access Denied: Only officers can claim grievances." };
  }

  let existingDesc = "";
  try {
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/complaints?id=eq.${encodeURIComponent(id)}&select=status,description`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        cache: "no-store",
      }
    );
    if (checkRes.ok) {
      const rows = await checkRes.json();
      if (rows && rows.length > 0) {
        const currentStatus = rows[0].status as string;
        existingDesc = (rows[0].description as string) || "";

        if (currentStatus === "Resolved" || currentStatus === "Rejected") {
          return {
            success: false,
            conflict: true,
            error: `⚠️ This grievance was already ${currentStatus} by another officer.`,
          };
        }

        const claimMatch = existingDesc.match(/\[CLAIMED_BY:([\s\S]*?)\]/);
        if (claimMatch) {
          try {
            const existingClaim = JSON.parse(claimMatch[1]);
            if (
              existingClaim?.officerEmail &&
              existingClaim.officerEmail.toLowerCase() !== session.user.email.toLowerCase()
            ) {
              return {
                success: false,
                conflict: true,
                error: `⚠️ This grievance was already claimed by ${existingClaim.officerName || "another officer"}.`,
              };
            }
          } catch {}
        }
      }
    }
  } catch (err) {
    console.error("Claim check error:", err);
  }

  const now = new Date().toISOString();
  const claimPayload = {
    officerName: session.user.username || session.user.email,
    officerEmail: session.user.email,
    officerRole: session.user.authorityRole || "Department Officer",
    claimedAt: now,
  };

  const baseDesc = existingDesc.replace(/\n\n\[CLAIMED_BY:[\s\S]*?\]/g, "").trim();
  const updatedDescription = `${baseDesc}\n\n[CLAIMED_BY:${JSON.stringify(claimPayload)}]`;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/complaints?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        status: "In Progress",
        description: updatedDescription,
        updated_at: now,
      }),
    });

    if (res.ok) {
      return { success: true, claim: claimPayload };
    }
  } catch (err) {
    console.error("Error claiming complaint:", err);
  }

  return { success: false, error: "Could not claim grievance. Please try again." };
}

export async function issueCollectorDirectiveServerAction(
  id: string,
  directive: CollectorDirectiveData
): Promise<{ success: boolean; error?: string }> {
  const ip = await getClientIp();

  // 1. Rate limiting
  const rateResult = checkRateLimit(ip, "issue_directive", 20, 60000);
  if (!rateResult.success) {
    return { success: false, error: "Too many directive requests. Please wait a moment." };
  }

  if (!id || !directive || !directive.directiveNote) {
    return { success: false, error: "Complaint ID and directive instructions are required." };
  }

  // 2. Authorization check: only Collectors or Chiefs
  const session = await getVerifiedSessionServerAction();
  if (!session.authenticated || !session.user) {
    return { success: false, error: "Authentication required to issue an executive directive." };
  }

  const roleStr = (session.user.authorityRole || "").toLowerCase();
  const isDistrictHead =
    roleStr.includes("collector") ||
    roleStr.includes("magistrate") ||
    roleStr.includes("commissioner") ||
    session.user.role === "chief";

  if (!isDistrictHead) {
    return {
      success: false,
      error: "Access Denied: Only District Collectors and Chief Administrators have the statutory power to issue executive directives.",
    };
  }

  // Clamp deadlineHours to 1..168h (max 7 days) server-side
  const safeDeadlineHours =
    typeof directive.deadlineHours === "number" && Number.isFinite(directive.deadlineHours)
      ? Math.min(168, Math.max(1, Math.round(directive.deadlineHours)))
      : 24;

  const sanitizedDirective: CollectorDirectiveData = {
    orderId: String(directive.orderId || `DIR-${new Date().getFullYear()}-000`).slice(0, 40),
    directiveNote: String(directive.directiveNote || "").trim().slice(0, 800),
    priorityTarget: String(directive.priorityTarget || "24 Hours").slice(0, 120),
    officerTitle: String(session.user.authorityRole || directive.officerTitle || "District Collector").slice(0, 100),
    officerName: String(session.user.username || directive.officerName || "District Magistrate").slice(0, 100),
    issuedAt: directive.issuedAt || new Date().toISOString(),
    deadlineHours: safeDeadlineHours,
  };

  // 3. Fetch current description to append directive
  let updatedDescription = "";
  try {
    const fetchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/complaints?id=eq.${encodeURIComponent(id)}&select=description`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    if (fetchRes.ok) {
      const rows = await fetchRes.json();
      if (rows && rows.length > 0) {
        const rawDesc = rows[0].description || "";
        // Clean any existing directive block
        const baseDesc = rawDesc.replace(/\n\n\[COLLECTOR_DIRECTIVE:[\s\S]*?\]/g, "").trim();
        updatedDescription = `${baseDesc}\n\n[COLLECTOR_DIRECTIVE:${JSON.stringify(sanitizedDirective)}]`;
      }
    }
  } catch (err) {
    console.error("Error reading description for directive attachment:", err);
  }

  if (!updatedDescription) {
    updatedDescription = `Citizen grievance registered.\n\n[COLLECTOR_DIRECTIVE:${JSON.stringify(sanitizedDirective)}]`;
  }

  const now = new Date().toISOString();
  const patchPayload: Record<string, unknown> = {
    description: updatedDescription,
    priority: "Critical",
    updated_at: now,
  };

  // 4. Update Supabase
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
        body: JSON.stringify(patchPayload),
      }
    );

    if (res.ok) {
      return { success: true };
    } else {
      const errText = await res.text();
      return { success: false, error: errText };
    }
  } catch (err) {
    return { success: false, error: "Network error issuing directive." };
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

  // 3. Try Spring Boot REST API (only when reachable, skipping dead localhost on Vercel cloud)
  if (shouldAttemptSpringBoot()) {
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get("auth_token")?.value;
      const reqHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (token) reqHeaders["Authorization"] = `Bearer ${token}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 400);
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

