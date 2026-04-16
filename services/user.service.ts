// services/user.service.ts
// ============================================================
// USER SERVICE (CLIENT-SIDE)
// Helpers for billing portal and checkout.
// ============================================================

// ─── Start checkout ───────────────────────────────────────────
// Pass the current page URL so after payment, Dodo redirects
// the user back to exactly where they were.
export async function startCheckout(
  idToken: string,
  returnUrl?: string
): Promise<string> {
  const res = await fetch("/api/payments/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      returnUrl: returnUrl ?? (typeof window !== "undefined" ? window.location.href : undefined),
    }),
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