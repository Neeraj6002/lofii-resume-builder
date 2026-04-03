// app/api/payments/webhook/route.ts
// ============================================================
// DODO PAYMENTS WEBHOOK
// Receives payment events from Dodo and upgrades user.
//
// SECURITY:
// - Signature verified using Standard Webhooks spec
// - Raw body read before any parsing (signature requires it)
// - userId pulled from metadata set at checkout (not from client)
// - Idempotent — safe to receive the same event twice
// ============================================================

import { NextResponse } from "next/server";
import { dodoWebhook } from "@/lib/payments/dodo";
import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import type { DodoWebhookPayload } from "@/lib/payments/dodo";

// IMPORTANT: Disable body parsing — we need the raw bytes for signature verification
export const runtime = "nodejs";

export async function POST(request: Request) {
  // ── 1. Read raw body ──────────────────────────────────────
  // Signature verification requires the exact raw bytes.
  // Any parsing before this will break verification.
  const rawBody = await request.text();

  // ── 2. Extract Dodo signature headers ────────────────────
  const webhookId = request.headers.get("webhook-id");
  const webhookTimestamp = request.headers.get("webhook-timestamp");
  const webhookSignature = request.headers.get("webhook-signature");

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    console.warn("[Webhook] Missing signature headers");
    return NextResponse.json({ error: "Missing headers" }, { status: 400 });
  }

  // ── 3. Verify signature ───────────────────────────────────
  // This cryptographically proves the event came from Dodo,
  // not a malicious third party trying to fake a payment.
  let payload: DodoWebhookPayload;

  try {
    const verified = await dodoWebhook.verify(rawBody, {
      "webhook-id": webhookId,
      "webhook-timestamp": webhookTimestamp,
      "webhook-signature": webhookSignature,
    });
    payload = JSON.parse(verified as string) as DodoWebhookPayload;
  } catch (err) {
    console.warn("[Webhook] Signature verification failed", err);
    // Return 200 to prevent Dodo retrying a legitimately bad request
    // Return 401 for actual forgery attempts
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // ── 4. Handle event types ─────────────────────────────────
  try {
    switch (payload.type) {
      case "payment.succeeded": {
        await handlePaymentSucceeded(payload);
        break;
      }

      case "payment.failed": {
        // Log only — no action needed, user stays on free tier
        console.info("[Webhook] Payment failed", payload.data.payment_id);
        break;
      }

      case "payment.refunded": {
        await handlePaymentRefunded(payload);
        break;
      }

      default:
        // Unknown event type — acknowledge but ignore
        console.info("[Webhook] Unhandled event type:", payload.type);
    }

    // Always return 200 so Dodo doesn't retry
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[Webhook] Handler error:", err);
    // Return 500 so Dodo retries the event
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}

// ─── Event Handlers ──────────────────────────────────────────

async function handlePaymentSucceeded(
  payload: DodoWebhookPayload
): Promise<void> {
  const { payment_id, customer, total_amount, currency, metadata } =
    payload.data;

  // userId was stored in metadata at checkout — never trust anything else
  const userId = metadata?.userId;

  if (!userId) {
    console.error("[Webhook] payment.succeeded missing userId in metadata", {
      payment_id,
    });
    return;
  }

  // Verify user exists before upgrading
  const adminDb = getAdminDb();
  const userRef = adminDb.collection("users").doc(userId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    console.error("[Webhook] User not found for userId:", userId);
    return;
  }

  const now = new Date();

  const transaction = {
    transactionId: payment_id,
    paymentId: payment_id,
    amount: total_amount,
    currency,
    status: "succeeded",
    date: now,
  };

  // Idempotency check — don't upgrade twice for same payment
  const existing = userSnap.data();
  const alreadyProcessed = existing?.subscription?.transactionHistory?.some(
    (t: { transactionId: string }) => t.transactionId === payment_id
  );

  if (alreadyProcessed) {
    console.info("[Webhook] Already processed payment:", payment_id);
    return;
  }

  // Upgrade user to premium (atomic update)
  await userRef.update({
    isPremium: true,
    "subscription.status": "active",
    "subscription.plan": "lifetime",
    "subscription.dodoCustomerId": customer.customer_id,
    "subscription.dodoPaymentId": payment_id,
    "subscription.purchasedAt": now,
    "subscription.transactionHistory": FieldValue.arrayUnion(transaction),
  });

  console.info(`[Webhook] Upgraded user ${userId} to premium (${payment_id})`);
}

async function handlePaymentRefunded(
  payload: DodoWebhookPayload
): Promise<void> {
  const { payment_id, metadata } = payload.data;
  const userId = metadata?.userId;

  if (!userId) {
    console.error("[Webhook] payment.refunded missing userId", { payment_id });
    return;
  }

  // Revoke premium on refund
  const adminDb = getAdminDb();
  await adminDb.collection("users").doc(userId).update({
    isPremium: false,
    "subscription.status": "inactive",
    "subscription.plan": null,
  });

  console.info(`[Webhook] Revoked premium for user ${userId} (refund: ${payment_id})`);
}