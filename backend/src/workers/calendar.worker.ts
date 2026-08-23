import { Worker, Job } from 'bullmq';
import { redisClient } from '../config/redis';
import { google } from 'googleapis';
import prisma from '../db/prisma';

export const calendarWorker = new Worker('calendar', async (job: Job) => {
  const { appointmentId, doctorEmail, patientEmail, startTime, endTime, gcalEventId } = job.data;
  
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.warn('[CalendarWorker] GOOGLE_SERVICE_ACCOUNT_JSON not set. Skipping calendar event creation.');
    return;
  }

  try {
    let serviceAccountRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}';
    // If dotenv loaded \n as actual newlines, JSON.parse will fail. We need to escape them.
    serviceAccountRaw = serviceAccountRaw.replace(/\n/g, '\\n');
    
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(serviceAccountRaw),
      scopes: ['https://www.googleapis.com/auth/calendar.events'],
    });
    const calendar = google.calendar({ version: 'v3', auth });
    const calendarId = process.env.CLINIC_CALENDAR_ID || 'primary';

    if (job.name === 'create-gcal-event') {
      console.log(`[CalendarWorker] Creating event for appointment ${appointmentId}...`);
      const event = await calendar.events.insert({
        calendarId: calendarId,
        requestBody: {
          summary: `Medical Appointment - ${patientEmail}`,
          start: { dateTime: startTime },
          end: { dateTime: endTime }
        },
      });

      if (event.data.id) {
        await prisma.appointment.update({
          where: { id: appointmentId },
          data: { gcalEventId: event.data.id },
        });
        console.log(`[CalendarWorker] Created event ${event.data.id} and updated appointment.`);
      }
    } else if (job.name === 'delete-gcal-event' && gcalEventId) {
      console.log(`[CalendarWorker] Deleting event ${gcalEventId}...`);
      await calendar.events.delete({
        calendarId: calendarId,
        eventId: gcalEventId
      });
      console.log(`[CalendarWorker] Deleted event ${gcalEventId}.`);
    }
  } catch (err: any) {
    console.error(`[CalendarWorker] Error processing calendar job:`, err.message || err);
    throw err;
  }
}, { connection: redisClient });
