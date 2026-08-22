import { z } from "zod"

import type { RegisterBffRequest } from "@/lib/api/contracts"
import type { FormSchema } from "@/lib/forms/form-schema"

/**
 * `confirmPassword` é regra só do cliente — não existe campo correspondente
 * no DTO do backend (`auth-frontend/TD-06`, Excludes). A autoridade sobre a
 * regra de senha permanece no backend, que revalida sempre.
 */
type SignupFields = RegisterBffRequest & { confirmPassword: string }

export const signupSchema: FormSchema<SignupFields> = z
  .object({
    email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
    name: z
      .string()
      .min(1, "Nome é obrigatório")
      .max(255, "O nome deve ter no máximo 255 caracteres"),
    password: z
      .string()
      .min(8, "A senha deve ter no mínimo 8 caracteres")
      .max(128, "A senha deve ter no máximo 128 caracteres"),
    confirmPassword: z.string().min(1, "Confirme a senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  })

export type SignupSchema = z.infer<typeof signupSchema>
