# Booking API — Integration Guide

This guide is for the **website/frontend developer**. It covers the two endpoints your booking page needs, plus code examples ready to drop in.

---

## What you need before you start

You need one value from the backend owner (Eslam):

| Value | What it is |
|---|---|
| `API_KEY` | Your `x-api-key` header value — authenticates all public requests |
| `BASE_URL` | The deployed backend URL, e.g. `https://your-backend.up.railway.app` |
| `APPOINTMENT_TYPE_ID` | The MongoDB ObjectId of the appointment type you want to show |

---

## The 3-step flow on your booking page

```
1. Page loads  →  GET availability for a date  →  show available time slots
2. User fills the form  →  POST booking  →  booking is stored in the database
3. Done — the client receives an email only after the admin confirms the booking
```

---

## Endpoint 1 — Get available time slots

Use this to populate a date picker or time slot grid.

```
GET {BASE_URL}/api/v1/appointment-types/{APPOINTMENT_TYPE_ID}/availability?date=YYYY-MM-DD
```

**Headers**

```
x-api-key: YOUR_API_KEY
```

**Example request**

```js
const res = await fetch(
  `${BASE_URL}/api/v1/appointment-types/${APPOINTMENT_TYPE_ID}/availability?date=2026-06-15`,
  {
    headers: { 'x-api-key': YOUR_API_KEY },
  }
);
const { data } = await res.json();
```

**Example response**

```json
{
  "success": true,
  "data": [
    { "time": "09:00", "capacity": 3, "booked": 1, "remaining": 2, "available": true },
    { "time": "10:00", "capacity": 3, "booked": 3, "remaining": 0, "available": false },
    { "time": "11:00", "capacity": 3, "booked": 0, "remaining": 3, "available": true }
  ]
}
```

**What to do with it:** only show / allow selection of slots where `available: true`.

If the response is an empty array `[]`, the date is a non-working day or is fully blocked.

---

## Endpoint 2 — Create a booking

Call this when the user submits the booking form. The booking is **stored in the database** with status `pending`. A confirmation email is sent to the customer only after the admin approves it in the dashboard.

```
POST {BASE_URL}/api/v1/bookings
```

**Headers**

```
Content-Type: application/json
x-api-key: YOUR_API_KEY
```

**Request body**

```json
{
  "appointmentTypeId": "APPOINTMENT_TYPE_ID",
  "date": "2026-06-15",
  "time": "09:00",
  "customer": {
    "name": "Sara Ahmed",
    "email": "sara@example.com",
    "phone": "+201001234567"
  },
  "note": "Optional free-text note from the customer"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `appointmentTypeId` | string | yes | 24-char MongoDB ObjectId |
| `date` | string | yes | `YYYY-MM-DD` format |
| `time` | string | yes | `HH:MM` 24-hour format, must match an available slot |
| `customer.name` | string | yes | |
| `customer.email` | string | yes | Valid email |
| `customer.phone` | string | yes | |
| `note` | string | no | |

**Success response — 201**

```json
{
  "success": true,
  "data": {
    "_id": "6849abc123def456ghi789",
    "tenantId": "...",
    "appointmentTypeId": "...",
    "date": "2026-06-15",
    "time": "09:00",
    "customer": { "name": "Sara Ahmed", "email": "sara@example.com", "phone": "+201001234567" },
    "note": "",
    "status": "pending",
    "createdAt": "2026-06-15T07:23:00.000Z",
    "updatedAt": "2026-06-15T07:23:00.000Z"
  }
}
```

Save `data._id` if you want to show the customer a booking reference or allow them to cancel later.

---

## Error responses you need to handle

| HTTP | `code` | Meaning | What to show the user |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing or malformed field | Show the field errors from `details` |
| 400 | `SLOT_NOT_AVAILABLE` | Slot is outside working hours or blocked | "This slot is no longer available, please pick another time" |
| 401 | `INVALID_API_KEY` | Wrong or missing API key | Internal error — check your key |
| 404 | `NOT_FOUND` | Wrong `appointmentTypeId` | Internal error — check the ID |
| 409 | `BOOKING_FULL` | Slot filled between your availability check and submit | "This slot just filled up, please pick another time" |

All error responses follow this shape:

```json
{
  "success": false,
  "message": "Human-readable message",
  "code": "ERROR_CODE"
}
```

---

## Optional — Let the customer cancel their own booking

```
PATCH {BASE_URL}/api/v1/bookings/{bookingId}/cancel
```

**Headers**

```
x-api-key: YOUR_API_KEY
```

No body required. Returns the updated booking with `status: "cancelled"`.

---

## Full booking form example (vanilla JS)

```js
const BASE_URL = 'https://your-backend.up.railway.app';
const API_KEY  = 'your-api-key-here';
const APPOINTMENT_TYPE_ID = 'your-appointment-type-id-here';

// Step 1: load slots when the user picks a date
async function loadSlots(date) {
  const res = await fetch(
    `${BASE_URL}/api/v1/appointment-types/${APPOINTMENT_TYPE_ID}/availability?date=${date}`,
    { headers: { 'x-api-key': API_KEY } }
  );
  const { data } = await res.json();
  return data.filter(slot => slot.available); // only show available ones
}

// Step 2: submit the booking
async function submitBooking({ date, time, name, email, phone, note }) {
  const res = await fetch(`${BASE_URL}/api/v1/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({
      appointmentTypeId: APPOINTMENT_TYPE_ID,
      date,
      time,
      customer: { name, email, phone },
      note,
    }),
  });

  const body = await res.json();

  if (!res.ok) {
    // body.message is human-readable, body.code is machine-readable
    throw new Error(body.message);
  }

  return body.data; // contains _id, status: "pending", etc.
}
```

---

## Health check (optional)

```
GET {BASE_URL}/health
```

Returns `{ "message": "Server is running" }` with status 200. Useful for testing connectivity before loading your page.
