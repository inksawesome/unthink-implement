import 'dotenv/config';
import prisma from './src/db/prisma';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { addDays, format, startOfDay } from 'date-fns';

const API_URL = 'http://localhost:4000/api';

async function main() {
  console.log('--- Starting Phase 6 Verification Test ---');

  // 1. Seed Data
  console.log('\n[1] Seeding Test Data...');
  const passwordHash = await bcrypt.hash('password123', 10);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: { passwordHash, role: 'ADMIN' },
    create: { email: 'admin@test.com', name: 'Test Admin', passwordHash, role: 'ADMIN' },
  });

  const patient = await prisma.user.upsert({
    where: { email: 'patient@test.com' },
    update: { passwordHash, role: 'PATIENT' },
    create: { email: 'patient@test.com', name: 'Test Patient', passwordHash, role: 'PATIENT' },
  });

  const doctorUser = await prisma.user.upsert({
    where: { email: 'doctor@test.com' },
    update: { passwordHash, role: 'DOCTOR' },
    create: { email: 'doctor@test.com', name: 'Test Doctor', passwordHash, role: 'DOCTOR' },
  });

  const doctor = await prisma.doctor.upsert({
    where: { userId: doctorUser.id },
    update: {},
    create: {
      userId: doctorUser.id,
      specialization: 'General',
      workingHours: { mon: ['09:00-17:00'], tue: ['09:00-17:00'], wed: ['09:00-17:00'], thu: ['09:00-17:00'], fri: ['09:00-17:00'] },
    },
  });

  // Clear related data for clean run
  await prisma.appointment.deleteMany({ where: { doctorId: doctor.id } });
  await prisma.leave.deleteMany({ where: { doctorId: doctor.id } });
  console.log('Data seeded successfully.');

  // 2. Login to get tokens
  console.log('\n[2] Logging in to get tokens...');
  const getAuthToken = async (email: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' })
    });
    const data = await res.json();
    return data.token;
  };

  const adminToken = await getAuthToken('admin@test.com');
  const patientToken = await getAuthToken('patient@test.com');
  const doctorToken = await getAuthToken('doctor@test.com');

  if (!adminToken || !patientToken || !doctorToken) {
    throw new Error('Failed to login and get tokens. Is the server running on port 4000?');
  }
  console.log('Tokens acquired.');

  // 3. Patient books two appointments (one for today, one for tomorrow)
  console.log('\n[3] Patient Booking Appointments...');
  const today = new Date();
  const tomorrow = addDays(today, 1);
  // Ensure time is 10:00 AM UTC to match working hours safely
  today.setUTCHours(10, 0, 0, 0);
  tomorrow.setUTCHours(10, 0, 0, 0);

  const bookAppointment = async (startTime: Date) => {
    // Hold slot
    const holdRes = await fetch(`${API_URL}/appointments/hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${patientToken}` },
      body: JSON.stringify({ doctorId: doctorUser.id, startTime: startTime.toISOString() })
    });
    const holdData = await holdRes.json();
    
    if (!holdRes.ok) throw new Error(`Hold failed: ${holdData.error}`);

    // Book slot
    const bookRes = await fetch(`${API_URL}/appointments/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${patientToken}` },
      body: JSON.stringify({
        doctorId: doctorUser.id,
        startTime: startTime.toISOString(),
        holdToken: holdData.holdToken,
        symptomsRaw: 'I have a terrible headache and fever.'
      })
    });
    const bookData = await bookRes.json();
    if (!bookRes.ok) throw new Error(`Book failed: ${bookData.error}`);
    return bookData.appointment;
  };

  const apptToday = await bookAppointment(today);
  const apptTomorrow = await bookAppointment(tomorrow);
  console.log('Booked appointments successfully:', apptToday.id, apptTomorrow.id);

  // 4. Doctor Submits Post-Visit Notes for Today's Appointment
  console.log('\n[4] Doctor Submitting Post-Visit Notes & Prescriptions...');
  const postVisitRes = await fetch(`${API_URL}/appointments/${apptToday.id}/post-visit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctorToken}` },
    body: JSON.stringify({ notes: 'Patient exhibits signs of viral infection. Prescribed rest and ibuprofen.' })
  });
  if (!postVisitRes.ok) throw new Error(`Post-visit notes failed: ${await postVisitRes.text()}`);
  console.log('Post-visit notes submitted.');

  const rxRes = await fetch(`${API_URL}/appointments/${apptToday.id}/prescriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctorToken}` },
    body: JSON.stringify({
      medicationName: 'Ibuprofen 400mg',
      frequency: 'TWICE_DAILY',
      startDate: format(today, 'yyyy-MM-dd'),
      endDate: format(addDays(today, 5), 'yyyy-MM-dd')
    })
  });
  if (!rxRes.ok) throw new Error(`Prescription failed: ${await rxRes.text()}`);
  console.log('Prescription added.');

  // 5. Admin marks doctor on leave for tomorrow
  console.log('\n[5] Admin creating leave for doctor...');
  const leaveRes = await fetch(`${API_URL}/admin/leaves`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({
      doctorId: doctorUser.id,
      leaveDate: format(tomorrow, 'yyyy-MM-dd')
    })
  });
  const leaveData = await leaveRes.json();
  if (!leaveRes.ok) throw new Error(`Leave failed: ${leaveData.error}`);
  console.log('Leave created. Cancelled appointments count:', leaveData.cancelledCount);

  if (leaveData.cancelledCount !== 1) {
    console.error('Expected 1 appointment to be cancelled, but got:', leaveData.cancelledCount);
  } else {
    console.log('Conflict resolution worked correctly!');
  }

  // 6. Verify statuses in DB
  console.log('\n[6] Verifying database states...');
  const checkApptToday = await prisma.appointment.findUnique({ where: { id: apptToday.id } });
  const checkApptTomorrow = await prisma.appointment.findUnique({ where: { id: apptTomorrow.id } });

  console.log(`Today's Appointment Status: ${checkApptToday?.status} (Expected: COMPLETED)`);
  console.log(`Tomorrow's Appointment Status: ${checkApptTomorrow?.status} (Expected: CANCELLED)`);
  
  if (checkApptToday?.postVisitNotesRaw) {
    console.log(`Post-Visit Notes found in DB successfully.`);
  }

  console.log('\n--- Test Complete ---');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
