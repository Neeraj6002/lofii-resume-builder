"use client";
// hooks/useAuth.tsx
// ============================================================
// AUTH CONTEXT — Client-side Firebase auth state
// Uses Firebase ID token custom claims for isPremium.
// No session cookie or sync API needed.
// isPremium is set via custom claims by the webhook (server).
// ============================================================

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase/client";
import type { AuthUser } from "@/types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Build AuthUser from Firebase User using custom claims
  // isPremium is set as a custom claim by the webhook via Admin SDK
  const buildAuthUser = useCallback(async (firebaseUser: User): Promise<AuthUser> => {
    // Force-refresh to always get latest custom claims
    const idTokenResult = await firebaseUser.getIdTokenResult(true);
    const isPremium = (idTokenResult.claims["isPremium"] as boolean) ?? false;

    return {
      uid:         firebaseUser.uid,
      email:       firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL:    firebaseUser.photoURL,
      isPremium,
      idToken:     idTokenResult.token,
    };
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const authUser = await buildAuthUser(firebaseUser);
          setUser(authUser);
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [buildAuthUser]);

  const signInWithGoogle = async () => {
    const result  = await signInWithPopup(auth, googleProvider);
    const authUser = await buildAuthUser(result.user);
    setUser(authUser);
  };

  const signInWithEmail = async (email: string, password: string) => {
    const result  = await signInWithEmailAndPassword(auth, email, password);
    const authUser = await buildAuthUser(result.user);
    setUser(authUser);
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    displayName: string
  ) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName });
    // Also create user doc in Firestore via sync API
    const idToken = await result.user.getIdToken();
    await fetch("/api/auth/sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const authUser = await buildAuthUser(result.user);
    setUser(authUser);
  };

  const signOut = async () => {
    // Clear server-side session cookie
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch (e) {
      // Ignore errors - still proceed with client signout
      console.error("Signout error:", e);
    }
    await firebaseSignOut(auth);
    setUser(null);
  };

  // Call this after payment to refresh isPremium from new claims
  const refreshUser = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    const authUser = await buildAuthUser(firebaseUser);
    setUser(authUser);
  };

  // Get a fresh ID token for API calls (auto-refreshes if expired)
  const getIdToken = async (): Promise<string | null> => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return null;
    return await firebaseUser.getIdToken();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        refreshUser,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}