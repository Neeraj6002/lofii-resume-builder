"use client";
// hooks/useAuth.tsx
// ============================================================
// AUTH CONTEXT — Client-side Firebase auth state
//
// IMPORTANT: isPremium is read from Firestore (via /api/auth/me),
// NOT from Firebase custom claims. The webhook writes to Firestore
// only — it does not set custom claims — so reading claims would
// always return false even after a successful payment.
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
  user:              AuthUser | null;
  loading:           boolean;
  signInWithGoogle:  () => Promise<void>;
  signInWithEmail:   (email: string, password: string) => Promise<void>;
  signUpWithEmail:   (email: string, password: string, displayName: string) => Promise<void>;
  signOut:           () => Promise<void>;
  refreshUser:       () => Promise<void>;
  getIdToken:        () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchUserData(idToken: string): Promise<{ isPremium: boolean, credits: { resumeUnlocks: number }, unlockedResumes: string[] }> {
  try {
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) return { isPremium: false, credits: { resumeUnlocks: 0 }, unlockedResumes: [] };
    const data = await res.json();
    return {
      isPremium: data.isPremium ?? false,
      credits: data.credits ?? { resumeUnlocks: 0 },
      unlockedResumes: data.unlockedResumes ?? [],
    };
  } catch {
    return { isPremium: false, credits: { resumeUnlocks: 0 }, unlockedResumes: [] };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Build AuthUser — gets fresh idToken and reads profile data from Firestore
  const buildAuthUser = useCallback(async (firebaseUser: User): Promise<AuthUser> => {
    const idToken   = await firebaseUser.getIdToken();
    const userData = await fetchUserData(idToken);

    return {
      uid:         firebaseUser.uid,
      email:       firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL:    firebaseUser.photoURL,
      isPremium:   userData.isPremium,
      idToken,
      credits:     userData.credits,
      unlockedResumes: userData.unlockedResumes,
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
    const idToken = await result.user.getIdToken();
    await fetch("/api/auth/sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const authUser = await buildAuthUser(result.user);
    setUser(authUser);
  };

  const signOut = async () => {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch (e) {
      console.error("Signout error:", e);
    }
    await firebaseSignOut(auth);
    setUser(null);
  };

  // Call this after payment to re-fetch isPremium from Firestore.
  // Used on the dashboard when returning from checkout (?payment=success).
  const refreshUser = useCallback(async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    const authUser = await buildAuthUser(firebaseUser);
    setUser(authUser);
  }, [buildAuthUser]);

  const getIdToken = async (): Promise<string | null> => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return null;
    return await firebaseUser.getIdToken();
  };

  return (
    <AuthContext.Provider value={{
      user, loading,
      signInWithGoogle, signInWithEmail, signUpWithEmail,
      signOut, refreshUser, getIdToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}