import mongoose from 'mongoose';
import Tenant from '../models/Tenant.js';
import { encrypt } from '../utils/crypto.js';
import { sendTestEmail } from '../services/emailService.js';

// Curated public profile shape — never exposes passwordHash, apiKey, or the
// sender app password.
const serializeTenant = (t) => ({
  _id: t._id,
  name: t.name,
  email: t.email,
  workingDays: t.workingDays,
  workingHours: t.workingHours,
  blockedTimes: t.blockedTimes,
  senderEmail: t.senderEmail || '',
  senderName: t.senderName || '',
  // Expose whether a sender is fully configured without leaking the password.
  emailConfigured: Boolean(t.senderEmail && t.senderAppPassword),
});

// GET /api/v1/tenants/me — JWT
export const getMe = async (req, res, next) => {
  try {
    // req.tenant omits select:false fields; reload with the encrypted password
    // present so emailConfigured reflects reality (the password is never sent).
    const tenant = await Tenant.findById(req.tenant._id).select('+senderAppPassword');
    return res.status(200).json({ success: true, data: serializeTenant(tenant) });
  } catch (err) {
    next(err);
  }
};

// PUT /api/v1/tenants/me — JWT
export const updateMe = async (req, res, next) => {
  try {
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.workingDays !== undefined) updates.workingDays = req.body.workingDays;
    if (req.body.workingHours !== undefined) updates.workingHours = req.body.workingHours;
    if (req.body.senderEmail !== undefined) updates.senderEmail = req.body.senderEmail;
    if (req.body.senderName !== undefined) updates.senderName = req.body.senderName;
    // App password arrives in plaintext over HTTPS; store it encrypted. An
    // empty string clears the configured sender password.
    if (req.body.senderAppPassword !== undefined) {
      updates.senderAppPassword = req.body.senderAppPassword
        ? encrypt(req.body.senderAppPassword)
        : '';
    }

    const tenant = await Tenant.findByIdAndUpdate(
      req.tenant._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('+senderAppPassword');

    return res.status(200).json({ success: true, data: serializeTenant(tenant) });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/tenants/me/email/test — JWT
// Verifies the tenant's sender credentials and emails them a test message.
export const testEmail = async (req, res, next) => {
  try {
    const tenant = await Tenant.findById(req.tenant._id).select('+senderAppPassword');

    await sendTestEmail(tenant);

    return res.status(200).json({
      success: true,
      data: { message: `Test email sent to ${tenant.email}` },
    });
  } catch (err) {
    if (err.code === 'EMAIL_NOT_CONFIGURED') {
      return res.status(400).json({
        success: false,
        message: 'Add a sender email and app password before testing.',
        code: 'EMAIL_NOT_CONFIGURED',
      });
    }
    // SMTP/auth failures: report the reason instead of a 500 so the tenant can fix it.
    return res.status(502).json({
      success: false,
      message: `Could not send test email: ${err.message}`,
      code: 'EMAIL_SEND_FAILED',
    });
  }
};

// POST /api/v1/tenants/me/blocked-times — JWT
export const addBlockedTime = async (req, res, next) => {
  try {
    const { date, startTime, endTime } = req.body;

    const entry = { date };
    if (startTime !== undefined) entry.startTime = startTime;
    if (endTime !== undefined) entry.endTime = endTime;

    const tenant = await Tenant.findByIdAndUpdate(
      req.tenant._id,
      { $push: { blockedTimes: entry } },
      { new: true, runValidators: true }
    );

    return res.status(201).json({ success: true, data: tenant.blockedTimes });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/v1/tenants/me/blocked-times/:blockId — JWT
export const removeBlockedTime = async (req, res, next) => {
  try {
    const { blockId } = req.params;

    if (!mongoose.isValidObjectId(blockId)) {
      return res.status(404).json({
        success: false,
        message: 'Blocked time not found',
        code: 'NOT_FOUND',
      });
    }

    // The filter only matches when the blockId actually exists in the array, so
    // a null result means "not found". ($pull + timestamps always bumps
    // updatedAt, so modifiedCount can't distinguish a real pull from a no-op.)
    const tenant = await Tenant.findOneAndUpdate(
      { _id: req.tenant._id, 'blockedTimes._id': blockId },
      { $pull: { blockedTimes: { _id: blockId } } },
      { new: true }
    );

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Blocked time not found',
        code: 'NOT_FOUND',
      });
    }

    return res.status(200).json({ success: true, data: tenant.blockedTimes });
  } catch (err) {
    next(err);
  }
};
