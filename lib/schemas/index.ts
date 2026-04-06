  // schemas/index.ts
  // ============================================================
  // ZOD SCHEMAS
  // Validation is intentionally relaxed on optional fields
  // so users can save partial resumes while still building them.
  // Hard limits (max lengths) are still enforced for security.
  // ============================================================

  import { UserSubscription } from "@/types";
import { Timestamp } from "next/dist/server/lib/cache-handlers/types";
import { z } from "zod";

  // ─── URL helper ───────────────────────────────────────────────
  // Accepts a valid URL or an empty string — never rejects blank fields
  const optionalUrl = z
    .string()
    .max(300)
    .trim()
    .refine(
      (val) => val === "" || /^https?:\/\/.+/.test(val),
      { message: "Must be a valid URL or empty" }
    );

  // ─── Personal Info ────────────────────────────────────────────
  export const PersonalInfoSchema = z.object({
    fullName: z.string().min(1, "Name is required").max(100).trim(),
    // Email: valid format OR empty (user might not have filled it yet)
    email:    z.string().max(200).trim().refine(
      (val) => val === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      { message: "Must be a valid email or empty" }
    ),
    phone:    z.string().max(30).trim(),
    location: z.string().max(100).trim(),
    linkedin: optionalUrl,
    github:   optionalUrl,
    website:  optionalUrl,
    jobTitle: z.string().max(100).trim(),
  });

  // ─── Experience ───────────────────────────────────────────────
  export const ExperienceItemSchema = z.object({
    id:          z.string().uuid(),
    // company and role are optional — user saves as they go
    company:     z.string().max(200).trim(),
    role:        z.string().max(200).trim(),
    location:    z.string().max(100).trim(),
    startDate:   z.string().max(20).trim(),
    endDate:     z.string().max(20).trim(),
    current:     z.boolean(),
    description: z.string().max(2000).trim(),
    aiGenerated: z.boolean().default(false),
  });

  // ─── Education ────────────────────────────────────────────────
  export const EducationItemSchema = z.object({
    id:          z.string().uuid(),
    institution: z.string().max(200).trim(),
    degree:      z.string().max(200).trim(),
    field:       z.string().max(200).trim(),
    location:    z.string().max(100).trim(),
    startDate:   z.string().max(20).trim(),
    endDate:     z.string().max(20).trim(),
    current:     z.boolean(),
    description: z.string().max(1000).trim(),
    aiGenerated: z.boolean().default(false),
  });

  // ─── Skill ────────────────────────────────────────────────────
  export const SkillItemSchema = z.object({
    id:       z.string().uuid(),
    name:     z.string().max(80).trim(),
    level:    z.enum(["beginner", "intermediate", "advanced", "expert"]),
    category: z.string().max(80).trim(),
  });

  // ─── Project ──────────────────────────────────────────────────
  export const ProjectItemSchema = z.object({
    id:          z.string().uuid(),
    name:        z.string().max(200).trim(),
    description: z.string().max(1500).trim(),
    tech:        z.array(z.string().max(50)).max(20),
    link:        optionalUrl,
    githubLink:  optionalUrl,
    aiGenerated: z.boolean().default(false),
  });

  // ─── Certification ────────────────────────────────────────────
  export const CertificationItemSchema = z.object({
    id:           z.string().uuid(),
    name:         z.string().max(200).trim(),
    issuer:       z.string().max(200).trim(),
    date:         z.string().max(20).trim(),
    credentialId: z.string().max(200).trim(),
    link:         optionalUrl,
  });

  // ─── Create / Update Resume ───────────────────────────────────
  export const CreateResumeSchema = z.object({
    title:              z.string().min(1).max(100).trim(),
    template:           z.enum(["classic", "modern", "minimal", "executive", "creative", "tech"]),
    personalInfo:       PersonalInfoSchema,
    summary:            z.string().max(1000).trim(),
    summaryAiGenerated: z.boolean().default(false),
    experience:         z.array(ExperienceItemSchema).max(20),
    education:          z.array(EducationItemSchema).max(10),
    skills:             z.array(SkillItemSchema).max(50),
    projects:           z.array(ProjectItemSchema).max(20),
    certifications:     z.array(CertificationItemSchema).max(20),
  });

  export const UpdateResumeSchema = CreateResumeSchema.partial();

  // ─── AI ───────────────────────────────────────────────────────
  // Context object — values max 500 chars. Key count validated manually.
  export const AIContextBaseSchema = z.record(z.string(), z.string().max(500));

  // ✅ FIXED: Added "skills" to match all section types supported by the API
  export const AIGenerateSchema = z.object({
    type:    z.enum(["summary", "experience", "education", "project", "skills"]),
    context: AIContextBaseSchema,
  });

  // ─── Payments ─────────────────────────────────────────────────
  export const CheckoutSchema = z.object({
    productId: z.string().min(1).max(100),
  });

  // ─── Review ───────────────────────────────────────────────────
  export const ReviewRequestSchema = z.object({
    resumeText: z.string().min(50).max(15000),
  });
// Add after the UserSubscription interface, before UserProfile

export interface UserCredits {
  review:  number;   // consumed by /api/ai/review-resume
  builder: number;   // consumed by /api/ai/generate-content
}

export interface UserProfile {
  uid:          string;
  email:        string;
  displayName:  string;
  photoURL:     string | null;
  createdAt:    Timestamp;
  isPremium:    boolean;
  credits:      UserCredits;        // ← add this
  subscription: UserSubscription;
  resumeIds:    string[];
}