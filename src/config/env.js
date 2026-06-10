import 'dotenv/config';
import { z } from 'zod';

// Validate all required environment variables at startup.
// If any required var is missing/invalid, throw immediately — do not start the server.
const envSchema = z.object({
  MONGO_URL: z.string().min(1, 'MONGO_URL is required'),
  MONGO_DB_NAME: z.string().min(1, 'MONGO_DB_NAME is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  PORT: z.string().default('3001'),
  GMAIL_USER: z.string().min(1, 'GMAIL_USER is required'),
  GMAIL_APP_PASSWORD: z.string().min(1, 'GMAIL_APP_PASSWORD is required'),
  EMAIL_FROM: z.string().min(1, 'EMAIL_FROM is required'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  throw new Error('Invalid environment variables — see logs above.');
}

const env = parsed.data;

export default env;
