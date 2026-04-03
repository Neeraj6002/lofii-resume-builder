// app/api/payments/checkout/route.ts
// ============================================================
// CHECKOUT — Dodo Payments lifetime plan
// Creates a hosted payment link and returns the URL.
// User is redirected to Dodo's checkout page.
// ============================================================

import { NextResponse } from "next/server";
import { verifyAuthToken, getUserProfile } from "@/lib/firebase/auth";
import { createLifetimePaymentLink } from "@/lib/payments/dodo";

export async function POST(request: Request) {
  try {
    // ── 1. Verify auth ──────────────────────────────────────
    const authHeader = request.headers.get("Authorization");
    const decoded = await verifyAuthToken(authHeader);
    const uid = decoded.uid;

    // ── 2. Check if already premium ────────────────────────
    // Prevent double payment — no point creating a link for existing premium
    const profile = await getUserProfile(uid);

    if (profile?.isPremium) {
      return NextResponse.json(
        { error: "You already have a premium account." },
        { status: 400 }
      );
    }

    // ── 3. Create payment link ──────────────────────────────
    const paymentUrl = await createLifetimePaymentLink(
      profile?.email ?? decoded.email ?? "",
      profile?.displayName ?? decoded.name ?? "User",
      uid // Stored in metadata — used by webhook to identify user
    );

    return NextResponse.json({ url: paymentUrl });
  } catch (err) {
    const error = err as Error;

    if (error.message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Don't expose Dodo API error details to client
    console.error("[POST /api/payments/checkout]", error);
    return NextResponse.json(
      { error: "Could not create checkout session. Please try again." },
      { status: 500 }
    );
  }
}