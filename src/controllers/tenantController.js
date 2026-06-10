import mongoose from 'mongoose';
import Tenant from '../models/Tenant.js';

// Curated public profile shape — never exposes passwordHash or apiKey.
const serializeTenant = (t) => ({
  _id: t._id,
  name: t.name,
  email: t.email,
  workingDays: t.workingDays,
  workingHours: t.workingHours,
  blockedTimes: t.blockedTimes,
});

// GET /api/v1/tenants/me — JWT
export const getMe = async (req, res, next) => {
  try {
    return res.status(200).json({ success: true, data: serializeTenant(req.tenant) });
  } catch (err) {
    next(err);
  }
};

// PUT /api/v1/tenants/me — JWT
export const updateMe = async (req, res, next) => {
  try {
    const updates = {};
    if (req.body.workingDays !== undefined) updates.workingDays = req.body.workingDays;
    if (req.body.workingHours !== undefined) updates.workingHours = req.body.workingHours;

    const tenant = await Tenant.findByIdAndUpdate(
      req.tenant._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    return res.status(200).json({ success: true, data: serializeTenant(tenant) });
  } catch (err) {
    next(err);
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
