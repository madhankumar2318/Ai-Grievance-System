/**
 * Shared pure utilities for grievance metadata parsing, PII masking,
 * and departmental role routing.
 */

export interface EmbeddedDirective {
  orderId?: string;
  directiveId?: string;
  directiveNote: string;
  priorityTarget: string;
  officerTitle?: string;
  officerName?: string;
  issuedBy?: string;
  issuedAt?: string;
  deadlineHours?: number;
}

export interface DirectiveSlaStatus {
  isResolved: boolean;
  isOverdue: boolean;
  label: string;
  color: string;
  bg: string;
  border: string;
  deadlineHours: number;
}

export interface EmbeddedActionTakenReport {
  officerName: string;
  officerRole?: string;
  actionDescription: string;
  proofPhoto?: string;
  resolvedAt?: string;
}

export interface EmbeddedClaim {
  officerName: string;
  officerEmail: string;
  officerRole?: string;
  claimedAt: string;
}

/**
 * Masks a citizen's email address for public-facing tracking pages to prevent PII exposure.
 * Example: "rajan.kumar@gmail.com" -> "r***r@gmail.com"
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "Registered Citizen";
  const [local, domain] = email.split("@");
  if (!local || !domain) return "Registered Citizen";
  if (local.length <= 1) return `${local}***@${domain}`;
  const masked = local[0] + "***" + local[local.length - 1];
  return `${masked}@${domain}`;
}

/**
 * Safely extracts and parses a JSON payload embedded inside a bracketed tag
 * such as `[COLLECTOR_DIRECTIVE:{...}]` or `[ACTION_TAKEN_REPORT:{...}]`.
 */
