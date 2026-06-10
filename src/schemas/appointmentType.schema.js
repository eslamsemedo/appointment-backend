import { z } from 'zod';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/; // "YYYY-MM-DD"

export const createAppointmentTypeSchema = z.object({
  name: z.string().min(1, 'name is required'),
  capacity: z.number().int('capacity must be an integer').positive('capacity must be at least 1'),
  description: z.string().optional(),
});

// PUT /appointment-types/:id — all optional, but at least one is required.
export const updateAppointmentTypeSchema = z
  .object({
    name: z.string().min(1, 'name cannot be empty').optional(),
    capacity: z
      .number()
      .int('capacity must be an integer')
      .positive('capacity must be at least 1')
      .optional(),
    description: z.string().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field (name, capacity, or description) is required',
  });

// GET /appointment-types/:id/availability?date=YYYY-MM-DD
export const availabilityQuerySchema = z.object({
  date: z.string().regex(DATE_REGEX, 'date query param must be in YYYY-MM-DD format'),
});
