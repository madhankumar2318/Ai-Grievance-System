import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET || "default_super_secret_key_change_me_in_production";

function base64urlDecode(str: string): string {
    let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
        base64 += "=";
    }
    return atob(base64);
}

function base64urlDecodeToBytes(str: string): Uint8Array {
    const binaryString = base64urlDecode(str);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

interface JWTPayload {
    email: string;
    username: string;
    role: string;
    iat?: number;
    exp?: number;
}

async function verifyJWTEdge(token: string, secret: string): Promise<JWTPayload | null> {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return null;

        const [encodedHeader, encodedPayload, encodedSignature] = parts;

        const encoder = new TextEncoder();
        const secretKeyData = encoder.encode(secret);
        const key = await crypto.subtle.importKey(
            "raw",
            secretKeyData,
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["verify"]
        );

        const signatureInputData = encoder.encode(`${encodedHeader}.${encodedPayload}`);
        const signatureBytes = base64urlDecodeToBytes(encodedSignature);

        const isValid = await crypto.subtle.verify(
            "HMAC",
            key,
            signatureBytes as unknown as BufferSource,
            signatureInputData
        );

        if (!isValid) return null;

        const payloadStr = base64urlDecode(encodedPayload);
        const payload = JSON.parse(payloadStr) as JWTPayload;

        if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
            return null;
        }

        return payload;
    } catch (err) {
        console.error("JWT Edge verification error:", err);
        return null;
    }
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const isAdminRoute = pathname.startsWith("/admin");
    const isChiefRoute = pathname.startsWith("/chief");

    if (isAdminRoute || isChiefRoute) {
        const token = request.cookies.get("auth_token")?.value;

        if (token) {
            const payload = await verifyJWTEdge(token, JWT_SECRET);
            if (!payload) {
                const response = NextResponse.redirect(new URL("/login", request.url));
                response.cookies.delete("auth_token");
                return response;
            }

            // Role authorization check
            if (isChiefRoute && payload.role !== "chief") {
                if (payload.role === "authority") {
                    return NextResponse.redirect(new URL("/admin", request.url));
                }
                return NextResponse.redirect(new URL("/", request.url));
            }

            if (isAdminRoute && payload.role !== "authority" && payload.role !== "chief") {
                return NextResponse.redirect(new URL("/", request.url));
            }
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/admin/:path*", "/chief/:path*"],
};
