# Appointment SaaS — Backend Specification

> This file is the single source of truth for building the Node.js backend.
> Read it fully before writing any code.

---

## Project Overview

A multi-tenant appointment management SaaS. Businesses (doctors, dentists,
consultants, diving companies, lawyers, etc.) embed it into their own websites
to manage hourly bookings.

**3 actors:**
- **Platform owner** — creates tenants manually via a terminal script
- **Tenant admin** — logs into a dashboard (JWT) to manage types and bookings
- **Customer** — books through the client's website using the public API

---

## Tech Stack

| Layer        | Technology              |
|--------------|-------------------------|
| Runtime      | Node.js (ES Modules)    |
| Framework    | Express                 |
| Database     | MongoDB Atlas/Mongoose  |
| Validation   | Zod                     |
| Auth (public)| API key — `x-api-key` header |
| Auth (dashboard) | JWT — `Authorization: Bearer` |
| Email        | Nodemailer + Gmail app password |
| API key gen  | nanoid                  |
| Password hash| bcryptjs                |
| Env vars     | dotenv + Zod validation |

**All files use ES Modules (`import`/`export`). No `require()`.**

---

## Folder Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── db.js                    # MongoDB Atlas connection
│   │   └── env.js                   # Zod env validation — fails fast if vars missing
│   ├── models/
│   │   ├── Tenant.js
│   │   ├── AppointmentType.js
│   │   └── Booking.js
│   ├── schemas/                     # Zod request validation schemas
│   │   ├── auth.schema.js
│   │   ├── tenant.schema.js
│   │   ├── appointmentType.schema.js
│   │   └── booking.schema.js
│   ├── middleware/
│   │   ├── apiKeyAuth.js            # Reads x-api-key, injects req.tenant
│   │   ├── jwtAuth.js               # Reads Bearer token, injects req.tenant
│   │   ├── validate.js              # Zod middleware wrapper
│   │   └── errorHandler.js          # Global error handler
│   ├── routes/
│   │   ├── auth.js
│   │   ├── tenants.js
│   │   ├── appointmentTypes.js
│   │   └── bookings.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── tenantController.js
│   │   ├── appointmentTypeController.js
│   │   └── bookingController.js
│   ├── services/
│   │   ├── availabilityService.js   # Core live slot computation — no DB writes
│   │   └── emailService.js          # Nodemailer — Gmail app password
│   └── app.js                       # Express setup, CORS, route mounting
├── scripts/
│   └── createTenant.js              # Run locally to onboard a new tenant
├── .env.example
├── .gitignore
├── package.json                     # type: "module"
└── server.js                        # Entry point
```

---

## Environment Variables

### `.env.example`
```
MONGODB_URl=mongodb+srv://...
JWT_SECRET=a_long_random_secret
PORT=3001

GMAIL_USER=youremail@gmail.com
GMAIL_APP_PASSWORD=xxxx_xxxx_xxxx_xxxx
EMAIL_FROM=Appointment SaaS <youremail@gmail.com>
```

### `src/config/env.js`
Use Zod to validate all env vars at startup. If any required var is missing,
throw an error immediately — do not start the server.

---

## Data Models

### Tenant (`src/models/Tenant.js`)

```
_id             ObjectId        Auto
name            String          required, trim
email           String          required, unique, lowercase, trim
passwordHash    String          required, select: false  ← NEVER returned in API
apiKey          String          required, unique
workingDays     [String]        enum: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
workingHours    Object          { start: String, end: String }  format: "HH:MM"
blockedTimes    [Object]        subdocuments — each gets auto _id from Mongoose
                                { _id, date: String, startTime?: String, endTime?: String }
                                Rule: no startTime/endTime = full day blocked
                                Rule: with startTime/endTime = only that range blocked
