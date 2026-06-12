import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { supabase } from "@/lib/supabase";
import { verifyVerificationToken } from "@/lib/auth";

const DEMO_EMAILS = ["user@demo.com", "authority@demo.com", "chief@demo.com"];

/** Deterministic SHA-256 hash of a normalised ID string.
 *  We always uppercase + strip spaces before hashing so that
 *  "1234 5678 9012" and "123456789012" produce the same hash. */
function hashId(raw: string): string {
    const normalised = raw.trim().toUpperCase().replace(/\s+/g, "");
    return createHash("sha256").update(normalised).digest("hex");
}

/** Validate that a Date-of-Birth string represents someone aged ≥ 18. */
function isAtLeast18(dob: string): boolean {
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return false;
    const today = new Date();
    const age18 = new Date(birth.getFullYear() + 18, birth.getMonth(), birth.getDate());
    return today >= age18;
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            email: rawEmail,
            password,
            username,
            role,
            phone,
            state,
            district,
            pincode,
            idType,
            idNumber,   // raw – we hash it and NEVER store the plain text
            dob,        // Date of Birth (citizens only)
            authorityRole,
            serviceId,
            otpToken,   // signed token verifying email ownership
            passcode,   // security gate passcode
        } = body;

        const email = rawEmail ? rawEmail.toLowerCase().trim() : "";

        // ── Basic required-field check ─────────────────────────────────
        if (!email || !password || !username || !role) {
            return NextResponse.json(
                { success: false, error: "Missing required fields" },
                { status: 400 }
            );
        }

        // ── Admin passcode gate security ──────────────────────────────
        if (role === "authority") {
            const expected = process.env.AUTHORITY_PASSPHRASE || "auth_secure_pass_2026";
            if (!passcode || passcode.trim() !== expected.trim()) {
                return NextResponse.json(
                    { success: false, error: "Access Denied: Invalid Authority security passcode.", field: "passcode" },
                    { status: 403 }
                );
            }
        } else if (role === "chief") {
            const expected = process.env.CHIEF_PASSPHRASE || "chief_secure_pass_2026";
            if (!passcode || passcode.trim() !== expected.trim()) {
                return NextResponse.json(
                    { success: false, error: "Access Denied: Invalid Chief Administrator security passcode.", field: "passcode" },
                    { status: 403 }
                );
            }
        }

        // ── Block demo email reuse ─────────────────────────────────────
        if (DEMO_EMAILS.includes(email)) {
            return NextResponse.json(
                { success: false, error: "This email is reserved for demo accounts." },
                { status: 400 }
            );
        }

        // ── Check if email already taken in Supabase ───────────────────
        const { data: existingUser, error: emailError } = await supabase
            .from("users")
            .select("email")
            .eq("email", email)
            .maybeSingle();

        if (emailError) {
            console.error("Database query error:", emailError);
            return NextResponse.json({ success: false, error: "Database error." }, { status: 500 });
        }

        if (existingUser) {
            return NextResponse.json(
                { success: false, error: "Email already registered" },
                { status: 409 }
            );
        }

        // ── Check if phone already taken in Supabase (if provided) ──────
        if (phone) {
            const formattedPhone = phone.trim();
            const { data: existingPhone, error: phoneError } = await supabase
                .from("users")
                .select("phone")
                .eq("phone", formattedPhone)
                .maybeSingle();

            if (phoneError) {
                console.error("Database phone check error:", phoneError);
                return NextResponse.json({ success: false, error: "Database error." }, { status: 500 });
            }

            if (existingPhone) {
                return NextResponse.json(
                    { success: false, error: "Phone number already registered.", field: "phone" },
                    { status: 409 }
                );
            }
        }

        // ── Verify email OTP cryptographically on server ───────────────
        if (!otpToken || !verifyVerificationToken(otpToken, email)) {
            return NextResponse.json(
                { success: false, error: "Please verify your email address with the OTP code first.", field: "email" },
                { status: 400 }
            );
        }

        // ── Citizen-only validations ───────────────────────────────────
        let idHash: string | undefined;
        if (role === "user") {
            // 1️⃣  DOB + Age 18+ check
            if (!dob) {
                return NextResponse.json(
                    { success: false, error: "Date of birth is required.", field: "dob" },
                    { status: 400 }
                );
            }
            if (!isAtLeast18(dob)) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "You must be 18 years or older to register.",
                        field: "dob",
                    },
                    { status: 400 }
                );
            }

            // 2️⃣  One ID = One account (SHA-256 duplicate check in Supabase)
            if (idNumber) {
                idHash = hashId(idNumber);
                const { data: existingIdHash, error: idHashError } = await supabase
                    .from("users")
                    .select("email")
                    .eq("id_hash", idHash)
                    .maybeSingle();

                if (idHashError) {
                    console.error("Database query error (id_hash):", idHashError);
                    return NextResponse.json({ success: false, error: "Database error." }, { status: 500 });
                }

                if (existingIdHash) {
                    return NextResponse.json(
                        {
                            success: false,
                            error: `This ${idType || "Government ID"} is already registered with another account.`,
                            field: "idNumber",
                        },
                        { status: 409 }
                    );
                }
            }
        }

        // ── Hash password with bcrypt (12 salt rounds for extra security) ─
        const passwordHash = await bcrypt.hash(password, 12);

        // ── Build the user record – NEVER include plain idNumber ──
        const userRecord: Record<string, string | null | undefined> = {
            email,
            password_hash: passwordHash,   // bcrypt hash, never plain text
            username,
            role,
            phone: phone || null,
            state: state || null,
            district: district || null,
            pincode: pincode || null,
        };

        // Store idType + idHash for citizens; skip plain idNumber entirely
        if (role === "user") {
            userRecord.id_type = idType || "aadhaar";
            userRecord.id_hash = idHash || null;   // ← hash only, never raw
            userRecord.dob = dob || null;
        } else if (role === "authority") {
            userRecord.authority_role = authorityRole || null;
            userRecord.service_id = serviceId || null;
        }

        // ── Insert into Supabase ───────────────────────────────────────
        const { error: insertError } = await supabase
            .from("users")
            .insert(userRecord);

        if (insertError) {
            console.error("Database insert error:", insertError);
            return NextResponse.json({ success: false, error: "Failed to save user record." }, { status: 500 });
        }

        // Return client-safe object (omit password_hash)
        const safeUser = {
            email,
            username,
            role,
            phone,
            state,
            district,
            pincode,
            idType: userRecord.id_type,
            idHash: userRecord.id_hash,
            dob: userRecord.dob,
            authorityRole: userRecord.authority_role,
            serviceId: userRecord.service_id,
        };

        return NextResponse.json({ success: true, user: safeUser });

    } catch (err) {
        console.error("Register API error:", err);
        return NextResponse.json(
            { success: false, error: "Server error" },
            { status: 500 }
        );
    }
}

