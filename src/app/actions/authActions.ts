"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { checkRateLimit, getClientIp } from "@/lib/rateLimiter";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lxjevqkbkxafqknevbwf.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_TbfQF0Q4zPSBZn_XsyZHhA_E_oNyx-M";
const SPRING_BOOT_URL = process.env.NEXT_PUBLIC_SPRING_BOOT_URL || "http://localhost:8080";
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === "default_super_secret_key_change_me_in_production") {
    if (process.env.NODE_ENV === "production" && !process.env.NEXT_PHASE?.includes("build")) {
      console.warn("⚠️ SECURITY WARNING: JWT_SECRET is using default placeholder. Ensure strong JWT_SECRET is configured in environment variables.");
    }
    return "default_super_secret_key_change_me_in_production";
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();

function base64urlEncode(str: string): string {
  return Buffer.from(str).toString("base64url");
}

function base64urlEncodeBytes(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

export async function signJWT(payload: { email: string; username: string; role: string }): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + 7 * 24 * 60 * 60, // 7 days
  };
  const encodedPayload = base64urlEncode(JSON.stringify(fullPayload));

  const encoder = new TextEncoder();
  const secretKeyData = encoder.encode(JWT_SECRET);
  const key = await crypto.subtle.importKey(
    "raw",
    secretKeyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureInputData = encoder.encode(`${encodedHeader}.${encodedPayload}`);
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, signatureInputData);
  const encodedSignature = base64urlEncodeBytes(new Uint8Array(signatureBuffer));

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

async function setAuthCookie(user: { email: string; username: string; role: string }) {
  try {
    const token = await signJWT(user);
    const cookieStore = await cookies();
    cookieStore.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
  } catch (err) {
    console.error("Failed to set auth cookie:", err);
  }
}

export interface RegisterUserParams {
  email: string;
  password: string;
  username: string;
  role: "user" | "authority" | "chief";
  phone?: string;
  state?: string;
  district?: string;
  pincode?: string;
  idType?: string;
  idNumber?: string;
  dob?: string;
  authorityRole?: string;
  serviceId?: string;
  workingPlace?: string;
  passcode?: string;
}

export async function registerUserServerAction(params: RegisterUserParams): Promise<{
  success: boolean;
  error?: string;
  user?: { email: string; username: string; role: string };
}> {
  const ip = await getClientIp();

  // Enforce rate limit: max 3 account registrations per 10 minutes per IP
  const rateResult = checkRateLimit(ip, "register", 3, 600000);
  if (!rateResult.success) {
    return {
      success: false,
      error: `Registration rate limit exceeded. Please wait ${rateResult.retryAfterSeconds}s before creating another account.`,
    };
  }

  const email = (params.email || "").toLowerCase().trim();
  const username = (params.username || "").trim();
  const role = params.role || "user";
  const password = params.password;

  if (!email || !password) {
    return { success: false, error: "Email and password are required." };
  }

  // Enforce password complexity policy
  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters long." };
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return {
      success: false,
      error: "Password must contain at least one uppercase letter, one lowercase letter, and one number.",
    };
  }

  // Enforce administrative secret passphrases for elevated roles
  const CHIEF_PASSPHRASE = process.env.CHIEF_PASSPHRASE || "Ch-Falcon20";
  const AUTHORITY_PASSPHRASE = process.env.AUTHORITY_PASSPHRASE || "Au-Titan18";

  if (role === "chief") {
    if (!params.passcode || params.passcode.trim() !== CHIEF_PASSPHRASE) {
      return { success: false, error: "Access Denied: Invalid Chief Administrator verification passphrase." };
    }
  } else if (role === "authority") {
    if (!params.passcode || params.passcode.trim() !== AUTHORITY_PASSPHRASE) {
      return { success: false, error: "Access Denied: Invalid Field Officer verification passphrase." };
    }
  }

  // 1. Try Java Spring Boot REST API first if running locally
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${SPRING_BOOT_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        username,
        role,
        phone: params.phone,
        state: params.state,
        district: params.district,
        pincode: params.pincode,
        idType: params.idType,
        idNumber: params.idNumber,
        dob: params.dob,
        authorityRole: params.authorityRole,
        serviceId: params.serviceId,
        passcode: params.passcode,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        return data;
      }
    }
  } catch {
    // Spring Boot offline/unreachable on cloud, proceed with direct Supabase cloud registration
  }

  // 2. Direct Supabase Cloud Registration
  try {
    // Check if user already exists
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=email`, {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (checkRes.ok) {
      const existing = await checkRes.json();
      if (Array.isArray(existing) && existing.length > 0) {
        return { success: false, error: "Email is already registered. Please log in." };
      }
    }

    // Hash password with standard BCrypt (compatible with Spring Boot BCryptPasswordEncoder)
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        email,
        username: username || "Citizen User",
        password_hash: passwordHash,
        role,
        phone: params.phone || "",
        state: params.state || "",
        district: params.district || "",
        pincode: params.pincode || "",
        id_type: params.idType || "aadhaar",
        dob: params.dob || "",
        authority_role: params.authorityRole || null,
        service_id: params.serviceId || null,
        created_at: new Date().toISOString(),
      }),
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error("⚠️ Supabase user insert failed:", errText);
      return { success: false, error: "Failed to save user in database." };
    }

    return {
      success: true,
      user: {
        email,
        username: username || "Citizen User",
        role,
      },
    };
  } catch (err) {
    console.error("⚠️ Registration error:", err);
    return { success: false, error: "Database connection failed. Please try again." };
  }
}

export async function loginUserServerAction(credentials: {
  email: string;
  password: string;
  role: string;
}): Promise<{
  success: boolean;
  error?: string;
  user?: { email: string; username: string; role: string };
}> {
  const ip = await getClientIp();

  // Enforce rate limit: max 5 login attempts per minute per IP (brute-force defense)
  const rateResult = checkRateLimit(ip, "login", 5, 60000);
  if (!rateResult.success) {
    return {
      success: false,
      error: `Too many login attempts. Please wait ${rateResult.retryAfterSeconds}s before trying again.`,
    };
  }

  const email = (credentials.email || "").toLowerCase().trim();
  const password = credentials.password;
  const role = credentials.role;

  // Demo accounts (only active when explicitly enabled in environment)
  const isDemoEnabled = process.env.ENABLE_DEMO_ACCOUNTS === "true" || process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const DEMO_USERS: Record<string, { name: string; pass: string; role: string }> = {
    "user@demo.com": { name: "Rahul Sharma", pass: "user123", role: "user" },
    "authority@demo.com": { name: "Officer Priya", pass: "auth123", role: "authority" },
    "chief@demo.com": { name: "Chief Kumar", pass: "chief123", role: "chief" },
  };

  if (isDemoEnabled && DEMO_USERS[email]) {
    const demo = DEMO_USERS[email];
    if (demo.role === role && demo.pass === password) {
      const user = { email, username: demo.name, role: demo.role };
      await setAuthCookie(user);
      return { success: true, user };
    }
    return { success: false, error: "Invalid demo credentials." };
  }

  // 1. Try Java Spring Boot REST API first if running locally
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${SPRING_BOOT_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.user) {
        await setAuthCookie(data.user);
        return data;
      }
    }
  } catch {
    // Spring Boot offline/unreachable on cloud, proceed with direct Supabase verification
  }

  // 2. Direct Supabase Cloud Login Verification
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&role=eq.${encodeURIComponent(role)}&select=*`,
      {
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );

    if (res.ok) {
      const users = await res.json();
      if (Array.isArray(users) && users.length > 0) {
        const user = users[0];
        const hash = user.password_hash || "";

        let isMatch = false;
        try {
          isMatch = bcrypt.compareSync(password, hash);
        } catch {}

        if (isMatch) {
          const authUser = {
            email: user.email,
            username: user.username,
            role: user.role,
          };
          await setAuthCookie(authUser);
          return {
            success: true,
            user: authUser,
          };
        } else {
          return { success: false, error: "Incorrect password. Please try again." };
        }
      } else {
        return { success: false, error: `No ${role} account found for this email. Please create an account first.` };
      }
    }
  } catch (err) {
    console.error("⚠️ Login verification error:", err);
  }

  return { success: false, error: "Connection error. Please try again." };
}

