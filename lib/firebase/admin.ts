// lib/firebase/admin.ts
// ============================================================
// FIREBASE ADMIN SDK — SERVER ONLY
// Never import this in client components.
// ============================================================

import {
  initializeApp,
  getApps,
  cert,
  getApp,
  type App,
} from "firebase-admin/app";
import { getAuth }      from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage }   from "firebase-admin/storage";

// ─── Single app instance ──────────────────────────────────────
let _adminApp: App | null = null;

function getAdminApp(): App {
  if (_adminApp) return _adminApp;

  // Reuse if already initialized (handles hot reload)
  if (getApps().length > 0) {
    _adminApp = getApp();
    return _adminApp;
  }

  const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin credentials missing. Check FIREBASE_ADMIN_* env vars."
    );
  }

  _adminApp = initializeApp({
    credential:    cert({ projectId, clientEmail, privateKey }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });

  return _adminApp;
}

// ─── Named getter exports ─────────────────────────────────────
// Used by middleware and any new code
export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

export function getAdminStorage() {
  return getStorage(getAdminApp());
}

// ─── Direct instance exports ──────────────────────────────────
// Used by existing API routes (adminDb, adminAuth, adminStorage)
// Keeping these avoids changing every file that imports them
export const adminAuth    = getAdminAuth();
export const adminDb      = getAdminDb();
export const adminStorage = getAdminStorage();