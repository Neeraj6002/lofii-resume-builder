// middleware.ts
// ============================================================
// MIDDLEWARE — Auth gate + Security headers
// Runs on Node.js runtime (required for Firebase Admin).
// Verifies session cookie for protected routes.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication
const PROTECTED_ROUTES = ["/dashboard", "/resume", "/review"];

// Routes that should redirect logged-in users away
const AUTH_ROUTES = ["/login", "/register"];

export async function middleware(request: NextRequest) {
  const { pathname }  = request.nextUrl;
  const sessionCookie = request.cookies.get("__session")?.value;
  let isAuthenticated = false;

  // Verify session cookie using Firebase Admin
  if (sessionCookie) {
    try {
      // Dynamic import so Firebase Admin only loads on server
      const { getAdminAuth } = await import("@/lib/firebase/admin");
      const adminAuth = getAdminAuth();
      await adminAuth.verifySessionCookie(sessionCookie, true);
      isAuthenticated = true;
    } catch {
      isAuthenticated = false;
    }
  }

  // ── Auth Guards ─────────────────────────────────────────────
  const isProtected = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // ── Security Headers ─────────────────────────────────────────
  const response = NextResponse.next();

  response.headers.set("X-Frame-Options",           "DENY");
  response.headers.set("X-Content-Type-Options",    "nosniff");
  response.headers.set("X-XSS-Protection",          "1; mode=block");
  response.headers.set("Referrer-Policy",            "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy",         "camera=(), microphone=(), geolocation=(), payment=()");

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://apis.google.com https://accounts.google.com https://*.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://lh3.googleusercontent.com https://*.google.com https://*.gstatic.com",
      "connect-src 'self' https://*.googleapis.com https://*.firebase.com https://*.firebaseio.com https://openrouter.ai https://*.dodopayments.com https://accounts.google.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://unpkg.com",
      "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com",
      "frame-ancestors 'none'",
    ].join("; ")
  );

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
  runtime: "nodejs",
};