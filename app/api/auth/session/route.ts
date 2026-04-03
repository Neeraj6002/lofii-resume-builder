// app/api/auth/session/route.ts
// ============================================================
// SESSION CREATION — Exchange Firebase ID token for session cookie
// Called after successful client-side Firebase authentication
// Sets HTTP-only __session cookie that middleware can read
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idToken } = body;

    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json(
        { error: "ID token required" },
        { status: 400 }
      );
    }

    // Verify the Firebase ID token
    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(idToken, true);

    // Get full user record to access custom claims
    const userRecord = await adminAuth.getUser(decodedToken.uid);

    // Create session data (you can add more fields if needed)
    const sessionData = {
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      photoURL: userRecord.photoURL,
      isPremium: userRecord.customClaims?.isPremium ?? false,
    };

    // Create a session cookie (valid for 7 days)
    const expiresIn = 60 * 60 * 24 * 7 * 1000; // 7 days in milliseconds
    const sessionCookie = await adminAuth.createSessionCookie(
      idToken,
      { expiresIn }
    );

    // Set HTTP-only cookie
    const response = NextResponse.json(
      { success: true, user: sessionData },
      { status: 200 }
    );

    response.cookies.set("__session", sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
      path: "/",
    });

    return response;
  } catch (error: unknown) {
    console.error("Session creation error:", error);
    const message = error instanceof Error ? error.message : "Failed to create session";
    return NextResponse.json(
      { error: "Authentication failed", details: message },
      { status: 401 }
    );
  }
}

export async function GET() {
  // Optional: endpoint to check current session
  return NextResponse.json({ endpoint: "POST /api/auth/session" });
}
