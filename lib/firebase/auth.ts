// ============================================================
// SERVER AUTH UTILITIES
// Verifies Firebase ID tokens in API routes.
// Never trusts client-provided user data directly.
// ============================================================

import { getAdminAuth, getAdminDb } from "./admin";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { UserProfile } from "@/types";

/**
 * Verifies the Authorization Bearer token from request headers.
 * Returns decoded token or throws — never returns null silently.
 */
export async function verifyAuthToken(
  authHeader: string | null
): Promise<DecodedIdToken> {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("UNAUTHORIZED");
  }

  const token = authHeader.slice(7);

  try {
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token, true); // checkRevoked=true
    return decoded;
  } catch (err) {
    // Map Firebase error codes to safe messages
    throw new Error("UNAUTHORIZED");
  }
}

/**
 * Gets the full user profile from Firestore.
 * Used to check premium status server-side.
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const adminDb = getAdminDb();
  const snap = await adminDb.collection("users").doc(uid).get();
  if (!snap.exists) return null;
  return snap.data() as UserProfile;
}

/**
 * Checks if a user has an active premium subscription.
 * Called in AI and review API routes.
 */
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
    const profile: Omit<UserProfile, "createdAt" | "updatedAt"> & {
      createdAt: Date;
    } = {
      uid,
      email,
      displayName,
      photoURL,
      createdAt: now,
      isPremium: false,
      subscription: {
        status: "inactive",
        plan: null,
        dodoCustomerId: null,
        dodoPaymentId: null,
        purchasedAt: null,
        transactionHistory: [],
      },
      resumeIds: [],
    };
    await ref.set(profile);
  }
}