import { z } from "zod"

import type { LoginBffRequest } from "@/lib/api/contracts"
import type { FormSchema } from "@/lib/forms/form-schema"

export const loginSchema: FormSchema<LoginBffRequest> = z.object({
  email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
  password: z
    .string()
    .min(8, "A senha deve ter no mínimo 8 caracteres")
    .max(128, "A senha deve ter no máximo 128 caracteres"),
})

export type LoginSchema = z.infer<typeof loginSchema>
