import cron from 'node-cron';
import prisma from '../db/prisma';
import { emailQueue } from './queue';
import { buildEmailTemplate } from '../utils/emailTemplates';
import { startOfDay, endOfDay, addDays } from 'date-fns';

console.log('[ApptReminderWorker] Starting cron jobs for appointment reminders');

// Run at 9:00 AM every day
cron.schedule('0 9 * * *', async () => {
  console.log('[ApptReminderWorker] Running daily appointment reminder check...');
  
  try {
    const tomorrow = addDays(new Date(), 1);
    const start = startOfDay(tomorrow);
    const end = endOfDay(tomorrow);

    const upcomingAppointments = await prisma.appointment.findMany({
      where: {
        status: 'BOOKED',
        startTime: {
          gte: start,
          lte: end,
        }
      },
      include: {
        patient: true,
        doctor: {
          include: { user: true }
        }
      }
    });

    console.log(`[ApptReminderWorker] Found ${upcomingAppointments.length} appointments for tomorrow.`);

    for (const appt of upcomingAppointments) {
      const formattedTime = new Date(appt.startTime).toLocaleString();
      
      // Notify Patient
      const patientText = `Reminder: You have an appointment tomorrow at ${formattedTime} with Dr. ${appt.doctor.user.name}.`;
      const patientHtml = buildEmailTemplate(
        'Appointment Reminder',
        `This is a friendly reminder that you have an upcoming appointment tomorrow.`,
        { 'Date & Time': formattedTime, 'Doctor': appt.doctor.user.name }
      );
      
      await emailQueue.add('send-appt-reminder-patient', {
        to: appt.patient.email,
        subject: 'Reminder: Upcoming Appointment Tomorrow',
        body: patientText,
        html: patientHtml
      });

      // Notify Doctor
      const doctorText = `Reminder: You have an appointment tomorrow at ${formattedTime} with ${appt.patient.name}.`;
      const doctorHtml = buildEmailTemplate(
        'Appointment Reminder',
        `This is a friendly reminder that you have an upcoming appointment tomorrow.`,
        { 'Date & Time': formattedTime, 'Patient': appt.patient.name }
      );

      await emailQueue.add('send-appt-reminder-doctor', {
        to: appt.doctor.user.email,
        subject: 'Reminder: Upcoming Appointment Tomorrow',
        body: doctorText,
        html: doctorHtml
      });
    }
  } catch (error) {
    console.error('[ApptReminderWorker] Error running appointment reminder check:', error);
  }
});
