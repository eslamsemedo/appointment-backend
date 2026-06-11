# Appointment Backend — Frontend Integration Guide

This document is the single source of truth for the frontend team. It covers every endpoint, auth flow, request/response shape, and error code you will encounter.

---

## Base URL

```
https://<your-railway-domain>/api/v1
```

For local development:

```
http://localhost:3001/api/v1
```

---

## Authentication

The API has two auth modes. Every protected endpoint requires exactly one of them.

### 1. JWT — Dashboard (admin panel)

Used for all dashboard/admin operations (manage appointment types, view bookings, confirm/cancel as admin).

**How to get a token:**

```
POST /api/v1/auth/login
```

**How to send it:**

```
Authorization: Bearer <token>
```

The token expires in **7 days**. There is no refresh token — when it expires, the user must log in again.

---

### 2. API Key — Public booking widget

Used for the customer-facing booking flow (fetch availability, create a booking, cancel a booking).

The API key is created once per tenant (business) by the platform owner. The frontend embeds it at build time or via an env variable — it never changes unless the tenant is re-created.

**How to send it:**

```
x-api-key: <api-key>
```

---

## Universal Response Envelope

Every response, success or error, follows this shape:

```json
// Success
{
  "success": true,
  "data": { ... }  // object, array, or null
}

// Error
{
  "success": false,
  "message": "Human-readable description",
  "code": "SNAKE_CASE_ERROR_CODE"
}
```

Always check `success` before reading `data`.

---

## Error Codes Reference

| `code` | HTTP | When it happens |
|--------|------|-----------------|
| `INVALID_CREDENTIALS` | 401 | Wrong email or password at login |
| `INVALID_TOKEN` | 401 | JWT is missing, expired, or malformed |
| `INVALID_API_KEY` | 401 | `x-api-key` header is missing or wrong |
| `VALIDATION_ERROR` | 400 | Request body/query failed Zod validation — check `errors` array in the response |
| `NOT_FOUND` | 404 | Resource doesn't exist or doesn't belong to this tenant |
| `BOOKING_FULL` | 409 | Slot has no remaining capacity |
| `BOOKING_ALREADY_CANCELLED` | 400 | Tried to cancel a booking that is already cancelled |
| `BOOKING_NOT_PENDING` | 400 | Tried to confirm a booking that is not in `pending` state |
| `SLOT_NOT_AVAILABLE` | 400 | Slot is outside working hours or is blocked |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

For `VALIDATION_ERROR` the response also includes an `errors` array with field-level details:

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

## Health Check

```
GET /health
```

No auth required. Returns `200` when the server is up.

```json
{ "message": "Server is running" }
```

---

## Auth Endpoints

### Login

```
POST /api/v1/auth/login
```

Auth: **none**

**Request body:**

```json
{
  "email": "admin@example.com",
  "password": "yourpassword"
}
```

