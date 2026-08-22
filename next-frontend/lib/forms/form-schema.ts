import type { z } from "zod"

/**
 * Forma canônica de anotar um schema de formulário desta pasta.
 *
 * O elo com o tipo derivado do contrato (`LoginBffRequest`, `RegisterBffRequest`,
 * …) é o que quebra o build quando o DTO do backend muda — sem ele o schema
 * seria só um objeto Zod solto (`auth-frontend/TD-06`).
 *
 * O parâmetro de **entrada** vai junto com o de saída de propósito. Com
 * `z.ZodType<Out>` sozinho o input fica `unknown`, e o `zodResolver` do
 * `@hookform/resolvers` deixa de inferir os campos: o `useForm` degrada
 * silenciosamente para `FieldValues` e o `handleSubmit` para de tipar o
 * payload. Não há erro de compilação nesse caminho — só a perda da tipagem —,
 * então o alias existe para que nenhum schema novo redescubra isso.
 */
export type FormSchema<T> = z.ZodType<T, T>
