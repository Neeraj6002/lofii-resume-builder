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
        credits:   { review: 0, builder: 0 },
      });
    }

    return NextResponse.json({
      isPremium: profile.isPremium ?? false,
      credits: {
        review:  profile.credits?.review  ?? 0,
        builder: profile.credits?.builder ?? 0,
      },
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