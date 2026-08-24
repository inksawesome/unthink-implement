import cron from 'node-cron';
import prisma from '../db/prisma';
import { emailQueue } from './queue';
import { buildEmailTemplate } from '../utils/emailTemplates';
import { startOfDay, endOfDay } from 'date-fns';

console.log('[ReminderWorker] Starting cron jobs for medication reminders');

// Run at 8:00 AM every day
cron.schedule('0 8 * * *', async () => {
  console.log('[ReminderWorker] Running morning (8:00 AM) prescription check...');
  await processReminders('MORNING');
});

// Run at 8:00 PM every day
cron.schedule('0 20 * * *', async () => {
  console.log('[ReminderWorker] Running evening (8:00 PM) prescription check...');
  await processReminders('EVENING');
});

async function processReminders(timeOfDay: 'MORNING' | 'EVENING') {
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

    console.log(`[ReminderWorker] Found ${activePrescriptions.length} active prescriptions. Processing for ${timeOfDay}...`);

    for (const rx of activePrescriptions) {
      let shouldSend = false;

      if (rx.frequency === 'AS_NEEDED') {
        continue;
      } else if (rx.frequency === 'TWICE_DAILY') {
        shouldSend = true; // Sent both morning and evening
      } else if (timeOfDay === 'MORNING') {
        // DAILY and WEEKLY only send in the morning
        if (rx.frequency === 'DAILY') {
          shouldSend = true;
        } else if (rx.frequency === 'WEEKLY') {
          // Check if today is the same day of the week as the start date
          if (today.getDay() === rx.startDate.getDay()) {
            shouldSend = true;
          }
        }
      }

      if (shouldSend) {
        const textBody = `Hello ${rx.appointment.patient.name}, this is your ${timeOfDay.toLowerCase()} reminder to take your medication: ${rx.medicationName}. Instructions: ${rx.frequency}.`;
        const htmlBody = buildEmailTemplate(
          `Medication Reminder: ${rx.medicationName}`,
          `Hello ${rx.appointment.patient.name}, this is your ${timeOfDay.toLowerCase()} reminder to take your medication.`,
          { 'Medication': rx.medicationName, 'Instructions': rx.frequency }
        );

        await emailQueue.add('send-reminder', {
          to: rx.appointment.patient.email,
          subject: `Medication Reminder: ${rx.medicationName}`,
          body: textBody,
          html: htmlBody
        });
        console.log(`[ReminderWorker] Queued ${timeOfDay} reminder for patient ${rx.appointment.patient.id}, medication: ${rx.medicationName}`);
      }
    }
  } catch (error) {
    console.error(`[ReminderWorker] Error running ${timeOfDay} prescription check:`, error);
  }
}
