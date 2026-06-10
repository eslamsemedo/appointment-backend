import { z } from 'zod';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/; // "HH:MM" 24-hour
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/; // "YYYY-MM-DD"
const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const createBookingSchema = z.object({
  appointmentTypeId: z.string().regex(OBJECT_ID_REGEX, 'appointmentTypeId must be a valid id'),
  date: z.string().regex(DATE_REGEX, 'date must be in YYYY-MM-DD format'),
  time: z.string().regex(TIME_REGEX, 'time must be in HH:MM format'),
  customer: z.object({
    name: z.string().min(1, 'customer.name is required'),
    email: z.string().email('customer.email must be a valid email'),
    phone: z.string().min(1, 'customer.phone is required'),
  }),
  note: z.string().optional(),
});

// GET /bookings — all query params optional.
export const listBookingsQuerySchema = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled']).optional(),
  date: z.string().regex(DATE_REGEX, 'date must be in YYYY-MM-DD format').optional(),
  appointmentTypeId: z.string().regex(OBJECT_ID_REGEX, 'appointmentTypeId must be a valid id').optional(),
});
