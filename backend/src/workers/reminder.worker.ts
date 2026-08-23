import cron from 'node-cron';
import prisma from '../db/prisma';
import { emailQueue } from './queue';
import { startOfDay, endOfDay } from 'date-fns';

console.log('[ReminderWorker] Starting daily cron job (runs every day at 8:00 AM)');

// Run at 8:00 AM every day
cron.schedule('0 8 * * *', async () => {
  console.log('[ReminderWorker] Running daily prescription check...');
  try {
    const today = new Date();
    const start = startOfDay(today);
    const end = endOfDay(today);

    // Find prescriptions that are currently active (startDate <= today <= endDate)
    const activePrescriptions = await prisma.prescription.findMany({
      where: {
        startDate: { lte: end },
        endDate: { gte: start }
      },
      include: {
        appointment: {
          include: { patient: true }
        }
      }
    });

    console.log(`[ReminderWorker] Found ${activePrescriptions.length} active prescriptions.`);

    for (const rx of activePrescriptions) {
      await emailQueue.add('send-reminder', {
        to: rx.appointment.patient.email,
        subject: `Medication Reminder: ${rx.medicationName}`,
        body: `Hello ${rx.appointment.patient.name}, this is a reminder to take your medication: ${rx.medicationName}. Instructions: ${rx.frequency}.`
      });
    }
  } catch (error) {
    console.error('[ReminderWorker] Error running daily prescription check:', error);
  }
});
