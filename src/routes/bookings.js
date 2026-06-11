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

// Some endpoints are reachable by the customer/widget (x-api-key) or the
// tenant admin (Bearer JWT). Same path + method, so a single handler accepts
// either credential and resolves req.tenant accordingly. We tag req.authType
// so controllers can grant admin-only behaviour (e.g. creating a booking that
// is already confirmed).
const eitherAuth = (req, res, next) => {
  if (req.headers.authorization) {
    req.authType = 'jwt';
    return jwtAuth(req, res, next);
  }
  if (req.headers['x-api-key']) {
    req.authType = 'apikey';
    return apiKeyAuth(req, res, next);
  }
  return res.status(401).json({
    success: false,
    message: 'Authentication required',
    code: 'INVALID_API_KEY',
  });
};

// Widget (API key, status forced to pending) OR admin (JWT, may create as
// confirmed straight from the dashboard).
router.post('/', eitherAuth, validate(createBookingSchema), createBooking);

// Customer (API key) OR admin (JWT).
router.patch('/:id/cancel', eitherAuth, cancelBooking);

// Dashboard (JWT).
router.get('/', jwtAuth, validate(listBookingsQuerySchema, 'query'), listBookings);
router.get('/:id', jwtAuth, getBooking);
router.patch('/:id/confirm', jwtAuth, confirmBooking);

export default router;
