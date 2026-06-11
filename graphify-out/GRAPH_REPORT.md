# Graph Report - .  (2026-06-11)

## Corpus Check
- Corpus is ~11,743 words - fits in a single context window. You may not need a graph.

## Summary
- 138 nodes · 248 edges · 12 communities (11 shown, 1 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.88)
- Token cost: 21,300 input · 4,300 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Booking Controller & Notifications|Booking Controller & Notifications]]
- [[_COMMUNITY_App Config & Error Handling|App Config & Error Handling]]
- [[_COMMUNITY_Appointment Type Management|Appointment Type Management]]
- [[_COMMUNITY_Package Metadata|Package Metadata]]
- [[_COMMUNITY_Auth Middleware & Tenant Model|Auth Middleware & Tenant Model]]
- [[_COMMUNITY_Tenant Management|Tenant Management]]
- [[_COMMUNITY_Data Models & Availability|Data Models & Availability]]
- [[_COMMUNITY_NPM Dependencies|NPM Dependencies]]
- [[_COMMUNITY_Authentication Flow|Authentication Flow]]
- [[_COMMUNITY_API Test Collection|API Test Collection]]
- [[_COMMUNITY_Booking Docs & Concepts|Booking Docs & Concepts]]
- [[_COMMUNITY_Claude Settings|Claude Settings]]

## God Nodes (most connected - your core abstractions)
1. `computeAvailability()` - 11 edges
2. `checkSlotAvailability()` - 10 edges
3. `Booking Model` - 10 edges
4. `Tenant Model` - 7 edges
5. `Backend Specification` - 7 edges
6. `AppointmentType Model` - 6 edges
7. `info` - 5 edges
8. `confirmBooking()` - 5 edges
9. `cancelBooking()` - 5 edges
10. `jwtAuth()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Dual Auth Pattern (JWT + API Key)` --rationale_for--> `router`  [INFERRED]
  md/API.md → src/routes/appointmentTypes.js
- `EitherAuth — Cancel Accepts Both Credentials` --conceptually_related_to--> `Dual Auth Pattern (JWT + API Key)`  [INFERRED]
  src/routes/bookings.js → md/API.md
- `Dual Auth Pattern (JWT + API Key)` --rationale_for--> `router`  [INFERRED]
  md/API.md → src/routes/bookings.js
- `Fail-Fast Environment Validation` --semantically_similar_to--> `Production Build Verification Script`  [INFERRED] [semantically similar]
  src/config/env.js → scripts/verify-build.js
- `String Date/Time Storage Rationale` --rationale_for--> `Booking Model`  [EXTRACTED]
  md/backend-spec.md → src/models/Booking.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **JWT Authentication Flow** — controllers_authcontroller, middleware_jwtauth, config_env [INFERRED 0.95]
- **Tenant Request Context Injection Pattern** — middleware_apikeyauth, middleware_jwtauth, controllers_tenantcontroller [INFERRED 0.95]
- **Booking Creation and Notification Lifecycle** — controllers_bookingcontroller, services_availabilityservice, services_emailservice [EXTRACTED 1.00]
- **Live Availability Computation Flow** — services_availabilityservice_computeavailability, models_booking_booking, models_tenant_tenant, models_appointmenttype_appointmenttype [EXTRACTED 1.00]
- **Booking Creation Validation and Slot Check Pipeline** — routes_bookings_router, schemas_booking_schema_createbookingschema, services_availabilityservice_checkslotavailability [INFERRED 0.95]
- **Fire-and-Forget Email Notification System** — services_emailservice_sendconfirmationemail, services_emailservice_sendcancellationemail, concept_email_fire_and_forget, models_booking_booking [EXTRACTED 1.00]

## Communities (12 total, 1 thin omitted)

### Community 0 - "Booking Controller & Notifications"
Cohesion: 0.21
Nodes (13): Email Errors Must Not Crash Server, Query-Level Tenant Data Scoping, bookingNotFound(), cancelBooking(), confirmBooking(), createBooking(), getBooking(), getTypeName() (+5 more)

### Community 1 - "App Config & Error Handling"
Cohesion: 0.18
Nodes (8): Fail-Fast Environment Validation, connectDB(), envSchema, parsed, run(), verifyBuild(), Production Build Verification Script, app

### Community 2 - "Appointment Type Management"
Cohesion: 0.24
Nodes (11): createAppointmentType(), deleteAppointmentType(), getAvailability(), listAppointmentTypes(), notFound(), updateAppointmentType(), appointmentTypeSchema, router (+3 more)

### Community 3 - "Package Metadata"
Cohesion: 0.13
Nodes (14): author, description, devDependencies, nodemon, keywords, license, main, name (+6 more)

### Community 4 - "Auth Middleware & Tenant Model"
Cohesion: 0.24
Nodes (9): Dual Authentication Strategy (JWT + API Key), Multi-Tenant SaaS Architecture, apiKeyAuth(), jwtAuth(), blockedTimeSchema, tenantSchema, eitherAuth(), createBookingSchema (+1 more)

### Community 5 - "Tenant Management"
Cohesion: 0.26
Nodes (10): addBlockedTime(), getMe(), removeBlockedTime(), serializeTenant(), updateMe(), BlockedTime Subdocument Schema, router, blockedTimeSchema (+2 more)

### Community 6 - "Data Models & Availability"
Cohesion: 0.40
Nodes (12): Compound Index for Availability Queries, String Date/Time Storage Rationale, Backend Specification, AppointmentType Model, Booking Model, Tenant Model, checkSlotAvailability(), computeAvailability() (+4 more)

### Community 7 - "NPM Dependencies"
Cohesion: 0.20
Nodes (10): dependencies, bcryptjs, cors, dotenv, express, jsonwebtoken, mongoose, nanoid (+2 more)

### Community 8 - "Authentication Flow"
Cohesion: 0.36
Nodes (4): login(), validate(), router, loginSchema

### Community 9 - "API Test Collection"
Cohesion: 0.25
Nodes (7): info, description, name, _postman_id, schema, item, variable

### Community 10 - "Booking Docs & Concepts"
Cohesion: 0.33
Nodes (7): Booking Status State Machine, Dual Auth Pattern (JWT + API Key), EitherAuth — Cancel Accepts Both Credentials, Booking API Integration Guide, Frontend API Reference, Booking Widget Integration Reference, router

## Knowledge Gaps
- **42 isolated node(s):** `allow`, `name`, `version`, `description`, `main` (+37 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Dual Auth Pattern (JWT + API Key)` connect `Booking Docs & Concepts` to `Appointment Type Management`, `Data Models & Availability`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `computeAvailability()` connect `Data Models & Availability` to `Appointment Type Management`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **What connects `allow`, `name`, `version` to the rest of the system?**
  _42 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Package Metadata` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._