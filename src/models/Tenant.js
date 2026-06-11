import mongoose from 'mongoose';

// Each blocked-time entry is a subdocument and gets an auto _id from Mongoose.
// Rule: no startTime/endTime  -> full day blocked
// Rule: with startTime/endTime -> only that range blocked
const blockedTimeSchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // "YYYY-MM-DD"
    startTime: { type: String }, // "HH:MM"
    endTime: { type: String }, // "HH:MM"
  },
  { _id: true }
);

const tenantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // NEVER returned in API responses. Only the login controller uses .select('+passwordHash').
    passwordHash: { type: String, required: true, select: false },
    apiKey: { type: String, required: true, unique: true },

    // Per-tenant outbound email ("bring your own sender"). Each tenant sends
    // confirmation/cancellation emails from their own mailbox instead of a
    // single shared env account.
    senderEmail: { type: String, lowercase: true, trim: true }, // e.g. a Gmail address
    // Display name on the "From" line; falls back to the business name.
    senderName: { type: String, trim: true },
    // The mailbox app password, AES-encrypted at rest (see utils/crypto.js).
    // NEVER returned in API responses; only emailService selects it explicitly.
    senderAppPassword: { type: String, select: false },
    workingDays: {
      type: [String],
      enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      default: [],
    },
    workingHours: {
      start: { type: String }, // "HH:MM"
      end: { type: String }, // "HH:MM"
    },
    blockedTimes: { type: [blockedTimeSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model('Tenant', tenantSchema);
