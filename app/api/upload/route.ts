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

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// Custom error class for API errors
class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string
  ) {
    super(message);
    this.name = "APIError";
  }
}

export async function POST(request: Request) {
  try {
    // ── 1. Verify auth ──────────────────────────────────────
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      throw new APIError("Missing authorization header", 401, "MISSING_AUTH");
    }

    const decoded = await verifyAuthToken(authHeader);
    const uid = decoded.uid;

    if (!uid) {
      throw new APIError("Invalid authentication token", 401, "INVALID_TOKEN");
    }

    // ── 2. Parse multipart form data ───────────────────────
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      throw new APIError("No file provided", 400, "MISSING_FILE");
    }

    // ── 3. Validate file type ──────────────────────────────
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new APIError(
        "Only PDF and DOCX files are allowed",
        400,
        "INVALID_FILE_TYPE"
      );
    }

    // ── 4. Validate file size ──────────────────────────────
    if (file.size === 0) {
      throw new APIError("File is empty", 400, "EMPTY_FILE");
    }

    if (file.size > MAX_SIZE_BYTES) {
      throw new APIError(
        `File must be under 5MB (received ${(file.size / 1024 / 1024).toFixed(2)}MB)`,
        400,
        "FILE_TOO_LARGE"
      );
    }

    // ── 5. Determine file extension ────────────────────────
    const ext = file.type === "application/pdf" ? "pdf" : "docx";
    const timestamp = Date.now();
    const sanitizedFileName = file.name
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .slice(0, 200);
    const path = `resumes/${uid}/${timestamp}_${sanitizedFileName}.${ext}`;

    // ── 6. Upload to Firebase Storage ──────────────────────
    const adminStorage = getAdminStorage();
    if (!adminStorage) {
      throw new APIError(
        "Storage service unavailable",
        503,
        "STORAGE_UNAVAILABLE"
      );
    }

    const bucket = adminStorage.bucket();
    const fileRef = bucket.file(path);

    // Convert File to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload with metadata
    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type,
        metadata: {
          uploadedBy: uid,
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
        },
        cacheControl: "public, max-age=3600",
      },
    });

    // ── 7. Get signed download URL (1 hour expiry) ─────────
    const [url] = await fileRef.getSignedUrl({
      action: "read",
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    // ── 8. Return success response ──────────────────────────
    return NextResponse.json(
      {
        success: true,
        message: "File uploaded successfully",
        url,
        path,
        fileName: file.name,
        fileSize: file.size,
      },
      { status: 201 }
    );
  } catch (err) {
    // Handle custom API errors
    if (err instanceof APIError) {
      console.error(`[API Upload Error] ${err.code}: ${err.message}`);
      return NextResponse.json(
        {
          success: false,
          error: err.message,
          code: err.code,
        },
        { status: err.status }
      );
    }

    // Handle auth errors
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized access",
          code: "UNAUTHORIZED",
        },
        { status: 401 }
      );
    }

    // Handle generic errors
    const error = err instanceof Error ? err : new Error("Unknown error");
    console.error("[API Upload Error] Unhandled exception:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Upload failed. Please try again.",
        code: "UPLOAD_FAILED",
      },
      { status: 500 }
    );
  }
}

// Optional: GET handler for testing or health check
export async function GET() {
  return NextResponse.json(
    {
      message: "Upload API is operational",
      acceptedFormats: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      maxSizeBytes: MAX_SIZE_BYTES,
    },
    { status: 200 }
  );
}