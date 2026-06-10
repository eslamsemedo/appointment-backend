import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Tenant from '../models/Tenant.js';
import env from '../config/env.js';

// POST /api/v1/auth/login — Public
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Use .select('+passwordHash') to bypass select: false — only place this happens.
    const tenant = await Tenant.findOne({ email: email.toLowerCase() }).select('+passwordHash');

    if (!tenant) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    const match = await bcrypt.compare(password, tenant.passwordHash);
    if (!match) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    const token = jwt.sign({ tenantId: tenant._id }, env.JWT_SECRET, { expiresIn: '7d' });

    return res.status(200).json({ success: true, data: { token } });
  } catch (err) {
    next(err);
  }
};
