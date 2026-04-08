// types/index.ts
// ============================================================
// CORE TYPES — AI Resume Builder
// Single source of truth for all TypeScript interfaces.
// Every file in the project imports types from here.
// ============================================================

import { Timestamp } from "firebase/firestore";

// ─── Auth ─────────────────────────────────────────────────────

export interface AuthUser {
  uid:         string;
  email:       string | null;
  displayName: string | null;
  photoURL:    string | null;
  isPremium:   boolean;
  idToken:     string;
}

// ─── User / Subscription ──────────────────────────────────────

export type PlanType = "lifetime";
export type SubscriptionStatus = "active" | "inactive";

export interface DodoTransaction {
  transactionId: string;
  paymentId:     string;
  amount:        number;
  currency:      string;
  status:        string;
  date:          Timestamp;
}

export interface UserSubscription {
  status:             SubscriptionStatus;
  plan:               PlanType | null;
  dodoCustomerId:     string | null;
  dodoPaymentId:      string | null;
  purchasedAt:        Timestamp | null;
  transactionHistory: DodoTransaction[];
}

export interface UserCredits {
  review:  number;
  builder: number;
}

export interface UserProfile {
  uid:          string;
  email:        string;
  displayName:  string;
  photoURL:     string | null;
  createdAt:    Timestamp;
  isPremium:    boolean;
  credits:      UserCredits;
  subscription: UserSubscription;
  resumeIds:    string[];
}

// ─── Resume ───────────────────────────────────────────────────

export type ResumeTemplate =
  | "classic"
  | "modern"
  | "minimal"
  | "executive"
  | "creative"
  | "tech";

export interface PersonalInfo {
  fullName: string;
  email:    string;
  phone:    string;
  location: string;
  linkedin: string;
  github:   string;
  website:  string;
  jobTitle: string;
}

export interface ExperienceItem {
  id:          string;
  company:     string;
  role:        string;
  location:    string;
  startDate:   string;
  endDate:     string;
  current:     boolean;
  description: string;
  aiGenerated: boolean;
}

export interface EducationItem {
  id:          string;
  institution: string;
  degree:      string;
  field:       string;
  location:    string;
  startDate:   string;
  endDate:     string;
  current:     boolean;
  description: string;
  aiGenerated: boolean;
}

export interface SkillItem {
  id:       string;
  name:     string;
  level:    "beginner" | "intermediate" | "advanced" | "expert";
  category: string;
}

export interface ProjectItem {
  id:          string;
  name:        string;
  description: string;
  tech:        string[];
  link:        string;
  githubLink:  string;
  aiGenerated: boolean;
}

export interface CertificationItem {
  id:           string;
  name:         string;
  issuer:       string;
  date:         string;
  credentialId: string;
  link:         string;
}

export interface ResumeData {
  id:                 string;
  userId:             string;
  title:              string;
  template:           ResumeTemplate;
  personalInfo:       PersonalInfo;
  summary:            string;
  summaryAiGenerated: boolean;
  experience:         ExperienceItem[];
  education:          EducationItem[];
  skills:             SkillItem[];
  projects:           ProjectItem[];
  certifications:     CertificationItem[];
  createdAt:          Timestamp;
  updatedAt:          Timestamp;
  lastReviewScore:    number | null;
}

// ─── Uploaded Resume ──────────────────────────────────────────
// Represents a resume uploaded for review (PDF/DOCX),
// stored in Firestore collection `uploadedResumes/{id}`

export interface UploadedResume {
  id:              string;        // Firestore doc ID
  userId:          string;        // owner UID
  fileName:        string;        // original file name
  storagePath:     string;        // Firebase Storage path
  fileType:        "pdf" | "docx";
  uploadedAt:      Timestamp;
  lastReviewScore: number | null;
}

// ─── AI ───────────────────────────────────────────────────────

export type AIContentType =
  | "summary"
  | "experience"
  | "education"
  | "project";

export interface AIGenerateRequest {
  type:    AIContentType;
  context: Record<string, string>;
}

export interface AIGenerateResponse {
  content: string;
  tokens:  number;
}

// ─── Review ───────────────────────────────────────────────────

export type ReviewCategory =
  | "ats_compatibility"
  | "keywords"
  | "quantified_impact"
  | "summary"
  | "formatting"
  | "length"
  | "action_verbs"
  | "skills";

export type IssueSeverity = "critical" | "warning" | "suggestion";

export interface ReviewIssue {
  severity: IssueSeverity;
  message:  string;
  fix:      string;
}

export interface ReviewSection {
  category:  ReviewCategory;
  label:     string;
  score:     number;       // 0–100
  issues:    ReviewIssue[];
  isPremium: boolean;      // true = blur for free users
}

export interface ResumeReview {
  overallScore: number;
  sections:     ReviewSection[];
  topFixes:     ReviewIssue[];
  createdAt:    Timestamp;
}

// ─── API ──────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data?:  T;
  error?: string;
  code?:  number;
}