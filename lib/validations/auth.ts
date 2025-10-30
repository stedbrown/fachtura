import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(6, 'La password deve essere di almeno 6 caratteri'),
})

export const registerSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(6, 'La password deve essere di almeno 6 caratteri'),
  confirmPassword: z.string(),
  companyName: z.string().min(2, 'Nome azienda richiesto'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Le password non corrispondono',
  path: ['confirmPassword'],
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>

