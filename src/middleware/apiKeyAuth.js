import Tenant from '../models/Tenant.js';

// Public API authentication via the `x-api-key` header.
// Injects req.tenant (without passwordHash) on success.
export const apiKeyAuth = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'Missing API key',
        code: 'INVALID_API_KEY',
      });
    }

    const tenant = await Tenant.findOne({ apiKey }).select('-passwordHash');

    if (!tenant) {
      return res.status(401).json({
        success: false,
        message: 'Invalid API key',
        code: 'INVALID_API_KEY',
      });
    }

    req.tenant = tenant;
    return next();
  } catch (err) {
    return next(err);
  }
};

export default apiKeyAuth;