/**
 * Get verified session directly from HTTP-only auth_token cookie
 */
export async function getVerifiedSessionServerAction(): Promise<{
  authenticated: boolean;
  user: { email: string; username: string; role: "user" | "authority" | "chief" } | null;
}> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return { authenticated: false, user: null };

    const parts = token.split(".");
    if (parts.length !== 3) return { authenticated: false, user: null };

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signatureInputData = encoder.encode(`${encodedHeader}.${encodedPayload}`);
    const signatureBytes = Buffer.from(encodedSignature, "base64url");

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      signatureInputData
    );

    if (!isValid) return { authenticated: false, user: null };

    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf-8"));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return { authenticated: false, user: null };
    }

    return {
      authenticated: true,
      user: {
        email: payload.email,
        username: payload.username,
        role: payload.role,
      },
    };
  } catch (err) {
    console.error("Session verification error:", err);
    return { authenticated: false, user: null };
  }
}

/**
 * Backward compatible session verification (never trusts unverified client roles)
 */
export async function syncSessionCookieServerAction(_untrustedUser: { email: string; username: string; role: string }) {
  // Verify existing cryptographic cookie rather than accepting client-supplied role
  const verified = await getVerifiedSessionServerAction();
  return { success: verified.authenticated };
}

/**
 * Clear auth cookie on logout
 */
export async function logoutServerAction() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("auth_token");
    return { success: true };
  } catch (err) {
    console.error("Failed to delete auth cookie:", err);
    return { success: false };
  }
}
