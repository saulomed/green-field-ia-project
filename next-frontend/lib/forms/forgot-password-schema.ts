import { z } from "zod"

import type { ForgotPasswordBffRequest } from "@/lib/api/contracts"
import type { FormSchema } from "@/lib/forms/form-schema"

export const forgotPasswordSchema: FormSchema<ForgotPasswordBffRequest> = z.object({
  email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
})

export type ForgotPasswordSchema = z.infer<typeof forgotPasswordSchema>
