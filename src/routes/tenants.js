import { Router } from 'express';
import { jwtAuth } from '../middleware/jwtAuth.js';
import { validate } from '../middleware/validate.js';
import { updateTenantSchema, blockedTimeSchema } from '../schemas/tenant.schema.js';
import {
  getMe,
  updateMe,
  testEmail,
  addBlockedTime,
  removeBlockedTime,
} from '../controllers/tenantController.js';

const router = Router();

// All tenant routes require JWT.
router.use(jwtAuth);

router.get('/me', getMe);
router.put('/me', validate(updateTenantSchema), updateMe);
router.post('/me/email/test', testEmail);
router.post('/me/blocked-times', validate(blockedTimeSchema), addBlockedTime);
router.delete('/me/blocked-times/:blockId', removeBlockedTime);

export default router;
