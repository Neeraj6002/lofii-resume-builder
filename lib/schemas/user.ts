// schemas/user.ts
// ============================================================
// USER VALIDATION SCHEMAS
// Used in auth routes and payment webhook handling.
// ============================================================

import { z } from "zod";

export const RegisterSchema = z.object({
  displayName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100)
    .trim(),
  email: z
    .string()
    .email("Invalid email address")
    .max(200)
    .trim()
    .toLowerCase(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(128),
});

export const LoginSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .max(200)
    .trim()
    .toLowerCase(),
  password: z.string().min(1, "Password is required").max(128),
});

export const UpdateProfileSchema = z.object({
  displayName: z.string().min(2).max(100).trim().optional(),
  photoURL:    z.string().url().max(500).optional(),
});

export const CheckoutSchema = z.object({
  productId: z.string().min(1).max(100),
});

// Dodo webhook payload validation
export const DodoWebhookDataSchema = z.object({
  payment_id: z.string(),
  customer: z.object({
    customer_id: z.string(),
    email:       z.string().email(),
    name:        z.string(),
  }),
  total_amount: z.number(),
  currency:     z.string(),
  status:       z.string(),
  metadata: z
    .object({
      userId: z.string().optional(),
      plan:   z.string().optional(),
    })
    .optional(),
});

export const DodoWebhookSchema = z.object({
  type: z.string(),
  data: DodoWebhookDataSchema,
});

// Inferred types
export type RegisterInput  = z.infer<typeof RegisterSchema>;
export type LoginInput     = z.infer<typeof LoginSchema>;
export type CheckoutInput  = z.infer<typeof CheckoutSchema>;