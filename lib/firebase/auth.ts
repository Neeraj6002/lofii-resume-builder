// lib/firebase/auth.ts

import { getAdminAuth, getAdminDb } from "./admin";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { UserProfile } from "@/types";

export async function verifyAuthToken(
  authHeader: string | null
): Promise<DecodedIdToken> {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("UNAUTHORIZED");
  }

  const token = authHeader.slice(7);

  try {
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token, true);
    return decoded;
  } catch (err) {
    throw new Error("UNAUTHORIZED");
  }
}

/**
 * Gets the full user profile from Firestore.
 * Defensively backfills credits for users created before the credits system.
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const adminDb = getAdminDb();
  const snap = await adminDb.collection("users").doc(uid).get();
  if (!snap.exists) return null;

  const data = snap.data()!;

  // ── Backfill credits for pre-credits users ────────────────
  // Users created before this field existed won't have it in Firestore.
  // We normalise here so every caller can safely read credits.review / credits.builder
  // without optional chaining throughout the codebase.
  // Note: this does NOT write back to Firestore — it's an in-memory default only.
  // Credits are only granted via the payment webhook, never auto-assigned.
  if (!data.credits) {
    data.credits = { review: 0, builder: 0 };
  } else {
    data.credits.review  = data.credits.review  ?? 0;
    data.credits.builder = data.credits.builder ?? 0;
  }

  return data as UserProfile;
}

export async function requirePremium(uid: string): Promise<void> {
  const profile = await getUserProfile(uid);
  if (!profile?.isPremium) {
    throw new Error("FORBIDDEN_PREMIUM_REQUIRED");
  }
}

/**
 * Creates a new user document in Firestore on first login.
 * Idempotent — safe to call on every login.
 */
export async function ensureUserProfile(
  uid: string,
  email: string,
  displayName: string,
  photoURL: string | null
): Promise<void> {
  const adminDb = getAdminDb();
  const ref = adminDb.collection("users").doc(uid);
  const snap = await ref.get();

  if (!snap.exists) {
    const now = new Date();

    // Let TS infer the shape — no manual Omit cast needed here
    const profile = {
      uid,
      email,
      displayName,
      photoURL,
      createdAt:  now,
      isPremium:  false,
      credits: {
        review:  0,
        builder: 0,
      },
      subscription: {
        status:             "inactive" as const,
        plan:               null,
        dodoCustomerId:     null,
        dodoPaymentId:      null,
        purchasedAt:        null,
        transactionHistory: [],
      },
      resumeIds: [],
    };

    await ref.set(profile);
  }
}