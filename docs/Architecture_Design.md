# Architecture Design

The Healthcare Appointment & Follow-up Manager is designed as a modern web application consisting of a decoupled frontend and backend, using a microservices-inspired queue architecture for background jobs.

## Tech Stack

- **Frontend**: Next.js, React, TailwindCSS. Communicates via REST APIs with the backend.
- **Backend API**: Node.js, Express, TypeScript. Handles routing, authentication, business logic, and API interactions.
- **Database**: PostgreSQL managed via Prisma ORM. Provides relational data modeling and transactional guarantees for bookings.
- **In-Memory Store / Queue**: Redis and BullMQ. Redis acts as a fast in-memory store for our temporary slot holds, while BullMQ orchestrates background job queues.
- **External Services**:
  - **OpenAI (LLM)**: Generates pre-visit and post-visit summaries.
  - **Google Calendar API**: Synchronizes bookings with doctors' calendars via OAuth 2.0.
  - **Nodemailer (SMTP)**: Handles all transactional emails (confirmations, cancellations, reschedules).

## System Components

1. **Client Portals**: 
   - Separate experiences for Patients, Doctors, and Administrators.
2. **Express API Gateway**: 
   - Serves as the main entry point, handles JWT authentication, and routes requests to corresponding controllers.
3. **Database Layer (Prisma + Postgres)**: 
   - Stores users, doctors, appointments, leaves, and prescriptions. Ensures referential integrity and handles complex transactional queries.
4. **Redis Cache / Locking**: 
   - Manages the temporary slot hold locks (`SET NX` with 10-minute expiry) to prevent double-booking at the frontend selection stage.
5. **Worker Nodes (BullMQ)**:
   - **Email Worker**: Consumes the `email` queue, communicating with the SMTP provider.
   - **Calendar Worker**: Consumes the `calendar` queue, communicating with Google APIs.
   - **LLM Worker**: Consumes the `llm` queue, communicating with the OpenAI API.

## Data Flow: Appointment Booking

1. **Slot Selection**: Patient clicks a slot. Frontend sends a `POST /api/appointments/hold`. Backend sets a Redis lock and returns a `holdToken`.
2. **Symptom Entry**: Patient fills symptoms and submits final booking.
3. **Transaction**: Backend verifies the `holdToken`, starts a Postgres transaction to insert the appointment, and verifies no conflicting bookings.
4. **Queue Dispatch**: Upon successful transaction commit, backend enqueues jobs to `email`, `calendar`, and `llm` queues.
5. **Background Processing**: Workers independently pick up jobs, interact with external APIs, and retry on failure with exponential backoff.