timestamps      true            createdAt, updatedAt auto-managed
```

**Security rule:** Always use `.select('-passwordHash')` or rely on `select: false`
on the field. Never return `passwordHash` in any API response.

---

### AppointmentType (`src/models/AppointmentType.js`)

```
_id                 ObjectId        Auto
tenantId            ObjectId        required, ref: 'Tenant', indexed
name                String          required, trim
capacity            Number          required, min: 1, integer
description         String          optional, trim
timestamps          true
```

**Index:** `{ tenantId: 1 }`

---

### Booking (`src/models/Booking.js`)

```
_id                 ObjectId        Auto
tenantId            ObjectId        required, ref: 'Tenant', indexed
appointmentTypeId   ObjectId        required, ref: 'AppointmentType', indexed
date                String          required  format: "YYYY-MM-DD"  indexed
time                String          required  format: "HH:MM"
customer            Object          { name: String, email: String, phone: String } all required
note                String          optional
status              String          enum: ['pending','confirmed','cancelled']  default: 'pending'
timestamps          true
```

**Indexes:**
- `{ tenantId: 1 }`
- `{ date: 1 }`
- Compound: `{ tenantId: 1, appointmentTypeId: 1, date: 1, time: 1 }` — critical for availability queries

**Why String for date/time:** Avoids timezone bugs. Strings match exactly what
the client sends and what the availability service compares.

---

## Response Format

**Every single endpoint must follow this format. No exceptions.**

### Success
```json
{
  "success": true,
  "data": { }
}
```

### Error
```json
{
  "success": false,
  "message": "Human-readable message",
  "code": "SNAKE_CASE_ERROR_CODE"
}
```

### Error codes used across the project

| Code | HTTP | Meaning |
|------|------|---------|
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `INVALID_TOKEN` | 401 | JWT missing, expired, or invalid |
| `INVALID_API_KEY` | 401 | x-api-key missing or not found |
| `VALIDATION_ERROR` | 400 | Zod validation failed |
| `NOT_FOUND` | 404 | Resource not found |
| `BOOKING_FULL` | 409 | No remaining capacity for that slot |
| `BOOKING_ALREADY_CANCELLED` | 400 | Cannot act on a cancelled booking |
| `BOOKING_NOT_PENDING` | 400 | Cannot confirm a non-pending booking |
| `SLOT_NOT_AVAILABLE` | 400 | Slot is blocked or outside working hours |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Middleware

### `src/middleware/apiKeyAuth.js`
- Read `req.headers['x-api-key']`
- Find tenant: `Tenant.findOne({ apiKey }).select('-passwordHash')`
- If not found → `{ success: false, message: '...', code: 'INVALID_API_KEY' }` 401
- Inject `req.tenant = tenant`
- Call `next()`

### `src/middleware/jwtAuth.js`
- Read `Authorization: Bearer <token>`
- Verify with `JWT_SECRET`
- Find tenant by `_id` from payload: `Tenant.findById(id).select('-passwordHash')`
- If missing/invalid/expired → `{ ..., code: 'INVALID_TOKEN' }` 401
- Inject `req.tenant = tenant`
- Call `next()`

### `src/middleware/validate.js`
- Generic Zod middleware wrapper
- Usage: `validate(schema)` — wraps `req.body` (or `req.query`) through the schema
- On failure → `{ ..., code: 'VALIDATION_ERROR', errors: [...] }` 400
- On success → call `next()`

### `src/middleware/errorHandler.js`
- Global Express error handler (4 args)
- Catches anything passed to `next(err)`
- Logs the error
- Returns `{ success: false, message: '...', code: 'INTERNAL_ERROR' }` 500

---

## All Endpoints (19 total)

### Auth

#### `POST /api/v1/auth/login` — Public
Request body:
```json
{ "email": "tenant@example.com", "password": "secret" }
```
Logic:
1. Find tenant by email (use `.select('+passwordHash')` to bypass `select: false`)
2. Compare password with `bcryptjs.compare`
3. If mismatch → 401 `INVALID_CREDENTIALS`
4. Sign JWT: `{ tenantId: tenant._id }`, expires in `7d`
5. Return `{ success: true, data: { token } }`

---

### Tenant Profile

#### `GET /api/v1/tenants/me` — JWT
Returns the tenant's own profile. Never include `passwordHash`.

Response `data`:
```json
{
  "_id": "...",
  "name": "Blue Ocean",
  "email": "admin@blueocean.com",
  "workingDays": ["Mon","Tue","Wed"],
  "workingHours": { "start": "09:00", "end": "18:00" },
  "blockedTimes": []
}
```

---

#### `PUT /api/v1/tenants/me` — JWT
Updates working hours and/or working days.

Allowed fields (all optional, validated by Zod):
```json
{
  "workingDays": ["Mon","Tue","Thu"],
  "workingHours": { "start": "10:00", "end": "17:00" }
}
```
Return updated tenant. Never include `passwordHash`.

---

### Blocked Times

#### `POST /api/v1/tenants/me/blocked-times` — JWT
Adds one blocked time entry to the tenant's `blockedTimes` array.

Request body (Zod validated):
```json
{ "date": "2026-07-04" }
```
or:
```json
{ "date": "2026-07-04", "startTime": "09:00", "endTime": "12:00" }
```

Rules:
- `date` required, format `YYYY-MM-DD`
- `startTime` and `endTime` both optional — but if one is present, both must be present
- Use `$push` to add the entry

Return updated `blockedTimes` array.

---

#### `DELETE /api/v1/tenants/me/blocked-times/:blockId` — JWT
Removes one entry from `blockedTimes` by its subdocument `_id`.

Use `$pull: { blockedTimes: { _id: blockId } }`.

If nothing was pulled (blockId not found) → 404 `NOT_FOUND`.

Return updated `blockedTimes` array.

---

### Appointment Types

#### `GET /api/v1/appointment-types` — JWT
Returns all types for `req.tenant._id`. Sorted by `createdAt` ascending.

---

#### `POST /api/v1/appointment-types` — JWT
Request body:
```json
{ "name": "Boat Trip", "capacity": 10, "description": "optional" }
```
Zod: `name` required string, `capacity` required positive integer, `description` optional string.

Return created document.

---

#### `PUT /api/v1/appointment-types/:id` — JWT
Updates `name`, `capacity`, and/or `description`. All optional in body, at least one required.

Query must include `{ _id: id, tenantId: req.tenant._id }` — ownership at DB level.

If not found → 404 `NOT_FOUND`.

Return updated document.

---

#### `DELETE /api/v1/appointment-types/:id` — JWT
Query: `{ _id: id, tenantId: req.tenant._id }`.

If not found → 404 `NOT_FOUND`.

Return `{ success: true, data: null }`.

---

### Availability (Public — API key)

#### `GET /api/v1/appointment-types/:id/availability?date=YYYY-MM-DD` — API key

**This is the most important endpoint. Implement with care.**

Logic (all in `availabilityService.js`):

```
1. Validate query param `date` — required, format YYYY-MM-DD

