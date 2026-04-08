// app/api/upload/route.ts
// ============================================================
// FILE UPLOAD API
// Uploads resume files (PDF/DOCX) to Firebase Storage and
// saves metadata to Firestore `uploadedResumes` collection
// so the dashboard can show uploaded resumes as cards.
// ============================================================

import { NextResponse }       from "next/server";
import { verifyAuthToken }    from "@/lib/firebase/auth";
import { getAdminStorage, getAdminDb } from "@/lib/firebase/admin";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES  = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export async function POST(request: Request) {
  try {
    // ── 1. Verify auth ──────────────────────────────────────
    const authHeader = request.headers.get("Authorization");
    const decoded    = await verifyAuthToken(authHeader);
    const uid        = decoded.uid;

    // ── 2. Parse multipart form data ───────────────────────
    const formData = await request.formData();
    const file     = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // ── 3. Validate file ────────────────────────────────────
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only PDF and DOCX files are allowed" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File must be under 5MB" },
        { status: 400 }
      );
    }

    // ── 4. Upload to Firebase Storage ──────────────────────
    const fileType  = file.type === "application/pdf" ? "pdf" : "docx";
    const timestamp = Date.now();
    const path      = `resumes/${uid}/${timestamp}.${fileType}`;

    const adminStorage = getAdminStorage();
    const bucket       = adminStorage.bucket();
    const fileRef      = bucket.file(path);

    const arrayBuffer = await file.arrayBuffer();
    const buffer      = Buffer.from(arrayBuffer);

    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type,
        metadata: {
          uploadedBy:   uid,
          originalName: file.name,
        },
      },
    });

    // ── 5. Save metadata to Firestore ──────────────────────
    // This allows the dashboard to list uploaded resumes.
    const adminDb  = getAdminDb();
    const docRef   = adminDb.collection("uploadedResumes").doc();
    const docId    = docRef.id;

    await docRef.set({
      id:              docId,
      userId:          uid,
      fileName:        file.name,
      storagePath:     path,
      fileType,
      uploadedAt:      new Date(),
      lastReviewScore: null,
    });

    return NextResponse.json({ uploadedResumeId: docId, path }, { status: 201 });

  } catch (err) {
    const error = err as Error;
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[POST /api/upload]", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}