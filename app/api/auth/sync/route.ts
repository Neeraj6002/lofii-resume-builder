// app/api/auth/sync/route.ts
// ============================================================
// SYNC USER — Create/update user document in Firestore
// Called after signup to initialize user profile
// Expects Authorization: Bearer <idToken>
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization" },
        { status: 401 }
      );
    }

    const idToken = authHeader.slice(7);

    // Verify Firebase ID token
    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Prepare user data
    const userData: Record<string, any> = {
      uid,
      email: decodedToken.email || null,
      displayName: decodedToken.name || decodedToken.email?.split("@")[0] || null,
      photoURL: decodedToken.picture || null,
      updatedAt: new Date().toISOString(),
    };

    // Set createdAt only if new user
    const adminDb = getAdminDb();
    const userRef = adminDb.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      userData.createdAt = new Date().toISOString();
    }

    // Upsert user document
    await userRef.set(userData, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Auth sync error:", error);
    const message = error instanceof Error ? error.message : "Failed to sync user";
    return NextResponse.json(
      { error: "Authentication sync failed", details: message },
      { status: 500 }
    );
  }
}
