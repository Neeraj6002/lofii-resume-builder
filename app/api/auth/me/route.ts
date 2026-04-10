// app/api/auth/me/route.ts
// ============================================================
// CURRENT USER PROFILE
// Returns isPremium and credits from Firestore.
// Called by useAuth on every login/refresh to get the real
// premium status — we do NOT use JWT custom claims for this
// because the webhook only writes to Firestore, not claims.
// ============================================================

import { NextResponse }                   from "next/server";
import { verifyAuthToken, getUserProfile } from "@/lib/firebase/auth";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const decoded    = await verifyAuthToken(authHeader);
    const uid        = decoded.uid;

    const profile = await getUserProfile(uid);

    if (!profile) {
      // User authed but no Firestore doc yet — return safe defaults
      return NextResponse.json({
        isPremium: false,
        credits:   { resumeUnlocks: 0 },
        unlockedResumes: [],
      });
    }

    let resumeUnlocks = profile.credits?.resumeUnlocks ?? (profile.credits as any)?.builder ?? 0;
    if (resumeUnlocks === 0 && profile.isPremium) resumeUnlocks = 1;

    return NextResponse.json({
      isPremium: profile.isPremium ?? false,
      credits: {
        resumeUnlocks,
      },
      unlockedResumes: profile.unlockedResumes ?? [],
    });

  } catch (err) {
    const error = err as Error;
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[GET /api/auth/me]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}