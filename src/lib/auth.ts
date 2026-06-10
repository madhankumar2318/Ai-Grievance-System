import { createHmac } from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "default_super_secret_key_change_me_in_production";

function base64urlEncode(buffer: Buffer): string {
    return buffer.toString("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
}

function base64urlDecode(str: string): string {
    let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
        base64 += "=";
    }
    return Buffer.from(base64, "base64").toString("utf8");
}

export interface JWTPayload {
    email: string;
    username: string;
    role: string;
    iat?: number;
    exp?: number;
}

/**
 * Sign a payload into a JWT token using HMAC-SHA256
 */
export function signJWT(payload: Omit<JWTPayload, "iat" | "exp">, durationSeconds: number = 86400): string {
    const header = { alg: "HS256", typ: "JWT" };
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + durationSeconds;
    
    const fullPayload: JWTPayload = {
        ...payload,
        iat,
        exp
    };

    const encodedHeader = base64urlEncode(Buffer.from(JSON.stringify(header)));
    const encodedPayload = base64urlEncode(Buffer.from(JSON.stringify(fullPayload)));

    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const signature = createHmac("sha256", JWT_SECRET)
        .update(signatureInput)
        .digest();
    
    const encodedSignature = base64urlEncode(signature);

    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

/**
 * Verify a JWT token and decode its payload
 */
export function verifyJWT(token: string): JWTPayload | null {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return null;

        const [encodedHeader, encodedPayload, encodedSignature] = parts;

        // Verify signature
        const signatureInput = `${encodedHeader}.${encodedPayload}`;
        const calculatedSignature = base64urlEncode(
            createHmac("sha256", JWT_SECRET)
                .update(signatureInput)
                .digest()
        );

        if (calculatedSignature !== encodedSignature) {
            return null; // Signature verification failed
        }

        // Decode payload
        const payloadStr = base64urlDecode(encodedPayload);
        const payload = JSON.parse(payloadStr) as JWTPayload;

        // Check expiration
        if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
            return null; // Token expired
        }

        return payload;
    } catch (err) {
        console.error("JWT verification error:", err);
        return null;
    }
}

/**
 * Sign an email verification token (valid for 15 minutes / 900 seconds)
 */
export function signVerificationToken(email: string): string {
    return signJWT({ email, username: "", role: "verification" }, 900);
}

/**
 * Verify an email verification token
 */
export function verifyVerificationToken(token: string, expectedEmail: string): boolean {
    const payload = verifyJWT(token);
    if (!payload) return false;
    return payload.role === "verification" && payload.email.toLowerCase() === expectedEmail.toLowerCase();
}

