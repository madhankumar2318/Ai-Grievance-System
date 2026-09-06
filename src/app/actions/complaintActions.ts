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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lxjevqkbkxafqknevbwf.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_TbfQF0Q4zPSBZn_XsyZHhA_E_oNyx-M";
const SPRING_BOOT_URL = process.env.NEXT_PUBLIC_SPRING_BOOT_URL || "http://localhost:8080";

/**
 * Fetch all complaints with Spring Boot local check + Supabase cloud fallback
 */
export async function getComplaintsServerAction(): Promise<{
  success: boolean;
  complaints: DbComplaintRecord[];
  source: "spring-boot" | "supabase" | "empty";
  error?: string;
}> {
  // 1. Try Java Spring Boot REST API first if running locally
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${SPRING_BOOT_URL}/api/complaints`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
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

  const now = new Date().toISOString();

  // 1. Try Java Spring Boot REST API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${SPRING_BOOT_URL}/api/complaints/update-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
