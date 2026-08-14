import { createEnv } from "@t3-oss/env-nextjs"
import * as z from "zod"

const env = createEnv({
  server: {
    API_BASE_URL: z.url(),
  },
  client: {},
  shared: {
    NODE_ENV: z.enum(["development", "production", "test"]),
  },
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
  },
  emptyStringAsUndefined: true,
})

// Reagrupado por domínio sobre o schema plano — consumidores falam
// `config.api.baseUrl`, nunca `env.API_BASE_URL` (next-frontend-env-config/TD-03).
export const config = {
  api: {
    baseUrl: env.API_BASE_URL,
  },
} as const
