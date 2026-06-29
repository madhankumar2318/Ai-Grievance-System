import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Base64url decoder compatible with Next.js Edge Runtime (atob)
function decodeJWT(token: string) {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return null;

        // Convert base64url to standard base64
        let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        while (base64.length % 4) {
            base64 += "=";
        }

        const payloadStr = atob(base64);
        const payload = JSON.parse(payloadStr);

        // Expiration check (exp is in seconds)
        if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
            return null;
        }

        return payload;
    } catch {
        return null;
    }
}

export function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;
    const authToken = request.cookies.get("auth_token")?.value;
    const user = authToken ? decodeJWT(authToken) : null;

    // 1. Guard Admin Dashboard (/admin)
    if (path.startsWith("/admin")) {
        if (!user || user.role !== "authority") {
            const loginUrl = new URL("/login", request.url);
            const response = NextResponse.redirect(loginUrl);
            response.cookies.delete("auth_token");
            return response;
        }
    }

    // 2. Guard Chief Dashboard (/chief)
    if (path.startsWith("/chief")) {
        if (!user || user.role !== "chief") {
            const loginUrl = new URL("/login", request.url);
            const response = NextResponse.redirect(loginUrl);
            response.cookies.delete("auth_token");
            return response;
        }
    }

    // 3. Guard Login route (prevent logged-in users from viewing login screen again)
    if (path === "/login") {
        if (user) {
            if (user.role === "authority") {
                return NextResponse.redirect(new URL("/admin", request.url));
            }
            if (user.role === "chief") {
                return NextResponse.redirect(new URL("/chief", request.url));
            }
            if (user.role === "user") {
                return NextResponse.redirect(new URL("/", request.url));
            }
        }
    }

    return NextResponse.next();
}

// Map the middleware to only run on protected routes and login page
export const config = {
    matcher: ["/admin/:path*", "/chief/:path*", "/login"],
};