2. Fetch the AppointmentType by { _id: id, tenantId: req.tenant._id }
   → 404 if not found

3. Get the tenant from req.tenant (already injected by apiKeyAuth)

4. Convert date string to a day name (e.g. "Mon") using JS Date
   Check if that day is in tenant.workingDays
   → If not: return { success: true, data: [] }

5. Generate all 1-hour slots between workingHours.start and workingHours.end
   e.g. "09:00" → "18:00" produces: ["09:00","10:00","11:00",...,"17:00"]
   The last slot starts at end minus 1 hour (17:00 for end=18:00)

6. Filter out blocked slots:
   For each entry in tenant.blockedTimes where entry.date === date:
     - If no startTime/endTime → remove ALL slots (full day block)
     - If startTime/endTime present → remove slots where
       slot >= entry.startTime AND slot < entry.endTime

7. For each remaining slot, count active bookings:
   Booking.countDocuments({
     tenantId: req.tenant._id,
     appointmentTypeId: id,
     date,
     time: slot,
     status: { $ne: 'cancelled' }
   })

8. Compute remaining = appointmentType.capacity - bookedCount

9. Return array of ALL slots (including full ones) with availability flag:
[
  { "time": "09:00", "capacity": 10, "booked": 7, "remaining": 3, "available": true },
  { "time": "10:00", "capacity": 10, "booked": 10, "remaining": 0, "available": false },
  { "time": "11:00", "capacity": 10, "booked": 0, "remaining": 10, "available": true }
]
```

**Performance note:** The compound index `{ tenantId, appointmentTypeId, date, time }`
makes step 7 fast. Run the `countDocuments` queries in parallel using `Promise.all`.

---

### Bookings — Public (API key)

#### `POST /api/v1/bookings` — API key

Request body:
```json
{
  "appointmentTypeId": "...",
  "date": "2026-06-15",
  "time": "09:00",
  "customer": { "name": "Ahmed", "email": "ahmed@email.com", "phone": "01012345678" },
  "note": "optional"
}
```

Logic:
1. Zod validate body
2. Verify the appointmentType belongs to `req.tenant._id` → 404 if not
3. Re-run availability check for that specific slot:
   - Is the date a working day? → 400 `SLOT_NOT_AVAILABLE`
   - Is the slot blocked? → 400 `SLOT_NOT_AVAILABLE`
   - Count active bookings → if `bookedCount >= capacity` → 409 `BOOKING_FULL`
4. Create booking: `status: 'pending'`
5. **Do not send any email** — tenant confirms first
6. Return 201 with created booking

---

#### `PATCH /api/v1/bookings/:id/cancel` — API key

Customer cancels their own booking.

Logic:
1. Find booking: `{ _id: id, tenantId: req.tenant._id }`
2. If not found → 404 `NOT_FOUND`
3. If already `cancelled` → 400 `BOOKING_ALREADY_CANCELLED`
4. Set `status: 'cancelled'`
5. Send cancellation email to `booking.customer.email`
6. Return updated booking

---

### Bookings — Dashboard (JWT)

#### `GET /api/v1/bookings` — JWT

Query params (all optional):
- `status` — filter by `pending` | `confirmed` | `cancelled`
- `date` — filter by exact date string `YYYY-MM-DD`
- `appointmentTypeId` — filter by type

Always filter by `tenantId: req.tenant._id`.
Sort by `createdAt` descending.

Return array of bookings.

---

#### `GET /api/v1/bookings/:id` — JWT

Find by `{ _id: id, tenantId: req.tenant._id }`.
Populate `appointmentTypeId` (name field only).
→ 404 if not found.

---

#### `PATCH /api/v1/bookings/:id/confirm` — JWT

Logic:
1. Find by `{ _id: id, tenantId: req.tenant._id }` → 404 if not found
2. If `status !== 'pending'` → 400 `BOOKING_NOT_PENDING`
3. Set `status: 'confirmed'`
4. Send confirmation email to `booking.customer.email`
5. Return updated booking

---

#### `PATCH /api/v1/bookings/:id/cancel` — JWT (admin version)

Same as customer cancel but:
- Auth is JWT not API key
- No ownership check on customer — tenant can cancel any of their bookings

Logic:
1. Find by `{ _id: id, tenantId: req.tenant._id }` → 404 if not found
2. If already `cancelled` → 400 `BOOKING_ALREADY_CANCELLED`
3. Set `status: 'cancelled'`
4. Send cancellation email to `booking.customer.email`
5. Return updated booking

---

## Email Service (`src/services/emailService.js`)

Use Nodemailer with Gmail transport:
```
host: smtp.gmail.com
port: 587
secure: false
auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }
```

Export two functions:

### `sendConfirmationEmail(booking, appointmentTypeName)`
Subject: `Your appointment is confirmed`
Body (plain text at minimum):
```
Hi [customer.name],

