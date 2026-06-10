import Booking from '../models/Booking.js';

// "2026-06-15" -> "Mon" (parsed and formatted in the same local timezone, so
// the weekday is stable regardless of server timezone).
const getDayName = (date) =>
  new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });

// "09:00" -> 9
const parseHour = (hhmm) => parseInt(hhmm.split(':')[0], 10);

// workingHours { start: "09:00", end: "18:00" } -> ["09:00","10:00",...,"17:00"]
// Last slot starts at (end hour - 1).
const generateSlots = (workingHours) => {
  if (!workingHours || !workingHours.start || !workingHours.end) return [];

  const startHour = parseHour(workingHours.start);
  const endHour = parseHour(workingHours.end);

  const slots = [];
  for (let h = startHour; h < endHour; h += 1) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
  }
  return slots;
};

// Count active (non-cancelled) bookings for one exact slot.
const countActiveBookings = (tenantId, appointmentTypeId, date, time) =>
  Booking.countDocuments({
    tenantId,
    appointmentTypeId,
    date,
    time,
    status: { $ne: 'cancelled' },
  });

/**
 * Compute live availability for a given appointment type on a given date.
 * Derives slots entirely in memory from the tenant's working days/hours and
 * blocked times, then counts active bookings per slot in parallel.
 *
 * Returns an array of ALL slots (including full ones) with an availability flag.
 */
export const computeAvailability = async (tenant, appointmentType, date) => {
  // 1 + 2. Day must be a working day.
  const day = getDayName(date);
  if (!tenant.workingDays.includes(day)) {
    return [];
  }

  // 3. Generate all 1-hour slots within working hours.
  let slots = generateSlots(tenant.workingHours);

  // 4. Remove blocked slots.
  for (const entry of tenant.blockedTimes) {
    if (entry.date !== date) continue;

    // No startTime/endTime -> entire day blocked, stop here.
    if (!entry.startTime || !entry.endTime) {
      return [];
    }

    slots = slots.filter((slot) => !(slot >= entry.startTime && slot < entry.endTime));
  }

  // 5. Count active bookings for every remaining slot in parallel.
  const counts = await Promise.all(
    slots.map((time) => countActiveBookings(tenant._id, appointmentType._id, date, time))
  );

  // 6. Map to the response shape.
  return slots.map((time, i) => ({
    time,
    capacity: appointmentType.capacity,
    booked: counts[i],
    remaining: appointmentType.capacity - counts[i],
    available: counts[i] < appointmentType.capacity,
  }));
};

/**
 * Re-validate a single date+time slot when creating a booking.
 * Mirrors the availability computation but for one exact slot.
 *
 * Returns:
 *   { ok: true }
 *   { ok: false, reason: 'SLOT_NOT_AVAILABLE' }  (not a working day / outside hours / blocked)
 *   { ok: false, reason: 'BOOKING_FULL' }        (no remaining capacity)
 */
export const checkSlotAvailability = async (tenant, appointmentType, date, time) => {
  // Is the date a working day?
  const day = getDayName(date);
  if (!tenant.workingDays.includes(day)) {
    return { ok: false, reason: 'SLOT_NOT_AVAILABLE' };
  }

  // Is the time a real slot within working hours?
  const slots = generateSlots(tenant.workingHours);
  if (!slots.includes(time)) {
    return { ok: false, reason: 'SLOT_NOT_AVAILABLE' };
  }

  // Is the slot blocked?
  for (const entry of tenant.blockedTimes) {
    if (entry.date !== date) continue;
    if (!entry.startTime || !entry.endTime) {
      return { ok: false, reason: 'SLOT_NOT_AVAILABLE' };
    }
    if (time >= entry.startTime && time < entry.endTime) {
      return { ok: false, reason: 'SLOT_NOT_AVAILABLE' };
    }
  }

  // Capacity check.
  const bookedCount = await countActiveBookings(tenant._id, appointmentType._id, date, time);
  if (bookedCount >= appointmentType.capacity) {
    return { ok: false, reason: 'BOOKING_FULL' };
  }

  return { ok: true };
};
