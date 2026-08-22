# Healthcare Appointment & Follow-up Manager - Architecture Design

## 1. System Overview

The Healthcare Appointment & Follow-up Manager is a robust platform designed to bridge the communication gap between patients and doctors. It utilizes a three-tier architecture:
- **Frontend (Client)**: A web application (e.g., React/Next.js) serving portals for Patients, Doctors, and Admins.
- **Backend API**: A Node.js/Express (or similar) server providing RESTful APIs, handling authentication, business logic, and scheduling.
- **Database**: A relational database (PostgreSQL) for transactional integrity, alongside an in-memory datastore (Redis) for caching, rate-limiting, and temporary slot holds.
- **Background Workers**: A job queue system (e.g., BullMQ) to handle asynchronous tasks like LLM generation, emails, calendar syncing, and medication reminders.

## 2. Core Problem-Solving Approach

### 2.1 Double-Booking Prevention & Slot Hold Mechanism
Preventing double-booking requires handling concurrent requests safely.
- **Slot Hold Mechanism (Redis)**: When a patient selects a time slot and begins filling out the symptom form, the backend creates a temporary lock in Redis (e.g., `SET slot_hold:{doctor_id}:{start_time} patient_id EX 600 NX`). The `NX` flag ensures atomic locking. The slot is held for 10 minutes. 
- **Database Constraints**: The PostgreSQL database will enforce a `UNIQUE` constraint on `(doctor_id, start_time)` for appointments with a `BOOKED` status.
- **Transaction (Pessimistic Locking)**: Upon final confirmation, a database transaction validates that the hold belongs to the user, inserts the appointment, and deletes the Redis hold. If two users bypass the hold somehow, the DB unique constraint prevents the double booking.

### 2.2 Doctor Leave Conflict Handling
When an Admin marks a doctor on leave, existing appointments must be handled gracefully.
- **Transactional Update**: The backend inserts the leave record into the `Leaves` table. In the same transaction, it queries all `BOOKED` appointments for that doctor on the specified date and updates their status to `CANCELLED`.
- **Asynchronous Notifications**: The transaction commits, and a message is pushed to the background queue (e.g., `cancellation-queue`) with the list of affected appointment IDs.
- **Worker Execution**: The worker processes these IDs, sending cancellation emails to the patients and triggering Google Calendar API calls to remove the events. This prevents the request from timing out on the Admin's end.

### 2.3 Notification Reliability and Failure Handling
Emails and Calendar API calls are prone to network failures and rate limits.
- **Message Broker**: All external communications are dispatched to a queue (e.g., RabbitMQ or Redis/BullMQ).
- **Retry Mechanism & Backoff**: Jobs are configured with an exponential backoff strategy (e.g., retrying after 1 min, 5 mins, 15 mins) to handle transient failures from SendGrid or Google APIs.
- **Dead Letter Queue (DLQ)**: If a job exhausts its retries, it is moved to a DLQ. Admins can monitor the DLQ and manually intervene or trigger a replay, ensuring no notification is silently lost.
- **Idempotency**: API integrations will utilize idempotency keys (if supported) or check internal state to ensure a retry doesn't result in duplicate emails or calendar events.

### 2.4 LLM Integration & Failure Handling
Integrating LLMs (like OpenAI) requires handling latency, context limits, and downtimes.
- **Asynchronous Processing**: The patient books the appointment successfully *without* waiting for the LLM. The symptom text is saved, and a `generate-pre-visit-summary` job is queued.
- **Graceful Degradation**: If the LLM service is down, the system does not break. The doctor will see the raw symptoms instead of the summary until the background job successfully processes the retry.
- **Prompt Engineering (JSON output)**: 
  - *Pre-visit Prompt*: We will enforce structured output to easily parse the urgency level, complaint, and questions.
  - *Post-visit Prompt*: Focused on generating accessible, non-jargon text for the patient with explicit medication bullet points.

## 3. Database Schema Design

Using a relational database (PostgreSQL) is ideal for managing relationships and transactions.

