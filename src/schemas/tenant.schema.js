import { z } from 'zod';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/; // "HH:MM" 24-hour
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/; // "YYYY-MM-DD"
const DAY_ENUM = z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

// PUT /tenants/me — all fields optional.
export const updateTenantSchema = z.object({
  name: z.string().min(1, 'name cannot be empty').max(120).optional(),
  workingDays: z.array(DAY_ENUM).optional(),
  workingHours: z
    .object({
      start: z.string().regex(TIME_REGEX, 'start must be in HH:MM format'),
      end: z.string().regex(TIME_REGEX, 'end must be in HH:MM format'),
    })
    .optional(),
  // Per-tenant email sender. senderEmail/senderAppPassword may be sent as ''
  // to clear them; otherwise senderEmail must be a valid address.
  senderEmail: z.union([z.literal(''), z.string().email('senderEmail must be a valid email')]).optional(),
  senderName: z.string().max(120).optional(),
  senderAppPassword: z.string().max(200).optional(),
});

// POST /tenants/me/blocked-times
// startTime and endTime are both optional, but if one is present both must be.
export const blockedTimeSchema = z
  .object({
    date: z.string().regex(DATE_REGEX, 'date must be in YYYY-MM-DD format'),
    startTime: z.string().regex(TIME_REGEX, 'startTime must be in HH:MM format').optional(),
    endTime: z.string().regex(TIME_REGEX, 'endTime must be in HH:MM format').optional(),
  })
  .refine((data) => (data.startTime === undefined) === (data.endTime === undefined), {
    message: 'startTime and endTime must both be present or both omitted',
  });
