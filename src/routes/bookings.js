import { Router } from 'express';
import { jwtAuth } from '../middleware/jwtAuth.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { validate } from '../middleware/validate.js';
import { createBookingSchema, listBookingsQuerySchema } from '../schemas/booking.schema.js';
import {
  createBooking,
  listBookings,
  getBooking,
  confirmBooking,
  cancelBooking,
} from '../controllers/bookingController.js';

const router = Router();

// The cancel endpoint is reachable by the customer (x-api-key) or the tenant
// admin (Bearer JWT). Same path + method, so a single handler accepts either
// credential and resolves req.tenant accordingly.
const eitherAuth = (req, res, next) => {
  if (req.headers['x-api-key']) return apiKeyAuth(req, res, next);
  if (req.headers.authorization) return jwtAuth(req, res, next);
  return res.status(401).json({
    success: false,
    message: 'Authentication required',
    code: 'INVALID_API_KEY',
  });
};

// Public (API key).
router.post('/', apiKeyAuth, validate(createBookingSchema), createBooking);

// Customer (API key) OR admin (JWT).
router.patch('/:id/cancel', eitherAuth, cancelBooking);

// Dashboard (JWT).
router.get('/', jwtAuth, validate(listBookingsQuerySchema, 'query'), listBookings);
router.get('/:id', jwtAuth, getBooking);
router.patch('/:id/confirm', jwtAuth, confirmBooking);

export default router;
