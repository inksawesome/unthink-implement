# System Design Write-Up

This document outlines the core system design decisions for the Healthcare Appointment Manager, focusing specifically on ensuring data consistency, preventing scheduling conflicts, and maintaining reliable background processing for notifications and AI summaries.

## 1. Slot Hold Mechanism & Double-Booking Prevention

One of the most critical challenges in a scheduling system is preventing two patients from booking the exact same slot simultaneously. We address this using a two-phased approach: a temporary "Slot Hold" via Redis, and a transactional database lock during final booking.

### Temporary Slot Hold (Redis)
When a patient selects a slot, they initiate a "hold" before filling out their symptoms.
- We use Redis `SET` with the `NX` (Not eXists) flag and an `EX` (Expire) time of 10 minutes (600 seconds).
- The key is formatted as `slot_hold:<doctorId>:<startTime>`.
- The `NX` flag ensures that if two users click the same slot at the exact same millisecond, only one Redis command will succeed. The other will receive an error indicating the slot is currently held.
- The user is returned a `holdToken` which must be provided in the final booking step.

### Final Booking Confirmation
Once the user submits their symptoms, the booking request is processed:
- The system verifies that the Redis hold exists and the `holdToken` matches.
- A PostgreSQL transaction (`prisma.$transaction`) is initiated to create the `Appointment` record.
- Because of PostgreSQL constraints and the fact that we can do custom SQL constraints (or rely on Prisma's logic within the transaction), we ensure no overlapping `BOOKED` appointments exist for that doctor at that time.
- After a successful transaction, the Redis hold is immediately deleted to free up the system, and background jobs are dispatched.

## 2. Doctor Leave Conflict Handling

Doctors may have sudden emergencies or planned leaves. When an admin creates a leave for a doctor for a specific date, the system must automatically handle existing bookings.

### Leave Creation Workflow
1. The admin submits a leave request for a specific doctor and date.
2. The system initiates a database transaction.
3. The `Leave` record is created.
4. The system queries for all appointments belonging to that doctor where the `startTime` falls within the leave date and the status is `BOOKED`.
5. These overlapping appointments are updated to `CANCELLED` status in the same transaction.

### Automated Notifications & Calendar Cleanup
Once the transaction commits successfully, the system immediately enqueues background jobs for every cancelled appointment:
- **Email Notifications**: Added to the `email` queue to inform the patient of the cancellation due to doctor leave, asking them to re-book.
- **Calendar Deletion**: Added to the `calendar` queue to remove the event from the doctor's Google Calendar.

## 3. Notification & Background Job Reliability

Relying on synchronous external API calls (Email, Google Calendar, LLM generation) during HTTP requests is an anti-pattern as it leads to high latency and risks failing the user request if the third-party service is down.

### Queue Architecture (BullMQ + Redis)
We utilize BullMQ backed by Redis to manage all external interactions asynchronously. The queues are segmented by domain: `email`, `calendar`, and `llm`.

### Failure Handling & Retries
- **Exponential Backoff**: Jobs are configured with retry strategies. For example, LLM generation jobs and Email jobs are set to retry 3-5 times with an exponential backoff (e.g., `{ attempts: 3, backoff: { type: 'exponential', delay: 2000 } }`).
- **Idempotency**: External calls are designed to be idempotent where possible. For instance, updating a Google Calendar event uses the specific `gcalEventId`.
- **Dead Letter Queue (DLQ)**: If a job exhausts all its retries, BullMQ automatically moves it to a `failed` state (acting as a DLQ). Administrators can inspect the Redis failed jobs list to manually retry or investigate system-wide outages without losing the notification payload.
- **Graceful LLM Degradation**: If the `llmQueue` fails to generate a pre-visit or post-visit summary after all retries, the appointment record remains intact. The system gracefully continues functioning, and the summaries are simply marked as unavailable or pending until manually regenerated.

## Conclusion

This architecture ensures a robust, conflict-free scheduling experience. Redis provides the speed and atomicity required for the slot hold mechanism, while PostgreSQL transactions guarantee data integrity for leaves and bookings. BullMQ decouples fragile third-party network calls, providing resilience, automatic retries, and a responsive frontend.
