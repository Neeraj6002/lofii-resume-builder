// services/user.service.ts
// ============================================================
// USER SERVICE (CLIENT-SIDE)
// Helpers for billing portal and checkout.
// ============================================================

// ─── Start checkout ───────────────────────────────────────────
export async function startCheckout(idToken: string): Promise<string> {
  const res = await fetch("/api/payments/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? "Checkout failed");
  }

  if (!data.url) throw new Error("No checkout URL returned");
  return data.url as string;
}

// ─── Get billing info ─────────────────────────────────────────
export async function getBillingInfo(idToken: string): Promise<{
  isPremium: boolean;
  // Credits remaining after purchase
  // Each starts at 1 on payment; consumed by review / builder routes
  credits: {
    review:  number;
    builder: number;
  };
  subscription: {
    status: string;
    plan: string | null;
    purchasedAt: unknown;
    transactionHistory: Array<{
      transactionId: string;
      amount: number;
      currency: string;
      status: string;
      date: unknown;
    }>;
  };
}> {
  const res = await fetch("/api/payments/portal", {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!res.ok) throw new Error("Failed to fetch billing info");
  return res.json();
}