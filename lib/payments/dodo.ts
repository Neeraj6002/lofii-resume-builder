// lib/payments/dodo.ts
// ============================================================
// DODO PAYMENTS SERVICE — SERVER ONLY
//
// WEBHOOK KEY NOTE:
// DODO_PAYMENTS_WEBHOOK_KEY must be the *signing secret* for your
// specific webhook endpoint — NOT the API key.
// Find it: Dodo Dashboard → Webhooks → your endpoint → "Signing Secret"
// It starts with "whsec_" and is base64-encoded.
// A wrong key causes "No matching signature found" on every webhook.
// ============================================================

import DodoPayments from "dodopayments";

export const dodoClient = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
  webhookKey:  process.env.DODO_PAYMENTS_WEBHOOK_KEY!,
  environment: process.env.NODE_ENV === "production" ? "live_mode" : "test_mode",
});

export async function createLifetimePaymentLink(
  customerEmail: string,
  customerName:  string,
  userId:        string,
  returnUrl:     string,
): Promise<string> {
  const productId = process.env.DODO_LIFETIME_PRODUCT_ID!;

  const payment = await dodoClient.payments.create({
    payment_link: true,
    billing: {
      city:    "",
      country: "IN",
      state:   "",
      street:  "",
      zipcode: "",
    },
    customer: {
      email: customerEmail,
      name:  customerName,
    },
    product_cart: [{ product_id: productId, quantity: 1 }],
    return_url:   returnUrl,
    metadata: {
      userId,
      plan: "lifetime",
    },
  });

  if (!payment.payment_link) {
    throw new Error("Failed to create payment link — Dodo returned no URL");
  }

  return payment.payment_link;
}

// ─── Webhook payload type ─────────────────────────────────────
export interface DodoWebhookPayload {
  type:        string;
  business_id: string;
  timestamp:   string;
  data: {
    payment_id:    string;
    status:        string;
    total_amount:  number;
    currency:      string;
    customer: {
      customer_id:  string;
      email:        string;
      name:         string;
    };
    metadata?: {
      userId?: string;
      plan?:   string;
    };
  };
}