**Success `200`:**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGci..."
  }
}
```

Store this token (e.g. `localStorage`) and attach it to every subsequent dashboard request as `Authorization: Bearer <token>`.

**Errors:**

| Scenario | `code` | HTTP |
|----------|--------|------|
| Wrong email or password | `INVALID_CREDENTIALS` | 401 |

---

## Tenant Profile Endpoints

All require `Authorization: Bearer <token>`.

---

### Get my profile

```
GET /api/v1/tenants/me
```

**Success `200`:**

```json
{
  "success": true,
  "data": {
    "_id": "6651a2f3c4e9f10012345678",
    "name": "Blue Ocean Diving",
    "email": "admin@blueocean.com",
    "workingDays": ["Mon", "Tue", "Wed", "Thu", "Fri"],
    "workingHours": { "start": "09:00", "end": "18:00" },
    "blockedTimes": []
  }
}
```

`passwordHash` and `apiKey` are **never** returned.

---

### Update working schedule

```
PUT /api/v1/tenants/me
```

Both fields are optional — send only what you want to change.

**Request body:**

```json
{
  "workingDays": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  "workingHours": { "start": "10:00", "end": "17:00" }
}
```

**Validation rules:**

- `workingDays` — array, each item must be one of: `Mon Tue Wed Thu Fri Sat Sun`
- `workingHours.start` / `workingHours.end` — string in `HH:MM` 24-hour format

**Success `200`:** returns updated tenant profile (same shape as GET /me).

---

### Add a blocked time

```
POST /api/v1/tenants/me/blocked-times
```

Blocks a full day or a time range so no bookings can be made.

**Request body — full day:**

```json
{
  "date": "2026-07-04"
}
```

**Request body — time range:**

```json
{
  "date": "2026-07-04",
  "startTime": "09:00",
  "endTime": "12:00"
}
```

**Validation rules:**

- `date` — required, format `YYYY-MM-DD`
- `startTime` / `endTime` — optional, but both must be provided together (can't send one without the other), format `HH:MM`

**Success `201`:** returns the updated `blockedTimes` array.

```json
{
  "success": true,
  "data": [
    {
      "_id": "6651b3a0...",
      "date": "2026-07-04"
    }
  ]
}
```

---

### Remove a blocked time

```
DELETE /api/v1/tenants/me/blocked-times/:blockId
```

`blockId` is the `_id` of the subdocument returned from the list above.

**Success `200`:** returns the updated `blockedTimes` array (entry removed).

**Errors:**

| Scenario | `code` | HTTP |
|----------|--------|------|
| `blockId` not found | `NOT_FOUND` | 404 |

---

## Appointment Type Endpoints

All require `Authorization: Bearer <token>`.

---

### List appointment types

```
GET /api/v1/appointment-types
```

Returns all appointment types owned by the logged-in tenant, sorted oldest-first.

**Success `200`:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "6651c1d2...",
      "tenantId": "6651a2f3...",
      "name": "Boat Trip",
      "capacity": 10,
      "description": "2-hour boat tour",
      "createdAt": "2026-06-01T08:00:00.000Z",
      "updatedAt": "2026-06-01T08:00:00.000Z"
    }
  ]
}
```

---

### Create an appointment type

```
POST /api/v1/appointment-types
```

**Request body:**

```json
{
  "name": "Boat Trip",
  "capacity": 10,
  "description": "Optional description"
}
```

**Validation rules:**

- `name` — required, non-empty string
- `capacity` — required, positive integer (min 1)
- `description` — optional string

**Success `201`:** returns the created appointment type object.

---

### Update an appointment type

```
PUT /api/v1/appointment-types/:id
```

All fields are optional — send only what you want to change. At least one field is required.

**Request body (all optional, at least one required):**

```json
{
  "name": "Snorkeling Trip",
  "capacity": 8,
  "description": "Updated description"
}
```

**Success `200`:** returns the updated appointment type object.

**Errors:**

| Scenario | `code` | HTTP |
|----------|--------|------|
| Not found or not owned by this tenant | `NOT_FOUND` | 404 |

---

### Delete an appointment type

```
DELETE /api/v1/appointment-types/:id
```

**Success `200`:**

```json
{ "success": true, "data": null }
```

**Errors:**

| Scenario | `code` | HTTP |
|----------|--------|------|
| Not found or not owned by this tenant | `NOT_FOUND` | 404 |

---

## Availability Endpoint

Auth: **`x-api-key`** (public — use this in the customer-facing widget)

---

### Get available slots for a date

```
GET /api/v1/appointment-types/:id/availability?date=YYYY-MM-DD
```

Returns all 1-hour slots for that appointment type on that date, including full ones so the UI can show "fully booked" slots.

**Query param:**

- `date` — required, format `YYYY-MM-DD`

**Success `200`:**

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

**Returns an empty array `[]` when:**
- The date is not a working day for this tenant
- The entire day is blocked

