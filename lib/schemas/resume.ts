// schemas/resume.ts
// ============================================================
// RESUME VALIDATION SCHEMAS
// Used in API routes to validate all resume-related input.
// ============================================================

import { z } from "zod";

export const PersonalInfoSchema = z.object({
  fullName:  z.string().min(1, "Name is required").max(100).trim(),
  email:     z.string().email("Invalid email").max(200).trim(),
  phone:     z.string().max(30).trim(),
  location:  z.string().max(100).trim(),
  linkedin:  z.string().url("Invalid URL").max(300).trim().or(z.literal("")),
  github:    z.string().url("Invalid URL").max(300).trim().or(z.literal("")),
  website:   z.string().url("Invalid URL").max(300).trim().or(z.literal("")),
  jobTitle:  z.string().max(100).trim(),
});

export const ExperienceItemSchema = z.object({
  id:          z.string().uuid(),
  company:     z.string().min(1).max(200).trim(),
  role:        z.string().min(1).max(200).trim(),
  location:    z.string().max(100).trim(),
  startDate:   z.string().max(20).trim(),
  endDate:     z.string().max(20).trim(),
  current:     z.boolean(),
  description: z.string().max(2000).trim(),
  aiGenerated: z.boolean().default(false),
});

export const EducationItemSchema = z.object({
  id:          z.string().uuid(),
  institution: z.string().min(1).max(200).trim(),
  degree:      z.string().max(200).trim(),
  field:       z.string().max(200).trim(),
  location:    z.string().max(100).trim(),
  startDate:   z.string().max(20).trim(),
  endDate:     z.string().max(20).trim(),
  current:     z.boolean(),
  description: z.string().max(1000).trim(),
  aiGenerated: z.boolean().default(false),
});

export const SkillItemSchema = z.object({
  id:       z.string().uuid(),
  name:     z.string().min(1).max(80).trim(),
  level:    z.enum(["beginner", "intermediate", "advanced", "expert"]),
  category: z.string().max(80).trim(),
});

export const ProjectItemSchema = z.object({
  id:          z.string().uuid(),
  name:        z.string().min(1).max(200).trim(),
  description: z.string().max(1500).trim(),
  tech:        z.array(z.string().max(50)).max(20),
  link:        z.string().url("Invalid URL").max(300).trim().or(z.literal("")),
  githubLink:  z.string().url("Invalid URL").max(300).trim().or(z.literal("")),
  aiGenerated: z.boolean().default(false),
});

export const CertificationItemSchema = z.object({
  id:           z.string().uuid(),
  name:         z.string().min(1).max(200).trim(),
  issuer:       z.string().max(200).trim(),
  date:         z.string().max(20).trim(),
  credentialId: z.string().max(200).trim(),
  link:         z.string().url("Invalid URL").max(300).trim().or(z.literal("")),
});

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

// Inferred types
export type CreateResumeInput = z.infer<typeof CreateResumeSchema>;
export type UpdateResumeInput = z.infer<typeof UpdateResumeSchema>;