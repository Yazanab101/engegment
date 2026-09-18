import { z } from 'zod'
import 'dotenv/config'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  COOKIE_NAME: z.string().default('engegment_admin_session'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  PUBLIC_APP_URL: z.string().url().default('http://localhost:5173'),
  ADMIN_BOOTSTRAP_EMAIL: z.string().email().optional(),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(8).optional(),
  OPEN_DEDUP_MINUTES: z.coerce.number().default(10),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment configuration', parsed.error.flatten().fieldErrors)
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1)
  }
}

export const env = parsed.success
  ? parsed.data
  : ({
      NODE_ENV: 'test' as const,
      PORT: 4000,
      DATABASE_URL: 'postgresql://engegment:engegment@localhost:5432/engegment',
      JWT_SECRET: 'test-secret-must-be-at-least-32-chars!!',
      COOKIE_NAME: 'engegment_admin_session',
      CORS_ORIGIN: 'http://localhost:5173',
      PUBLIC_APP_URL: 'http://localhost:5173',
      OPEN_DEDUP_MINUTES: 10,
    })