Your appointment has been confirmed.

Details:
- Service: [appointmentTypeName]
- Date: [booking.date]
- Time: [booking.time]

See you soon!
```

### `sendCancellationEmail(booking, appointmentTypeName)`
Subject: `Your appointment has been cancelled`
Body:
```
Hi [customer.name],

Your appointment on [booking.date] at [booking.time] has been cancelled.

If you have questions, please contact us.
```

Both functions accept the full booking document. Fetch the `appointmentTypeName`
in the controller before calling these functions.

**Email errors must NOT crash the server.** Wrap all `transporter.sendMail()`
calls in try/catch. Log the error but still return success to the client —
the booking status was already updated.

---

## `scripts/createTenant.js`

Run with: `node scripts/createTenant.js`

The script:
1. Loads `.env` with `dotenv`
2. Connects to MongoDB
3. Accepts input via `readline` (or hardcoded object for simplicity):
   - `name` — business name
   - `email` — login email
   - `password` — plain text, will be hashed
4. Hashes password with `bcryptjs` (rounds: 12)
5. Generates API key with `nanoid` (length: 32)
6. Creates the Tenant document with default values:
   - `workingDays: ['Mon','Tue','Wed','Thu','Fri']`
   - `workingHours: { start: '09:00', end: '18:00' }`
   - `blockedTimes: []`
7. Prints to console:
```
✅ Tenant created successfully
Name:    Blue Ocean Diving
Email:   admin@blueocean.com
API Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
8. Disconnects and exits

---

## `src/app.js`

```
- import express
- import cors
- Apply cors() — allow all origins for now
- Apply express.json()
- Mount routes:
    /api/v1/auth           → auth router
    /api/v1/tenants        → tenants router
    /api/v1/appointment-types → appointmentTypes router
    /api/v1/bookings       → bookings router
- Mount global errorHandler last
- export app
```

---

## `server.js`

```
- import app
- import connectDB from config/db.js
- import env from config/env.js (validates on import)
- connectDB()
- app.listen(PORT)
- Log: "Server running on port X"
```

---

## `src/config/db.js`

```
- mongoose.connect(MONGODB_URL)
- Log success or throw on failure
```

---

## package.json requirements

```json
{
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "bcryptjs": "latest",
    "cors": "latest",
    "dotenv": "latest",
    "express": "latest",
    "jsonwebtoken": "latest",
    "mongoose": "latest",
    "nanoid": "latest",
    "nodemailer": "latest",
    "zod": "latest"
  }
}
```

No TypeScript. No build step. Run directly with Node.js.

---

## Security Rules (enforce in every file)

1. `passwordHash` — field has `select: false` in schema. Use `.select('+passwordHash')`
   only in the login controller. Everywhere else it is invisible.
2. `tenantId` — every DB query on AppointmentType and Booking includes
   `{ tenantId: req.tenant._id }`. Never fetch then check — scope at query level.
3. API key — treat like a password. Never log it.
4. JWT secret — minimum 32 chars. Never hardcode. Always from env.

---

## What Is Out of Scope (do not build)

- No frontend code
- No payments
- No staff or resource management
- No public tenant signup endpoint
- No analytics
- No rate limiting (Phase 2)
- No refresh tokens (single JWT, 7-day expiry is sufficient)
