// app/api/payments/checkout/route.ts
// ============================================================
// CHECKOUT — Dodo Payments $2 one-time plan
// Creates a hosted payment link and returns the URL.
// User is redirected to Dodo's checkout page, then back to
// the exact page they were on (editor or review results).
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

    // ── 2. Parse body — get returnUrl from client ───────────
    // returnUrl is the page the user was on (editor or review).
    // Falls back to /dashboard if not provided.
    let returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`;
    try {
      const body = await request.json();
      if (body?.returnUrl && typeof body.returnUrl === "string") {
        // Only allow same-origin URLs — strip host, keep path+query
        const parsed = new URL(body.returnUrl, process.env.NEXT_PUBLIC_APP_URL);
        const appOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL!).origin;
        if (parsed.origin === appOrigin) {
          // Append ?payment=success so the page can show the success banner
          parsed.searchParams.set("payment", "success");
          returnUrl = parsed.toString();
        }
      }
    } catch {
      // body parse failed — use default returnUrl
    }

    const profile = await getUserProfile(uid);

    // ── 3. Create payment link ──────────────────────────────
    const paymentUrl = await createLifetimePaymentLink(
      profile?.email ?? decoded.email ?? "",
      profile?.displayName ?? decoded.name ?? "User",
      uid,        // stored in metadata — used by webhook to identify user
      returnUrl   // where Dodo redirects after payment
    );

    return NextResponse.json({ url: paymentUrl });
  } catch (err) {
    const error = err as Error;

    if (error.message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    console.error("[POST /api/payments/checkout]", error);
    return NextResponse.json(
      { error: "Could not create checkout session. Please try again." },
      { status: 500 }
    );
  }
}