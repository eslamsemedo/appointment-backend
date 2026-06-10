import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { loginSchema } from '../schemas/auth.schema.js';
import { login } from '../controllers/authController.js';

const router = Router();

router.post('/login', validate(loginSchema), login);

export default router;
