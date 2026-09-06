"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lxjevqkbkxafqknevbwf.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_TbfQF0Q4zPSBZn_XsyZHhA_E_oNyx-M";
const SPRING_BOOT_URL = process.env.NEXT_PUBLIC_SPRING_BOOT_URL || "http://localhost:8080";
const JWT_SECRET = process.env.JWT_SECRET || "default_super_secret_key_change_me_in_production";

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
  const email = (params.email || "").toLowerCase().trim();
  const username = (params.username || "").trim();
  const role = params.role || "user";
  const password = params.password;

  if (!email || !password) {
    return { success: false, error: "Email and password are required." };
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
  const email = (credentials.email || "").toLowerCase().trim();
  const password = credentials.password;
  const role = credentials.role;

  // Demo accounts
  const DEMO_USERS: Record<string, { name: string; pass: string; role: string }> = {
    "user@demo.com": { name: "Rahul Sharma", pass: "user123", role: "user" },
    "authority@demo.com": { name: "Officer Priya", pass: "auth123", role: "authority" },
    "chief@demo.com": { name: "Chief Kumar", pass: "chief123", role: "chief" },
  };

  if (DEMO_USERS[email]) {
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
        if (!isMatch && hash === password) {
          isMatch = true;
        }

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
 * Sync cookie for client sessions restored from localStorage
 */
export async function syncSessionCookieServerAction(user: { email: string; username: string; role: string }) {
  if (user && user.email && user.role) {
    await setAuthCookie(user);
    return { success: true };
  }
  return { success: false };
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