**Slot logic:**
- Slots are generated from the tenant's `workingHours` (e.g. `09:00`–`18:00` → 9 hourly slots)
- Blocked time ranges remove affected slots
- `available: false` means `booked >= capacity` — still returned so the UI can render it as unavailable
- Only non-cancelled bookings count toward `booked`

---

## Booking Endpoints

---

### Create a booking (public)

```
POST /api/v1/bookings
```

Auth: **`x-api-key`**

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
  "note": "Optional note from the customer"
}
```

**Validation rules:**

- `appointmentTypeId` — required, valid MongoDB ObjectId
- `date` — required, format `YYYY-MM-DD`
- `time` — required, format `HH:MM` (24-hour)
- `customer.name` — required
- `customer.email` — required, valid email
- `customer.phone` — required
- `note` — optional

The server re-validates the slot at creation time, regardless of what the availability endpoint returned. Always check for `BOOKING_FULL` and `SLOT_NOT_AVAILABLE` on this call.

New bookings are created with `status: "pending"`. No email is sent until the tenant confirms.

**Success `201`:**

```json
{
  "success": true,
  "data": {
    "_id": "6651e4a0...",
    "tenantId": "6651a2f3...",
    "appointmentTypeId": "6651c1d2...",
    "date": "2026-06-15",
    "time": "09:00",
    "customer": {
      "name": "Ahmed Ali",
      "email": "ahmed@example.com",
      "phone": "01012345678"
    },
    "note": "Optional note",
    "status": "pending",
    "createdAt": "2026-06-10T12:00:00.000Z",
    "updatedAt": "2026-06-10T12:00:00.000Z"
  }
}
```

**Errors:**

| Scenario | `code` | HTTP |
|----------|--------|------|
| Appointment type not found | `NOT_FOUND` | 404 |
| Slot is outside working hours or blocked | `SLOT_NOT_AVAILABLE` | 400 |
| Slot is fully booked | `BOOKING_FULL` | 409 |

---

### Cancel a booking (customer)

```
PATCH /api/v1/bookings/:id/cancel
```

Auth: **`x-api-key`**

The customer can cancel any booking that belongs to this tenant.

A cancellation email is sent to the customer automatically.

**Success `200`:** returns the updated booking with `status: "cancelled"`.

**Errors:**

| Scenario | `code` | HTTP |
|----------|--------|------|
| Booking not found | `NOT_FOUND` | 404 |
| Already cancelled | `BOOKING_ALREADY_CANCELLED` | 400 |

---

### List bookings (dashboard)

```
GET /api/v1/bookings
```

Auth: **`Authorization: Bearer <token>`**

All query params are optional — omit to get all bookings.

**Query params:**

| Param | Type | Example |
|-------|------|---------|
| `status` | `pending` \| `confirmed` \| `cancelled` | `?status=pending` |
| `date` | `YYYY-MM-DD` | `?date=2026-06-15` |
| `appointmentTypeId` | ObjectId string | `?appointmentTypeId=6651c1d2...` |

Results are sorted **newest first**.

**Success `200`:**

```json
{
  "success": true,
  "data": [ /* array of booking objects */ ]
}
```

---

### Get a single booking (dashboard)

```
GET /api/v1/bookings/:id
```

Auth: **`Authorization: Bearer <token>`**

The `appointmentTypeId` field is populated with `{ _id, name }`.

**Success `200`:**

```json
{
  "success": true,
  "data": {
    "_id": "6651e4a0...",
    "appointmentTypeId": { "_id": "6651c1d2...", "name": "Boat Trip" },
    "date": "2026-06-15",
    "time": "09:00",
    "customer": { "name": "Ahmed Ali", "email": "ahmed@example.com", "phone": "01012345678" },
    "note": "",
    "status": "pending",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Errors:**

| Scenario | `code` | HTTP |
|----------|--------|------|
| Not found or not owned by tenant | `NOT_FOUND` | 404 |

---

### Confirm a booking (dashboard)

```
PATCH /api/v1/bookings/:id/confirm
```

Auth: **`Authorization: Bearer <token>`**

Can only be called on bookings with `status: "pending"`. Sends a confirmation email to the customer.

**Success `200`:** returns the updated booking with `status: "confirmed"`.

**Errors:**

| Scenario | `code` | HTTP |
|----------|--------|------|
| Not found | `NOT_FOUND` | 404 |
| Not in pending state | `BOOKING_NOT_PENDING` | 400 |

---

### Cancel a booking (dashboard / admin)

```
PATCH /api/v1/bookings/:id/cancel
```

Auth: **`Authorization: Bearer <token>`**

Same endpoint as the customer cancel but authenticated with JWT. Sends a cancellation email to the customer.

**Success `200`:** returns the updated booking with `status: "cancelled"`.

**Errors:**

| Scenario | `code` | HTTP |
|----------|--------|------|
| Not found | `NOT_FOUND` | 404 |
| Already cancelled | `BOOKING_ALREADY_CANCELLED` | 400 |

---

## Booking Status Flow

```
         Create booking
              |
              v
           pending   <-- tenant sees it in dashboard
              |
       -------+-------
       |               |
    confirm          cancel (tenant or customer)
       |               |
       v               v
    confirmed       cancelled
       |
     cancel (tenant)
       |
       v
    cancelled
```

- `pending` → `confirmed`: tenant action, sends confirmation email to customer
- `pending` → `cancelled`: tenant or customer action, sends cancellation email
- `confirmed` → `cancelled`: tenant action only, sends cancellation email
- `cancelled` is a terminal state — cannot transition out of it

---

## Customer-Facing Booking Flow (step by step)

This is the typical flow for a booking widget embedded in a client's website:

1. **Load appointment types** — you need the type `_id` to fetch availability
   - You can hard-code the `_id` if there's only one type, or fetch the list from a config
   - There is no public endpoint to list appointment types — the `_id` must be known in advance

2. **Fetch availability for a date:**
   ```
   GET /api/v1/appointment-types/:id/availability?date=2026-06-15
   x-api-key: <api-key>
   ```
   Render the returned slots. Hide or grey out slots where `available: false`.

3. **Submit booking:**
   ```
   POST /api/v1/bookings
   x-api-key: <api-key>
   ```
   Always handle `BOOKING_FULL` (409) and `SLOT_NOT_AVAILABLE` (400) — the slot may have filled between the availability check and the submit.

4. **Show confirmation** — inform the customer their booking is pending tenant approval. They will receive an email when the tenant confirms.

5. **Optional cancel button** — if you surface booking details in a "my booking" page:
   ```
   PATCH /api/v1/bookings/:id/cancel
   x-api-key: <api-key>
   ```

---

## Dashboard Flow (step by step)

1. **Login** — `POST /api/v1/auth/login` → store JWT
2. **Set up working schedule** — `PUT /api/v1/tenants/me`
3. **Create appointment types** — `POST /api/v1/appointment-types`
4. **View incoming bookings** — `GET /api/v1/bookings?status=pending`
5. **Confirm or cancel each booking** — `PATCH /api/v1/bookings/:id/confirm` or `/cancel`
6. **Block dates/times** — `POST /api/v1/tenants/me/blocked-times`

---

## Data Format Conventions

| Type | Format | Example |
|------|--------|---------|
| Date | `YYYY-MM-DD` | `"2026-06-15"` |
| Time | `HH:MM` (24-hour) | `"09:00"`, `"17:30"` |
| IDs | 24-char hex string | `"6651c1d200000000abcd1234"` |
| Timestamps | ISO 8601 UTC | `"2026-06-10T12:00:00.000Z"` |

---

## Environment Variables the Frontend Needs

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` (or equivalent) | Backend base URL, e.g. `https://your-app.railway.app/api/v1` |
| `VITE_API_KEY` | The tenant's API key for the public booking widget |

The API key is safe to include in a frontend build — it scopes all public operations to a single tenant and cannot be used to access the dashboard or other tenants' data.
