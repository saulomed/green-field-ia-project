import { z } from "zod"

import type { ForgotPasswordBffRequest } from "@/lib/api/contracts"

export const forgotPasswordSchema: z.ZodType<ForgotPasswordBffRequest> = z.object({
  email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
})

export type ForgotPasswordSchema = z.infer<typeof forgotPasswordSchema>
