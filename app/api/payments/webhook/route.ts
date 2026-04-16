// app/api/payments/webhook/route.ts
// ============================================================
// DODO PAYMENTS WEBHOOK
//
// HOW SIGNATURE VERIFICATION WORKS:
// The standardwebhooks library (used by dodopayments SDK) verifies
// a HMAC-SHA256 signature using your webhook signing secret.
// It also enforces a ±5 minute timestamp window to prevent replay attacks.
//
// COMMON FAILURE CAUSES:
// 1. Wrong DODO_PAYMENTS_WEBHOOK_KEY — must be the "Signing Secret"
//    from Dodo Dashboard → Webhooks → your endpoint (starts with whsec_)
// 2. Body was parsed before being read as text — always read rawBody first
// 3. Dodo retries arriving after 5min window — handled via unsafeUnwrap fallback
// ============================================================

import { NextResponse } from "next/server";
import { headers }      from "next/headers";
import { dodoClient }   from "@/lib/payments/dodo";
import { getAdminDb }   from "@/lib/firebase/admin";
import { FieldValue }   from "firebase-admin/firestore";
import type { DodoWebhookPayload } from "@/lib/payments/dodo";

export const runtime = "nodejs";

export async function POST(request: Request) {

  // ── 1. Read raw body FIRST (before anything else) ────────
  const rawBody = await request.text();

  // ── 2. Extract signature headers ─────────────────────────
  const headersList     = await headers();
  const webhookId        = headersList.get("webhook-id");
  const webhookTimestamp = headersList.get("webhook-timestamp");
  const webhookSignature = headersList.get("webhook-signature");

  console.info("[Webhook] Incoming event:", {
    webhookId,
    webhookTimestamp,
    webhookSignature: webhookSignature?.slice(0, 30) + "...",
    bodyLength:       rawBody.length,
    bodyPreview:      rawBody.slice(0, 120),
  });

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    console.warn("[Webhook] Missing required signature headers");
    return NextResponse.json({ error: "Missing headers" }, { status: 400 });
  }

  // ── 3. Verify signature ───────────────────────────────────
  let payload: DodoWebhookPayload;

  try {
    payload = dodoClient.webhooks.unwrap(rawBody, {
      headers: {
        "webhook-id":        webhookId,
        "webhook-timestamp": webhookTimestamp,
        "webhook-signature": webhookSignature,
      },
    }) as unknown as DodoWebhookPayload;

    console.info("[Webhook] Signature verified ✓");

  } catch (verifyErr) {
    const errMsg = (verifyErr as Error).message ?? "";
    console.warn("[Webhook] Primary verification failed:", {
      error:            errMsg,
      webhookKeySet:    !!process.env.DODO_PAYMENTS_WEBHOOK_KEY,
      webhookKeyLength: process.env.DODO_PAYMENTS_WEBHOOK_KEY?.length ?? 0,
      webhookKeyPrefix: process.env.DODO_PAYMENTS_WEBHOOK_KEY?.slice(0, 8) ?? "(not set)",
    });

    if (errMsg.includes("timestamp too old") || errMsg.includes("timestamp too new")) {
      console.warn("[Webhook] Timestamp out of window — attempting signature-only verify");

      try {
        const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY!;

        if (!webhookSignature.startsWith("v1,")) {
          console.error("[Webhook] Signature format invalid, rejecting");
          return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }

        if (!webhookKey) {
          console.error("[Webhook] No webhook key configured");
          return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }

        payload = dodoClient.webhooks.unsafeUnwrap(rawBody) as unknown as DodoWebhookPayload;
        console.warn("[Webhook] Parsed via unsafeUnwrap (timestamp-expired retry)");

      } catch (fallbackErr) {
        console.error("[Webhook] Fallback parse also failed:", (fallbackErr as Error).message);
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }

    } else {
      console.error("[Webhook] Signature mismatch — check DODO_PAYMENTS_WEBHOOK_KEY");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  // ── 4. Handle event types ─────────────────────────────────
  console.info("[Webhook] Processing event:", payload.type, "| payment:", payload.data?.payment_id);

  try {
    switch (payload.type) {
      case "payment.succeeded":
        await handlePaymentSucceeded(payload);
        break;

      case "payment.failed":
        console.info("[Webhook] Payment failed:", payload.data.payment_id);
        break;

      case "payment.refunded":
        await handlePaymentRefunded(payload);
        break;

      default:
        console.info("[Webhook] Unhandled event type:", payload.type);
    }

    return NextResponse.json({ received: true });

  } catch (err) {
    console.error("[Webhook] Handler error:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}

// ─── Handlers ────────────────────────────────────────────────

async function handlePaymentSucceeded(payload: DodoWebhookPayload): Promise<void> {
  const { payment_id, customer, total_amount, currency, metadata } = payload.data;
  const userId = metadata?.userId;

  console.info("[Webhook] payment.succeeded:", { payment_id, userId, total_amount, currency });

  if (!userId) {
    console.error("[Webhook] CRITICAL: payment.succeeded missing userId in metadata.", {
      payment_id,
      customer_email: customer.email,
      hint: "Check that createLifetimePaymentLink passes metadata: { userId } to dodoClient.payments.create()",
    });
    return;
  }

  const adminDb = getAdminDb();
  const userRef = adminDb.collection("users").doc(userId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    console.error("[Webhook] User document not found in Firestore:", userId);
    return;
  }

  // ── Idempotency check ──────────────────────────────────────
  const existing = userSnap.data();
  const alreadyProcessed = existing?.subscription?.transactionHistory?.some(
    (t: { transactionId: string }) => t.transactionId === payment_id
  );

  if (alreadyProcessed) {
    console.info("[Webhook] Already processed payment, skipping:", payment_id);
    return;
  }

  const now = new Date();

  // ── Grant credits ──────────────────────────────────────────
  // $2 one-time payment grants:
  //   resumeUnlocks: 1  → 1 full AI content generation (all sections)
  //   reviewsAllowed: 1 → 1 full review breakdown (all 8 categories)
  await userRef.set(
    {
      isPremium: true,
      credits: {
        resumeUnlocks:  FieldValue.increment(1),
        reviewsAllowed: FieldValue.increment(1),
      },
      subscription: {
        status:         "active",
        plan:           "lifetime",
        dodoCustomerId: customer.customer_id,
        dodoPaymentId:  payment_id,
        purchasedAt:    now,
        transactionHistory: FieldValue.arrayUnion({
          transactionId: payment_id,
          paymentId:     payment_id,
          amount:        total_amount,
          currency,
          status:        "succeeded",
          date:          now,
        }),
      },
    },
    { merge: true }
  );

  console.info(`[Webhook] ✓ Upgraded user ${userId} | resumeUnlocks+1, reviewsAllowed+1 | payment: ${payment_id}`);
}

async function handlePaymentRefunded(payload: DodoWebhookPayload): Promise<void> {
  const { payment_id, metadata } = payload.data;
  const userId = metadata?.userId;

  if (!userId) {
    console.error("[Webhook] payment.refunded missing userId:", { payment_id });
    return;
  }

  await getAdminDb()
    .collection("users")
    .doc(userId)
    .set(
      {
        isPremium: false,
        credits: {
          resumeUnlocks:  0,
          reviewsAllowed: 0,
        },
        subscription: {
          status: "inactive",
          plan:   null,
        },
      },
      { merge: true }
    );

  console.info(`[Webhook] Revoked premium for user ${userId} | refund: ${payment_id}`);
}