# API Documentation

All endpoints require authentication (JWT) except for registration, login, and OAuth callbacks. Standard response format is JSON.

## Authentication Routes
- `POST /api/auth/register`: Register a new user (Patient, Doctor, Admin).
- `POST /api/auth/login`: Authenticate and receive a JWT token.
- `GET /api/auth/google/url`: (Doctors only) Get the Google OAuth URL for Calendar integration.
- `GET /api/auth/google/callback`: OAuth callback endpoint.

## Admin Routes
*Require `ADMIN` role.*
- `POST /api/admin/leaves`: Create a leave for a doctor and automatically cancel overlapping bookings.
- `POST /api/admin/doctors`: Create a new doctor profile.
- `PUT /api/admin/doctors/:id`: Update a doctor profile.
- `DELETE /api/admin/doctors/:id`: Delete a doctor profile.

## Doctor Routes
*Require `DOCTOR` role for specific actions.*
- `GET /api/doctors`: Get a list of all doctors.
- `GET /api/doctors/:id/slots`: Get available time slots for a specific doctor.
- `GET /api/appointments/doctor`: Get all appointments for the authenticated doctor.
- `POST /api/appointments/:id/post-visit`: Submit post-visit notes (triggers LLM patient-friendly summary generation).
- `POST /api/appointments/:id/prescriptions`: Add a prescription to an appointment.

## Patient Routes
*Require `PATIENT` role for specific actions.*
- `GET /api/appointments`: Get all appointments for the authenticated patient.
- `POST /api/appointments/hold`: Request a temporary 10-minute hold on a specific slot. Returns a `holdToken`.
- `DELETE /api/appointments/hold`: Release a held slot early.
- `POST /api/appointments/book`: Finalize booking using the `holdToken` and patient symptoms. (Triggers LLM pre-visit summary generation).

## Shared Routes (Patient & Doctor)
- `GET /api/appointments/:id`: Get detailed information about a specific appointment.
- `POST /api/appointments/:id/reschedule`: Reschedule an existing appointment.
- `DELETE /api/appointments/:id/cancel`: Cancel an appointment.
