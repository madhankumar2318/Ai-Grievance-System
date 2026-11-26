/**
 * Shared pure utilities for grievance metadata parsing, PII masking,
 * and departmental role routing.
 */

export interface EmbeddedDirective {
  directiveId: string;
  directiveNote: string;
  priorityTarget: string;
  issuedBy: string;
  issuedAt?: string;
}

export interface EmbeddedActionTakenReport {
  officerName: string;
  officerRole?: string;
  actionDescription: string;
  proofPhoto?: string;
  resolvedAt?: string;
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
