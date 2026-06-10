import { Router } from 'express';
import { jwtAuth } from '../middleware/jwtAuth.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { validate } from '../middleware/validate.js';
import {
  createAppointmentTypeSchema,
  updateAppointmentTypeSchema,
  availabilityQuerySchema,
} from '../schemas/appointmentType.schema.js';
import {
  listAppointmentTypes,
  createAppointmentType,
  updateAppointmentType,
  deleteAppointmentType,
  getAvailability,
} from '../controllers/appointmentTypeController.js';

const router = Router();

// Public (API key) — availability.
router.get(
  '/:id/availability',
  apiKeyAuth,
  validate(availabilityQuerySchema, 'query'),
  getAvailability
);

// Dashboard (JWT) — CRUD.
router.get('/', jwtAuth, listAppointmentTypes);
router.post('/', jwtAuth, validate(createAppointmentTypeSchema), createAppointmentType);
router.put('/:id', jwtAuth, validate(updateAppointmentTypeSchema), updateAppointmentType);
router.delete('/:id', jwtAuth, deleteAppointmentType);

export default router;
