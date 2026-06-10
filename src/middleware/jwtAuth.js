import jwt from 'jsonwebtoken';
import Tenant from '../models/Tenant.js';
import env from '../config/env.js';

// Dashboard authentication via `Authorization: Bearer <token>`.
// Injects req.tenant (without passwordHash) on success.
export const jwtAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({
        success: false,
        message: 'Missing or malformed token',
        code: 'INVALID_TOKEN',
      });
    }

    let payload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
      });
    }

    const tenant = await Tenant.findById(payload.tenantId).select('-passwordHash');

    if (!tenant) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        code: 'INVALID_TOKEN',
      });
    }

    req.tenant = tenant;
    return next();
  } catch (err) {
    return next(err);
  }
};

export default jwtAuth;
