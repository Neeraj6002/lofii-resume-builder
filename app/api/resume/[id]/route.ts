// app/api/resume/[id]/route.ts
// ============================================================
// RESUME BY ID — Get, Update, Delete
// All operations verify ownership: userId must match token uid.
// ============================================================

import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/firebase/auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { UpdateResumeSchema } from "@/lib/schemas";

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function getResumeAndVerifyOwner(resumeId: string, uid: string) {
  const adminDb = getAdminDb();
  const doc = await adminDb.collection("resumes").doc(resumeId).get();

  if (!doc.exists) {
    throw Object.assign(new Error("NOT_FOUND"), { status: 404 });
  }

  const data = doc.data()!;

  // Critical: verify ownership — users can only access their own resumes
  if (data.userId !== uid) {
    throw Object.assign(new Error("FORBIDDEN"), { status: 403 });
  }

  return data;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get("Authorization");
    const decoded = await verifyAuthToken(authHeader);

    const data = await getResumeAndVerifyOwner(id, decoded.uid);
    return NextResponse.json({ resume: data });
  } catch (err) {
    const error = err as Error & { status?: number };
    if (error.message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message === "NOT_FOUND")
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (error.message === "FORBIDDEN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[GET /api/resume/[id]]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get("Authorization");
    const decoded = await verifyAuthToken(authHeader);

    // Verify ownership before proceeding
    await getResumeAndVerifyOwner(id, decoded.uid);

    const body = await request.json();
    const parsed = UpdateResumeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();
    await adminDb
      .collection("resumes")
      .doc(id)
      .update({ ...parsed.data, updatedAt: new Date() });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const error = err as Error;
    if (error.message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message === "NOT_FOUND")
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (error.message === "FORBIDDEN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[PATCH /api/resume/[id]]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get("Authorization");
    const decoded = await verifyAuthToken(authHeader);

    await getResumeAndVerifyOwner(id, decoded.uid);

    // Delete resume doc and remove from user's array (atomically)
    const adminDb = getAdminDb();
    const batch = adminDb.batch();
    batch.delete(adminDb.collection("resumes").doc(id));
    batch.update(adminDb.collection("users").doc(decoded.uid), {
      resumeIds: (
        await import("firebase-admin/firestore")
      ).FieldValue.arrayRemove(id),
    });
    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (err) {
    const error = err as Error;
    if (error.message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message === "NOT_FOUND")
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (error.message === "FORBIDDEN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[DELETE /api/resume/[id]]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}