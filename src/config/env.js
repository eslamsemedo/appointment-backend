import 'dotenv/config';
import { z } from 'zod';

// Validate all required environment variables at startup.
// If any required var is missing/invalid, throw immediately — do not start the server.
const envSchema = z.object({
  MONGO_URL: z.string().min(1, 'MONGO_URL is required'),
  MONGO_DB_NAME: z.string().min(1, 'MONGO_DB_NAME is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  PORT: z.string().default('3001'),
  // Outbound email is sent through Resend's HTTPS API (Railway blocks outbound
  // SMTP, which caused confirmation/cancellation emails to time out). All
  // tenants send through this single Resend account; the tenant's own address
  // is used as the Reply-To. See services/emailService.js.
  RESEND_API_KEY: z.string().optional(),
  // The verified sending address Resend mails come "from" (must belong to a
  // domain verified in your Resend account), e.g. "appointments@yourdomain.com".
  EMAIL_FROM: z.string().optional(),
  // Legacy SMTP vars — no longer used for sending, kept to avoid breaking
  // existing deployments that still set them.
  GMAIL_USER: z.string().optional(),
  GMAIL_APP_PASSWORD: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  throw new Error('Invalid environment variables — see logs above.');
}

const env = parsed.data;

export default env;
