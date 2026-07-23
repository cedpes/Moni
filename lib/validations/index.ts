import { z } from 'zod'

// Auth
export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Minimum 8 caractères'),
})

export const registerSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Minimum 8 caractères'),
  display_name: z.string().min(2, 'Minimum 2 caractères').max(50),
})

export const resetPasswordSchema = z.object({
  email: z.string().email('Email invalide'),
})

// Mois
export const createMonthSchema = z.object({
  month_key: z.string().regex(/^\d{4}-\d{2}$/, 'Format AAAA-MM'),
  income: z.number().min(0).default(0),
  courses_budget: z.number().min(0).default(0),
  courses_weekly_budget: z.number().min(0).default(0),
})

// Enveloppes
export const createEnvelopeSchema = z.object({
  month_id: z.string().uuid(),
  slug: z.string().min(1).max(50),
  name: z.string().min(1, 'Nom requis').max(50),
  budget: z.number().min(0),
  icon: z.string().default('📌'),
  color: z.string().nullable().default(null),
  due_day: z.number().min(1).max(31).nullable().default(null),
})

export const updateEnvelopeSchema = createEnvelopeSchema
  .omit({ month_id: true, slug: true })
  .partial()
  .extend({
    is_paid: z.boolean().optional(),
  })

// Transactions
export const createTransactionSchema = z.object({
  month_id: z.string().uuid(),
  envelope_slug: z.string().min(1),
  category_id: z.string().uuid().nullable().default(null),
  label: z.string().min(1, 'Libellé requis').max(100),
  amount: z.number().positive('Montant invalide'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => new Date().toISOString().slice(0, 10)),
  notes: z.string().max(500).nullable().default(null),
  is_private: z.boolean().default(false),
})

export const updateTransactionSchema = createTransactionSchema
  .omit({ month_id: true })
  .partial()

// Prédictif
export const createPlannedSchema = z.object({
  month_id: z.string().uuid(),
  label: z.string().min(1, 'Libellé requis').max(100),
  amount: z.number().positive('Montant invalide'),
  category_id: z.string().uuid().nullable().default(null),
  is_recurring: z.boolean().default(false),
})

export const updatePlannedSchema = createPlannedSchema
  .omit({ month_id: true })
  .partial()

// Catégories
export const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  icon: z.string().nullable().default(null),
  color: z.string().nullable().default(null),
})

// Objectifs
export const createGoalSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(100),
  target_amount: z.number().positive('Montant invalide'),
  current_amount: z.number().min(0).default(0),
  target_date: z.string().nullable().default(null),
  icon: z.string().default('🎯'),
})

// Types inférés
export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>
export type CreatePlannedInput = z.infer<typeof createPlannedSchema>
export type CreateEnvelopeInput = z.infer<typeof createEnvelopeSchema>
export type CreateGoalInput = z.infer<typeof createGoalSchema>