export function parseEmbeddedTag<T = Record<string, unknown>>(
  description: string,
  tagName: string
): T | null {
  if (!description || !tagName) return null;
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\[${escapedTag}:([\\s\\S]*?)\\]`);
  const match = description.match(regex);
  if (!match || !match[1]) return null;
  try {
    return JSON.parse(match[1]) as T;
  } catch {
    return null;
  }
}

/**
 * Strips internal metadata tags from complaint descriptions before rendering to citizens.
 */
export function stripEmbeddedTags(description: string): string {
  if (!description) return "";
  return description
    .replace(/\[EVIDENCE_PHOTO:[^\]]+\]/g, "")
    .replace(/\[ACTION_TAKEN_REPORT:[\s\S]*?\]/g, "")
    .replace(/\[COLLECTOR_DIRECTIVE:[\s\S]*?\]/g, "")
    .replace(/\[CLAIMED_BY:[\s\S]*?\]/g, "")
    .trim();
}

/**
 * Maps an authority officer's designation string to one of the 5 core grievance departments.
 */
export function mapRoleToDepartment(role: string): string {
  const r = (role || "").toLowerCase();
  if (
    r.includes("environment") ||
    r.includes("forest") ||
    r.includes("wildlife") ||
    r.includes("waste") ||
    r.includes("pollution") ||
    r.includes("tnpcb")
  ) {
    return "Environment";
  }
  if (
    r.includes("health") ||
    r.includes("sanitation") ||
    r.includes("medical") ||
    r.includes("hospital") ||
    r.includes("food") ||
    r.includes("fssai") ||
    r.includes("dmo") ||
    r.includes("dph")
  ) {
    return "Public Health";
  }
  if (
    r.includes("infrastructure") ||
    r.includes("pwd") ||
    r.includes("electricity") ||
    r.includes("water") ||
    r.includes("transport") ||
    r.includes("rto") ||
    r.includes("bus") ||
    r.includes("engineer")
  ) {
    return "Infrastructure";
  }
  if (
    r.includes("safety") ||
    r.includes("traffic") ||
    r.includes("police") ||
    r.includes("fire") ||
    r.includes("rescue") ||
    r.includes("cyber") ||
    r.includes("digital") ||
    r.includes("fraud") ||
    r.includes("dccps")
  ) {
    return "Safety";
  }
  return "Administrative";
}

/**
 * Computes departmental resolution clearance percentage (0-100).
 * Returns 100 when a department has zero pending and zero resolved cases.
 */
export function computeDepartmentClearancePct(pending: number, resolved: number): number {
  const p = Math.max(0, pending);
  const r = Math.max(0, resolved);
  const total = p + r;
  return total > 0 ? Math.round((r / total) * 100) : 100;
}

/**
 * Resolves the target SLA window in hours (clamped between 1 hour and 720 hours / 30 days).
 */
export function parseDeadlineHours(priorityTarget: string, deadlineHours?: number): number {
  if (typeof deadlineHours === "number" && Number.isFinite(deadlineHours) && deadlineHours > 0) {
    return Math.min(720, Math.max(1, Math.round(deadlineHours)));
  }
  const t = (priorityTarget || "").toLowerCase();
  const hourMatch = t.match(/(\d+)[\s-]*(?:hours?|hrs?|h)\b/);
  if (hourMatch) {
    return Math.min(720, Math.max(1, parseInt(hourMatch[1], 10)));
  }
  const dayMatch = t.match(/(\d+)[\s-]*(?:days?|d)\b/);
  if (dayMatch) {
    return Math.min(720, Math.max(1, parseInt(dayMatch[1], 10) * 24));
  }
  if (t.includes("immediate")) return 6;
  return 24;
}

function formatDurationCompact(totalMinutes: number): string {
  const mins = Math.max(1, Math.round(totalMinutes));
  if (mins < 60) return `${mins}m`;
  const totalHours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (totalHours < 24) {
    return remMins > 0 ? `${totalHours}h ${remMins}m` : `${totalHours}h`;
  }
  const days = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

/**
 * Computes live SLA countdown or overdue breach status for a Collector Executive Directive.
 */
export function computeDirectiveSlaStatus(
  issuedAt: string | undefined,
  priorityTarget: string,
  status: string,
  deadlineHours?: number,
  nowMs: number = Date.now()
): DirectiveSlaStatus {
  const targetHours = parseDeadlineHours(priorityTarget, deadlineHours);

  if (status === "Resolved") {
    return {
      isResolved: true,
      isOverdue: false,
      label: "✓ Solved Within Directive",
      color: "#34d399",
      bg: "rgba(16, 185, 129, 0.14)",
      border: "rgba(16, 185, 129, 0.4)",
      deadlineHours: targetHours,
    };
  }

  const issuedMs = issuedAt ? new Date(issuedAt).getTime() : NaN;
  if (!Number.isFinite(issuedMs)) {
    return {
      isResolved: false,
      isOverdue: false,
      label: `⏳ ${targetHours >= 24 && targetHours % 24 === 0 ? `${targetHours / 24}d` : `${targetHours}h`} SLA`,
      color: "#fbbf24",
      bg: "rgba(245, 158, 11, 0.14)",
      border: "rgba(245, 158, 11, 0.4)",
      deadlineHours: targetHours,
    };
  }

  const deadlineMs = issuedMs + targetHours * 60 * 60 * 1000;
  const diffMinutes = (deadlineMs - nowMs) / (60 * 1000);

  if (diffMinutes >= 0) {
    return {
      isResolved: false,
      isOverdue: false,
      label: `⏳ ${formatDurationCompact(diffMinutes)} left`,
      color: "#fbbf24",
      bg: "rgba(245, 158, 11, 0.14)",
      border: "rgba(245, 158, 11, 0.45)",
      deadlineHours: targetHours,
    };
  }

  return {
    isResolved: false,
    isOverdue: true,
    label: `🚨 OVERDUE by ${formatDurationCompact(Math.abs(diffMinutes))}`,
    color: "#f87171",
    bg: "rgba(239, 68, 68, 0.18)",
    border: "rgba(239, 68, 68, 0.55)",
    deadlineHours: targetHours,
  };
}

export interface OpenComplaintSummary {
  id: string;
  subject: string;
  description?: string;
  location?: string;
  category?: string;
  status: string;
}

const DUPLICATE_STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "near", "here", "there",
  "have", "has", "been", "being", "are", "was", "were", "will", "not", "our",
  "your", "please", "kindly", "issue", "problem", "complaint", "grievance",
  "area", "road", "street", "days", "day", "very", "much", "many", "into",
]);

function normalizeText(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/\bstreetlights?\b/g, "street light")
    .replace(/\bwaterpipes?\b/g, "water pipe")
    .replace(/\bpotholes\b/g, "pothole")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeywords(text: string): Set<string> {
  const words = normalizeText(text).split(" ");
  const out = new Set<string>();
  for (const w of words) {
    if (w.length >= 3 && !DUPLICATE_STOPWORDS.has(w)) {
      out.add(w);
    }
  }
  return out;
}

const GENERIC_LOCATION_TOKENS = new Set([
  "tiruchirappalli", "trichy", "chennai", "coimbatore", "madurai", "salem",
  "tamil", "nadu", "tamilnadu", "india", "district", "city", "town", "center",
]);

function parseGpsCoords(loc: string): { lat: number; lng: number } | null {
  const m = (loc || "").match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function locationsOverlap(locA: string, locB: string): boolean {
  const a = normalizeText(locA);
  const b = normalizeText(locB);
  if (!a || !b) return false;
  if (a === b) return true;

  // Match nearby GPS coordinates within ~330 meters (~0.003 degrees)
  const gpsA = parseGpsCoords(locA);
  const gpsB = parseGpsCoords(locB);
  if (gpsA && gpsB) {
    if (Math.abs(gpsA.lat - gpsB.lat) <= 0.003 && Math.abs(gpsA.lng - gpsB.lng) <= 0.003) {
      return true;
    }
  }

  const tokensA = new Set(
    Array.from(extractKeywords(a)).filter((t) => !GENERIC_LOCATION_TOKENS.has(t))
  );
  const tokensB = new Set(
    Array.from(extractKeywords(b)).filter((t) => !GENERIC_LOCATION_TOKENS.has(t))
  );

  if (tokensA.size === 0 || tokensB.size === 0) {
    return a.includes(b) || b.includes(a);
  }

  for (const t of tokensA) {
    if (tokensB.has(t)) return true;
  }
  return false;
}

/**
 * Checks whether a newly submitted grievance duplicates one of the same citizen's
 * currently open grievances (Pending / In Progress / Under Review / Escalated).
 */
export function findDuplicateComplaint(
  newSubject: string,
  newDescription: string,
  newLocation: string,
  existingComplaints: OpenComplaintSummary[]
): OpenComplaintSummary | null {
  const normNewSubject = normalizeText(newSubject);
  const newKeywords = extractKeywords(`${newSubject} ${stripEmbeddedTags(newDescription)}`);
  if (!normNewSubject) return null;

  for (const existing of existingComplaints) {
    const st = (existing.status || "").toLowerCase();
    if (st === "resolved" || st === "rejected") continue;

    const normOldSubject = normalizeText(existing.subject);
    if (normOldSubject && normOldSubject === normNewSubject) {
      return existing;
    }

    const oldKeywords = extractKeywords(
      `${existing.subject} ${stripEmbeddedTags(existing.description || "")}`
    );
    if (newKeywords.size === 0 || oldKeywords.size === 0) continue;

    let overlapCount = 0;
    for (const kw of newKeywords) {
      if (oldKeywords.has(kw)) overlapCount++;
    }

    const minSize = Math.min(newKeywords.size, oldKeywords.size);
    const overlapRatio = minSize > 0 ? overlapCount / minSize : 0;
    const sameArea = locationsOverlap(newLocation, existing.location || "");

    if (
      (overlapCount >= 2 && sameArea) ||
      overlapCount >= 3 ||
      (overlapCount >= 2 && overlapRatio >= 0.6)
    ) {
      return existing;
    }
  }

  return null;
}

/**
 * Finds other open complaints in the same department and same area that describe
 * the same civic issue, so resolving one automatically resolves all matching reports.
 */
export function findMatchingAreaComplaints(
  resolved: {
    id: string;
    subject: string;
    description?: string;
    location?: string;
    category?: string;
  },
  candidates: OpenComplaintSummary[]
): OpenComplaintSummary[] {
  if (!resolved.location || !resolved.category) return [];

  return candidates.filter((other) => {
    if (!other || other.id === resolved.id) return false;
    const st = (other.status || "").toLowerCase();
    if (st === "resolved" || st === "rejected") return false;
    if ((other.category || "") !== resolved.category) return false;
    if (!locationsOverlap(resolved.location || "", other.location || "")) return false;

    return (
      findDuplicateComplaint(
        resolved.subject,
        resolved.description || "",
        resolved.location || "",
        [other]
      ) !== null
    );
  });
}

/**
 * Returns the currently active (not Resolved/Rejected) grievance claimed by the given officer,
 * enforcing a strict 1-active-grievance-at-a-time rule per officer.
 */
export function findOfficerActiveClaim(
  officerEmail: string,
  complaints: OpenComplaintSummary[]
): OpenComplaintSummary | null {
  const emailLower = (officerEmail || "").toLowerCase().trim();
  if (!emailLower) return null;

  for (const c of complaints) {
    const st = (c.status || "").toLowerCase();
    if (st === "resolved" || st === "rejected") continue;
    const claim = parseEmbeddedTag<EmbeddedClaim>(c.description || "", "CLAIMED_BY");
    if (claim?.officerEmail && claim.officerEmail.toLowerCase().trim() === emailLower) {
      return c;
    }
  }
  return null;
}
