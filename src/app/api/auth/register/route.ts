import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";

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
            email,
            password,
            username,
            role,
            registeredUsers = [],
            idType,
            idNumber,   // raw – we hash it and NEVER store the plain text
            dob,        // Date of Birth (citizens only)
            ...metadata // remaining safe fields (phone, state, district…)
        } = body;

        // ── Basic required-field check ─────────────────────────────────
        if (!email || !password || !username || !role) {
            return NextResponse.json(
                { success: false, error: "Missing required fields" },
                { status: 400 }
            );
        }

        // ── Block demo email reuse ─────────────────────────────────────
        if (DEMO_EMAILS.includes(email)) {
            return NextResponse.json(
                { success: false, error: "This email is reserved for demo accounts." },
                { status: 400 }
            );
        }

        // ── Check if email already taken ───────────────────────────────
        const emailTaken = (registeredUsers as { email: string }[]).some(
            (u) => u.email === email
        );
        if (emailTaken) {
            return NextResponse.json(
                { success: false, error: "Email already registered" },
                { status: 409 }
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

            // 2️⃣  One ID = One account (SHA-256 duplicate check)
            if (idNumber) {
                idHash = hashId(idNumber);
                const idTaken = (
                    registeredUsers as { idHash?: string }[]
                ).some((u) => u.idHash && u.idHash === idHash);

                if (idTaken) {
                    const idLabel =
                        idType === "pan"
                            ? "PAN Card"
                            : idType === "license"
                            ? "Driving License"
                            : "Aadhaar Card";
                    return NextResponse.json(
                        {
                            success: false,
                            error: `This ${idLabel} is already registered with another account.`,
                            field: "idNumber",
                        },
                        { status: 409 }
                    );
                }
            }
        }

        // ── Hash password with bcrypt (12 salt rounds for extra security) ─
        const passwordHash = await bcrypt.hash(password, 12);

        // ── Build the safe user record – NEVER include plain idNumber ──
        const safeUser: Record<string, unknown> = {
            email,
            passwordHash,   // bcrypt hash, never plain text
            username,
            role,
            ...metadata,    // phone, state, district, pincode etc.
        };

        // Store idType + idHash for citizens; skip plain idNumber entirely
        if (role === "user") {
            if (idType) safeUser.idType = idType;
            if (idHash) safeUser.idHash = idHash;   // ← hash only, never raw
            if (dob) safeUser.dob = dob;
        }

        return NextResponse.json({ success: true, user: safeUser });

    } catch (err) {
        console.error("Register API error:", err);
        return NextResponse.json(
            { success: false, error: "Server error" },
            { status: 500 }
        );
    }
}