**Users Table (Role-based Auth)**
- `id` (UUID, PK)
- `email` (String, Unique)
- `password_hash` (String)
- `role` (Enum: PATIENT, DOCTOR, ADMIN)
- `name` (String)

**Doctors Table**
- `user_id` (UUID, PK, FK -> Users.id)
- `specialization` (String)
- `working_hours` (JSONB, e.g., `{"mon": ["09:00-17:00"]}`)
- `slot_duration_mins` (Integer)

**Leaves Table**
- `id` (UUID, PK)
- `doctor_id` (UUID, FK -> Doctors.user_id)
- `leave_date` (Date)

**Appointments Table**
- `id` (UUID, PK)
- `patient_id` (UUID, FK -> Users.id)
- `doctor_id` (UUID, FK -> Doctors.user_id)
- `start_time` (Timestampz)
- `end_time` (Timestampz)
- `status` (Enum: PENDING, BOOKED, COMPLETED, CANCELLED)
- `symptoms_raw` (Text)
- `pre_visit_summary` (JSONB - urgency, complaint, questions)
- `post_visit_notes_raw` (Text)
- `post_visit_summary_patient` (Text)
- `gcal_event_id` (String)
- *Constraint: Unique(doctor_id, start_time) where status = 'BOOKED'*

**Prescriptions Table (For Medication Reminders)**
- `id` (UUID, PK)
- `appointment_id` (UUID, FK -> Appointments.id)
- `medication_name` (String)
- `frequency` (Enum: DAILY, TWICE_DAILY, etc.)
- `start_date` (Date)
- `end_date` (Date)

## 4. API Design and Code Structure

**Authentication & Onboarding**
- `POST /api/auth/register` (Patient registration)
- `POST /api/auth/login` (Returns JWT)
- `POST /api/admin/doctors` (Admin creates doctor profile)

**Appointment Booking Flow**
- `GET /api/doctors?specialization=xyz`
- `GET /api/doctors/:id/slots?date=YYYY-MM-DD` (Calculates slots based on `working_hours`, minus `Leaves`, minus `Appointments`, minus Redis holds)
- `POST /api/appointments/hold` (Body: `doctor_id`, `start_time`. Returns `hold_token`)
- `POST /api/appointments/book` (Body: `hold_token`, `symptoms`. Confirms booking, queues email/gcal/LLM jobs)

**Doctor & Admin Management**
- `POST /api/appointments/:id/post-visit` (Doctor submits notes. Queues LLM summary generation)
- `POST /api/admin/leaves` (Admin marks doctor on leave. Triggers conflict resolution)

**Code Structure (Modular/Layered approach)**
```text
src/
├── controllers/      # Handles HTTP requests/responses
├── services/         # Core business logic (e.g., AppointmentService)
├── repositories/     # Database queries and access
├── workers/          # Background job processors (LLM, Email, Reminders)
├── middlewares/      # Auth & role checking
└── config/           # DB, Redis, and 3rd-party integrations
```

## 5. Background Jobs & Third-Party Integrations

### 5.1 Medication Reminders
A cron-like worker (e.g., node-cron or a recurring BullMQ job) runs hourly to check the `Prescriptions` table. It matches the `frequency` against the current time and active dates, generating notification events that are pushed to the email queue.

### 5.2 Google Calendar Integration
- **OAuth 2.0**: The system acts as an OAuth client. Upon booking, the backend uses a Service Account (or user-delegated tokens) to create a Google Calendar event.
- **Attendees**: The event includes both the doctor and patient emails as attendees, ensuring it syncs to both their personal calendars.
- **Updates/Deletes**: Rescheduling or cancellations trigger calendar updates via the saved `gcal_event_id`.

### 5.3 Email Service Integration
Integration with providers like SendGrid or Nodemailer. Templates will be used for:
1. Booking Confirmations (containing GCal invites).
2. Pre-visit reminders (24 hours before).
3. Cancellation notices (due to doctor leave).
4. Medication reminders.
5. Post-visit summary availability alerts.
