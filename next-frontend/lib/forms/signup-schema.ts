import { z } from "zod"

import type { RegisterBffRequest } from "@/lib/api/contracts"

/**
 * **Nota de contrato:** o UI Contract de `/signup` (Figma) e a documentação da
 * fase citam um campo `name`, mas o `RegisterDto` real do `nestjs-project`
 * (slice `auth`, já entregue e fora de escopo aqui) só tem `email` e
 * `password`. Seguimos o backend real — `name` não é enviado à API.
 */

/**
 * `confirmPassword` é regra só do cliente — não existe campo correspondente
 * no DTO do backend (`auth-frontend/TD-06`, Excludes). A autoridade sobre a
 * regra de senha permanece no backend, que revalida sempre.
 */
export const signupSchema: z.ZodType<RegisterBffRequest & { confirmPassword: string }> = z
  .object({
    email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
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
