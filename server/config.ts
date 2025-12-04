import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  LINKEDIN_CLIENT_ID: z.string().min(1, 'LINKEDIN_CLIENT_ID is required'),
  LINKEDIN_CLIENT_SECRET: z.string().min(1, 'LINKEDIN_CLIENT_SECRET is required'),
  AI_INTEGRATIONS_OPENAI_API_KEY: z.string().optional(),
  AI_INTEGRATIONS_OPENAI_BASE_URL: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development'),
  PORT: z.string().optional(),
  REPLIT_DEV_DOMAIN: z.string().optional(),
  REPLIT_DOMAINS: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    const errors = result.error.issues.map(e => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
    console.error('Environment validation failed:\n' + errors);
    console.error('\nPlease ensure all required environment variables are set.');
    process.exit(1);
  }
  
  return result.data;
}

export const config = validateEnv();
