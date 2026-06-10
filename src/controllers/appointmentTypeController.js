import mongoose from 'mongoose';
import AppointmentType from '../models/AppointmentType.js';
import { computeAvailability } from '../services/availabilityService.js';

const notFound = (res) =>
  res.status(404).json({
    success: false,
    message: 'Appointment type not found',
    code: 'NOT_FOUND',
  });

// GET /api/v1/appointment-types — JWT
export const listAppointmentTypes = async (req, res, next) => {
  try {
    const types = await AppointmentType.find({ tenantId: req.tenant._id }).sort({ createdAt: 1 });
    return res.status(200).json({ success: true, data: types });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/appointment-types — JWT
export const createAppointmentType = async (req, res, next) => {
  try {
    const type = await AppointmentType.create({
      tenantId: req.tenant._id,
      name: req.body.name,
      capacity: req.body.capacity,
      description: req.body.description,
    });
    return res.status(201).json({ success: true, data: type });
  } catch (err) {
    next(err);
  }
};

// PUT /api/v1/appointment-types/:id — JWT
export const updateAppointmentType = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return notFound(res);

    const updates = {};
    ['name', 'capacity', 'description'].forEach((key) => {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    });

    // Ownership enforced at the query level.
    const type = await AppointmentType.findOneAndUpdate(
      { _id: id, tenantId: req.tenant._id },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!type) return notFound(res);

    return res.status(200).json({ success: true, data: type });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/v1/appointment-types/:id — JWT
export const deleteAppointmentType = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return notFound(res);

    const type = await AppointmentType.findOneAndDelete({ _id: id, tenantId: req.tenant._id });

    if (!type) return notFound(res);

    return res.status(200).json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/appointment-types/:id/availability?date=YYYY-MM-DD — API key
export const getAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!mongoose.isValidObjectId(id)) return notFound(res);

    const appointmentType = await AppointmentType.findOne({ _id: id, tenantId: req.tenant._id });
    if (!appointmentType) return notFound(res);

    const slots = await computeAvailability(req.tenant, appointmentType, date);

    return res.status(200).json({ success: true, data: slots });
  } catch (err) {
    next(err);
  }
};
