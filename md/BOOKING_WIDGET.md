# Booking Widget — Frontend Integration Reference

Drop this file into your frontend project. It is the only reference you need to build the customer-facing booking checkout.

---

## Setup

### 1. Environment variables

```env
# .env (Vite / Next.js / CRA — adjust prefix to match your framework)
VITE_API_BASE_URL=https://<your-railway-domain>/api/v1
VITE_API_KEY=<your-tenant-api-key>
```

> The API key is safe to ship in a frontend build. It only scopes operations to your tenant and cannot access the admin dashboard.

### 2. Base API client

```ts
// lib/api.ts
const BASE_URL = import.meta.env.VITE_API_BASE_URL; // or process.env.NEXT_PUBLIC_API_BASE_URL
const API_KEY  = import.meta.env.VITE_API_KEY;       // or process.env.NEXT_PUBLIC_API_KEY

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      ...options.headers,
    },
  });
  const json = await res.json();
  if (!json.success) throw { code: json.code, message: json.message };
  return json.data as T;
}
```

---

## Booking Flow (step by step)

```
Step 1 — Pick an appointment type   (you may hard-code the _id)
Step 2 — Pick a date
Step 3 — Fetch available slots for that date
Step 4 — Pick a slot
Step 5 — Fill in customer details
Step 6 — Submit booking → show confirmation screen
Step 7 — (optional) Cancel booking
```

---

## API Reference — Public Endpoints (x-api-key only)

All requests below are authenticated with the `x-api-key` header (already handled in the base client above).

---

### Step 3 — Get available slots

```
GET /api/v1/appointment-types/:appointmentTypeId/availability?date=YYYY-MM-DD
```

**Response:**

```json
{
  "success": true,
  "data": [
    { "time": "09:00", "capacity": 10, "booked": 3, "remaining": 7, "available": true },
    { "time": "10:00", "capacity": 10, "booked": 10, "remaining": 0, "available": false },
    { "time": "11:00", "capacity": 10, "booked": 0, "remaining": 10, "available": true }
  ]
}
```

**Rules:**
- Returns `[]` when the date is not a working day or the day is fully blocked.
- `available: false` → slot is full. Render it as disabled/greyed out, not hidden.
- Slots are 1 hour each, generated from the tenant's working hours.

**TS example:**

```ts
type Slot = {
  time: string;       // "09:00"
  capacity: number;
  booked: number;
  remaining: number;
  available: boolean;
};

async function getSlots(appointmentTypeId: string, date: string): Promise<Slot[]> {
  return apiFetch<Slot[]>(
    `/appointment-types/${appointmentTypeId}/availability?date=${date}`
  );
}
```

---

### Step 6 — Create a booking

```
POST /api/v1/bookings
```

**Request body:**

```json
{
  "appointmentTypeId": "6651c1d2...",
  "date": "2026-06-15",
  "time": "09:00",
  "customer": {
    "name": "Ahmed Ali",
    "email": "ahmed@example.com",
    "phone": "01012345678"
  },
  "note": "Optional note"
}
```

**Validation rules:**
- `appointmentTypeId` — required, valid MongoDB ObjectId
- `date` — required, `YYYY-MM-DD`
- `time` — required, `HH:MM` (must match a slot exactly)
- `customer.name` — required
- `customer.email` — required, valid email
- `customer.phone` — required
- `note` — optional

**Success `201` response:**

```json
{
  "success": true,
  "data": {
    "_id": "6651e4a0...",
    "date": "2026-06-15",
    "time": "09:00",
    "customer": { "name": "Ahmed Ali", "email": "ahmed@example.com", "phone": "01012345678" },
    "note": "",
    "status": "pending",
    "createdAt": "2026-06-10T12:00:00.000Z"
  }
}
```

> New bookings are always `status: "pending"`. The customer receives **no email** until the tenant confirms from the dashboard.

**Errors to handle:**

| `code` | HTTP | What to show the user |
|--------|------|----------------------|
| `SLOT_NOT_AVAILABLE` | 400 | "This slot is no longer available. Please pick another time." |
| `BOOKING_FULL` | 409 | "This slot just filled up. Please pick another time." |
| `VALIDATION_ERROR` | 400 | Show field-level errors from the `errors` array |
| `INVALID_API_KEY` | 401 | Silent — indicates a misconfigured env variable |

**TS example:**

```ts
type BookingPayload = {
  appointmentTypeId: string;
  date: string;       // "YYYY-MM-DD"
  time: string;       // "HH:MM"
  customer: { name: string; email: string; phone: string };
  note?: string;
};

type Booking = {
  _id: string;
  date: string;
  time: string;
  customer: { name: string; email: string; phone: string };
  note: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
};

async function createBooking(payload: BookingPayload): Promise<Booking> {
  return apiFetch<Booking>('/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
```

---

### Step 7 — Cancel a booking (optional)

```
PATCH /api/v1/bookings/:bookingId/cancel
```

No request body needed.

**Success `200`:** returns the updated booking with `status: "cancelled"`.

A cancellation email is sent to the customer automatically.

**Errors:**

| `code` | HTTP | What to show |
|--------|------|-------------|
| `NOT_FOUND` | 404 | "Booking not found." |
| `BOOKING_ALREADY_CANCELLED` | 400 | "This booking is already cancelled." |

**TS example:**

```ts
async function cancelBooking(bookingId: string): Promise<Booking> {
  return apiFetch<Booking>(`/bookings/${bookingId}/cancel`, { method: 'PATCH' });
}
```

---

## Error Response Shape

Every error follows this envelope:

```json
{
  "success": false,
  "message": "Human-readable description",
  "code": "SNAKE_CASE_ERROR_CODE"
}
```

For `VALIDATION_ERROR`, an extra `errors` array is included:

```json
{
  "success": false,
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "errors": [
    { "field": "customer.email", "message": "customer.email must be a valid email" }
  ]
}
```

---

## Data Formats

| Type | Format | Example |
|------|--------|---------|
| Date | `YYYY-MM-DD` | `"2026-06-15"` |
| Time | `HH:MM` 24-hour | `"09:00"`, `"17:30"` |
| IDs | 24-char hex | `"6651c1d200000000abcd1234"` |
| Timestamps | ISO 8601 UTC | `"2026-06-10T12:00:00.000Z"` |

---

## Booking Status Flow

```
create booking
      ↓
   pending  ← customer sees "awaiting confirmation"
      ↓
  confirmed ← customer receives email
      ↓
  cancelled ← customer or admin; email is sent
```

`cancelled` is a terminal state — it cannot be undone.
