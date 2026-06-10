import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    appointmentTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AppointmentType',
      required: true,
      index: true,
    },
    date: { type: String, required: true, index: true }, // "YYYY-MM-DD"
    time: { type: String, required: true }, // "HH:MM"
    customer: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
    },
    note: { type: String },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

// Critical for fast availability queries.
bookingSchema.index({ tenantId: 1, appointmentTypeId: 1, date: 1, time: 1 });

export default mongoose.model('Booking', bookingSchema);
