import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import AppointmentType from '../models/AppointmentType.js';
import { checkSlotAvailability } from '../services/availabilityService.js';
import { sendConfirmationEmail, sendCancellationEmail } from '../services/emailService.js';

const bookingNotFound = (res) =>
  res.status(404).json({
    success: false,
    message: 'Booking not found',
    code: 'NOT_FOUND',
  });

// Look up the appointment type name for an email (scoped to the tenant).
const getTypeName = async (tenantId, appointmentTypeId) => {
  const type = await AppointmentType.findOne({ _id: appointmentTypeId, tenantId }).select('name');
  return type ? type.name : '';
};

// POST /api/v1/bookings — API key (widget) OR JWT (dashboard admin)
export const createBooking = async (req, res, next) => {
  try {
    const { appointmentTypeId, date, time, customer, note } = req.body;

    // Only the dashboard admin (JWT) may create an already-confirmed booking.
    // Widget requests are always pending — the tenant confirms them first.
    const status =
      req.authType === 'jwt' && req.body.status === 'confirmed'
        ? 'confirmed'
        : 'pending';

    // Ownership enforced at the query level.
    const appointmentType = await AppointmentType.findOne({
      _id: appointmentTypeId,
      tenantId: req.tenant._id,
    });

    if (!appointmentType) {
      return res.status(404).json({
        success: false,
        message: 'Appointment type not found',
        code: 'NOT_FOUND',
      });
    }

    // Re-validate the slot — never trust the client's UI state.
    const check = await checkSlotAvailability(req.tenant, appointmentType, date, time);
    if (!check.ok) {
      if (check.reason === 'BOOKING_FULL') {
        return res.status(409).json({
          success: false,
          message: 'No remaining capacity for that slot',
          code: 'BOOKING_FULL',
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Slot is blocked or outside working hours',
        code: 'SLOT_NOT_AVAILABLE',
      });
    }

    const booking = await Booking.create({
      tenantId: req.tenant._id,
      appointmentTypeId,
      date,
      time,
      customer,
      note,
      status,
    });

    // Widget bookings stay pending and send no email — the tenant confirms
    // first. An admin manually adding a confirmed booking notifies the
    // customer immediately, mirroring the confirm endpoint.
    if (status === 'confirmed') {
      await sendConfirmationEmail(req.tenant, booking, appointmentType.name);
    }

    return res.status(201).json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/bookings — JWT (dashboard)
export const listBookings = async (req, res, next) => {
  try {
    const filter = { tenantId: req.tenant._id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.date) filter.date = req.query.date;
    if (req.query.appointmentTypeId) filter.appointmentTypeId = req.query.appointmentTypeId;

    const bookings = await Booking.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: bookings });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/bookings/:id — JWT (dashboard)
export const getBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return bookingNotFound(res);

    const booking = await Booking.findOne({ _id: id, tenantId: req.tenant._id }).populate(
      'appointmentTypeId',
      'name'
    );

    if (!booking) return bookingNotFound(res);

    return res.status(200).json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/v1/bookings/:id/confirm — JWT (dashboard)
export const confirmBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return bookingNotFound(res);

    const booking = await Booking.findOne({ _id: id, tenantId: req.tenant._id });
    if (!booking) return bookingNotFound(res);

    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending bookings can be confirmed',
        code: 'BOOKING_NOT_PENDING',
      });
    }

    booking.status = 'confirmed';
    await booking.save();

    const typeName = await getTypeName(req.tenant._id, booking.appointmentTypeId);
    await sendConfirmationEmail(req.tenant, booking, typeName);

    return res.status(200).json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/v1/bookings/:id/cancel — API key (customer) OR JWT (admin).
// Both paths share identical logic; ownership is scoped by tenantId either way.
export const cancelBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return bookingNotFound(res);

    const booking = await Booking.findOne({ _id: id, tenantId: req.tenant._id });
    if (!booking) return bookingNotFound(res);

    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Booking is already cancelled',
        code: 'BOOKING_ALREADY_CANCELLED',
      });
    }

    booking.status = 'cancelled';
    await booking.save();

    const typeName = await getTypeName(req.tenant._id, booking.appointmentTypeId);
    await sendCancellationEmail(req.tenant, booking, typeName);

    return res.status(200).json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
};
