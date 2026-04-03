// app/api/upload/route.ts
// ============================================================
// FILE UPLOAD API
// Uploads resume files (PDF/DOCX) to Firebase Storage.
// Files are stored under /resumes/{userId}/{filename}
// Only the owner can access their uploaded files.
// ============================================================

import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/firebase/auth";
import { getAdminStorage } from "@/lib/firebase/admin";

const MAX_SIZE_BYTES  = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES   = [
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
    const ext       = file.type === "application/pdf" ? "pdf" : "docx";
    const timestamp = Date.now();
    const path      = `resumes/${uid}/${timestamp}.${ext}`;

    const adminStorage = getAdminStorage();
    const bucket    = adminStorage.bucket();
    const fileRef   = bucket.file(path);

    const arrayBuffer = await file.arrayBuffer();
    const buffer      = Buffer.from(arrayBuffer);

    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type,
        metadata: {
          uploadedBy: uid,          // Track owner
          originalName: file.name,
        },
      },
    });

    // ── 5. Get signed download URL (1 hour expiry) ─────────
    const [url] = await fileRef.getSignedUrl({
      action:  "read",
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    return NextResponse.json({ url, path }, { status: 201 });
  } catch (err) {
    const error = err as Error;
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[POST /api/upload]", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}