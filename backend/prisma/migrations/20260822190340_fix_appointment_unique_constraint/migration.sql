-- DropIndex
DROP INDEX "Appointment_doctorId_startTime_status_key";

-- Create partial unique index to prevent double bookings
CREATE UNIQUE INDEX "appointment_booked_unique" ON "Appointment"("doctorId", "startTime") WHERE status = 'BOOKED';

