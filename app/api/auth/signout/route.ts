// app/api/auth/signout/route.ts
// ============================================================
// SIGNOUT — Clears the session cookie
// Called when user signs out
// ============================================================

import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });

  // Clear the session cookie
  response.cookies.set("__session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
