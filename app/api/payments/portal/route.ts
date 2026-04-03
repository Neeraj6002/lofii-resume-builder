// app/api/payments/portal/route.ts
// ============================================================
// PAYMENT PORTAL
// Returns the user's payment history and subscription status.
// Used on a billing/account page to show transaction details.
// ============================================================

import { NextResponse } from "next/server";
import { verifyAuthToken, getUserProfile } from "@/lib/firebase/auth";

export async function GET(request: Request) {
  try {
    // ── 1. Verify auth ──────────────────────────────────────
    const authHeader = request.headers.get("Authorization");
    const decoded    = await verifyAuthToken(authHeader);
    const uid        = decoded.uid;

    // ── 2. Get user profile ─────────────────────────────────
    const profile = await getUserProfile(uid);

    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ── 3. Return safe billing info ─────────────────────────
    // Never expose full payment details — only what the user needs
    return NextResponse.json({
      isPremium: profile.isPremium,
      subscription: {
        status:    profile.subscription.status,
        plan:      profile.subscription.plan,
        purchasedAt: profile.subscription.purchasedAt,
        transactionHistory: profile.subscription.transactionHistory.map(t => ({
          transactionId: t.transactionId,
          amount:        t.amount,
          currency:      t.currency,
          status:        t.status,
          date:          t.date,
        })),
      },
    });
  } catch (err) {
    const error = err as Error;
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[GET /api/payments/portal]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}