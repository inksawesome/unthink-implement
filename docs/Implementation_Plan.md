# Healthcare Appointment & Follow-up Manager - Implementation Plan

This document outlines a phased approach to implementing the system described in the Architecture Design.

## Phase 1: Project Initialization & Infrastructure Setup
**Goal:** Establish the foundation, repository structure, and external service accounts.
- [x] **Repository Setup:** Initialize a monorepo (e.g., using Turborepo) or separate folders for `frontend` and `backend`.
- [x] **Database & Cache:** Set up PostgreSQL and Redis (e.g., via Docker Compose for local development).
- [x] **Backend Framework:** Initialize Node.js/Express (or NestJS) with TypeScript.
- [x] **Frontend Framework:** Initialize Next.js with TailwindCSS.
- [x] **3rd-Party Credentials:** 
  - Set up OpenAI API key.
  - Set up SendGrid/Nodemailer credentials.
  - Set up Google Cloud Console project for Calendar API (OAuth 2.0 Client IDs).

## Phase 2: Database Schema & ORM Setup
**Goal:** Create the data layer to support core operations.
- [x] **ORM Configuration:** Install and configure an ORM (Prisma or TypeORM).
- [x] **Schema Definition:** 
  - Create models for `User`, `Doctor`, `Patient`, `Appointment`, `Leave`, and `Prescription`.
  - Add necessary indexes (e.g., on `doctor_id`, `start_time` for fast availability lookups).
  - Define the `UNIQUE` constraint on `Appointments(doctor_id, start_time)` where `status = 'BOOKED'`.
- [x] **Migrations:** Generate and run the initial database migration.
- [x] **Seeding:** Create a seed script with mock admin, doctors, and patients for testing.

## Phase 3: Authentication & Role Management
**Goal:** Secure the API and manage user roles (Patient, Doctor, Admin).
- [x] **User Registration & Login:** Implement `POST /api/auth/register` and `POST /api/auth/login`.
- [x] **JWT Implementation:** Set up token generation and validation.
- [x] **Role-Based Access Control (RBAC):** Create middleware (e.g., `requireRole('ADMIN')`) to protect sensitive routes.

## Phase 4: Core Booking Engine
**Goal:** Implement the logic to discover and hold slots without conflicts.
- [x] **Availability Calculation:** Implement `GET /api/doctors/:id/slots`. This logic must calculate total slots from doctor working hours and subtract existing `Leaves`, `Appointments`, and Redis active holds.
- [x] **Redis Slot Hold:** 
  - Implement `POST /api/appointments/hold`.
  - Use Redis `SET ... NX` to reserve the slot for 10 minutes. 
  - Return a `hold_token` to the client.
- [x] **Booking Confirmation:** 
  - Implement `POST /api/appointments/book`.
  - Verify the `hold_token`, insert the appointment into the database using a transaction, and delete the Redis hold.

## Phase 5: Message Queues & Third-Party Integrations
**Goal:** Offload slow and failure-prone tasks to background workers.
- [ ] **Queue Setup:** Initialize BullMQ (or similar) with Redis.
- [ ] **Email Worker:** 
  - Create job processors for booking confirmations and reminders.
  - Implement retry logic and exponential backoff.
- [ ] **Google Calendar Worker:** 
  - Implement the OAuth flow and token storage.
  - Create a worker to insert, update, or delete GCal events when appointment states change.
- [ ] **LLM Worker:** 
  - Create a job processor that takes `symptoms_raw`, calls the OpenAI API (with structured JSON output), and updates the DB with `pre_visit_summary`.
  - Handle LLM API rate-limits or failures gracefully.

## Phase 6: Conflict Management & Post-Visit Flows
**Goal:** Handle doctor leaves, cancellations, and doctor follow-up notes.
- [ ] **Doctor Leave Handling:**
  - Implement `POST /api/admin/leaves`.
  - Write transactional logic to cancel overlapping `BOOKED` appointments.
  - Enqueue jobs to notify affected patients and remove GCal events.
- [ ] **Post-Visit Notes:**
  - Implement `POST /api/appointments/:id/post-visit`.
  - Save doctor notes and trigger a background job to generate the patient-friendly summary via LLM.
- [ ] **Medication Reminders:**
  - Implement a daily cron job that scans the `Prescriptions` table and enqueues reminder emails for active medications.

## Phase 7: Frontend Portals (UI/UX)
**Goal:** Build out the user interfaces for the three distinct roles.
- [ ] **Patient Portal:** Doctor search, calendar view for slot selection, symptom form (with 10-minute timer UI), and dashboard to view past/upcoming visits and post-visit summaries.
- [ ] **Doctor Portal:** Daily schedule view, pre-visit summary display, post-visit notes input form, and prescription manager.
- [ ] **Admin Portal:** Doctor profile management, working hours configuration, and leave management UI.

## Phase 8: Testing, Polish & Documentation
**Goal:** Finalize the application for delivery.
- [ ] **Error Handling:** Ensure the API handles edge cases gracefully (e.g., expired holds, missing LLM responses) and returns standardized error responses.
- [ ] **Testing:** Write integration tests for the core booking flow and conflict resolution logic.
- [ ] **Documentation:** 
  - Write API documentation.
  - Provide a thorough `README.md` containing local setup steps, `.env.example`, and Google Calendar configuration guide.
- [ ] **Deployment:** Deploy the application (e.g., Frontend to Vercel, Backend to Render/Railway, Database to Supabase/Neon).
