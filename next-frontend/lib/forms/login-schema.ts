import { z } from "zod"

import type { LoginBffRequest } from "@/lib/api/contracts"

/**
 * O `z.ZodType<LoginBffRequest>` é o elo que quebra o build quando o DTO do
 * backend muda — sem ele, o schema seria só um objeto Zod solto
 * (`auth-frontend/TD-06`).
 */
export const loginSchema: z.ZodType<LoginBffRequest> = z.object({
  email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
  password: z
    .string()
    .min(8, "A senha deve ter no mínimo 8 caracteres")
    .max(128, "A senha deve ter no máximo 128 caracteres"),
})

export type LoginSchema = z.infer<typeof loginSchema>
