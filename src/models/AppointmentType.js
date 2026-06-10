import mongoose from 'mongoose';

const appointmentTypeSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 1 },
    description: { type: String, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model('AppointmentType', appointmentTypeSchema);
