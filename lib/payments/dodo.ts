// ============================================================
// DODO PAYMENTS SERVICE — SERVER ONLY
// Handles lifetime payment creation and webhook verification.
// Uses @dodopayments/nextjs and the standard webhooks spec.
// ============================================================

import DodoPayments from "dodopayments";
import { Webhook } from "standardwebhooks";

// Initialize the Dodo client (server-side only)
export const dodoClient = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
  // Use test mode in dev, live in production
  environment:
    process.env.NODE_ENV === "production" ? "live_mode" : "test_mode",
});

// Webhook verifier using Standard Webhooks spec
export const dodoWebhook = new Webhook(
  process.env.DODO_PAYMENTS_WEBHOOK_KEY!
);

/**
 * Creates a one-time payment link for the lifetime plan.
 * Returns the payment URL to redirect the user to.
 */
export async function createLifetimePaymentLink(
  customerEmail: string,
  customerName: string,
  userId: string // Stored as metadata to identify user in webhook
): Promise<string> {
  const productId = process.env.DODO_LIFETIME_PRODUCT_ID!;
  const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?payment=success`;

  const payment = await dodoClient.payments.create({
    payment_link: true,
    billing: {
      city: "",
      country: "IN", // Default — Dodo handles localization
      state: "",
      street: "",
      zipcode: "000000"  //!!!need to change just a place holder as string !!!
    },
    customer: {
      email: customerEmail,
      name: customerName,
    },
    product_cart: [{ product_id: productId, quantity: 1 }],
    return_url: returnUrl,
    // Store userId in metadata so webhook can find the user
    metadata: {
      userId,
      plan: "lifetime",
    },
  });

  if (!payment.payment_link) {
    throw new Error("Failed to create payment link");
  }

  return payment.payment_link;
}

/**
 * Type definitions for Dodo webhook payload (payment.succeeded)
 */
export interface DodoWebhookPayload {
  type: string;
  data: {
    payment_id: string;
    customer: {
      customer_id: string;
      email: string;
      name: string;
    };
    total_amount: number;
    currency: string;
    status: string;
    metadata?: {
      userId?: string;
      plan?: string;
    };
  };
}
