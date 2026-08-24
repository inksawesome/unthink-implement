import { Worker, Job } from 'bullmq';
import { redisClient } from '../config/redis';
import { google } from 'googleapis';
import prisma from '../db/prisma';
import { getGoogleOAuthClient } from '../utils/googleAuth';

export const calendarWorker = new Worker('calendar', async (job: Job) => {
  const { appointmentId, patientEmail, startTime, endTime, gcalEventId } = job.data;
  
  if (!process.env.GOOGLE_CLIENT_ID) {
    console.warn('[CalendarWorker] GOOGLE_CLIENT_ID not set. Skipping calendar event processing.');
    return;
  }

  try {
    // 1. Fetch appointment & doctor info to get the refresh token
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { doctor: true }
    });

    const refreshToken = appointment?.doctor.googleRefreshToken;
    if (!refreshToken) {
      console.warn(`[CalendarWorker] No refresh token for doctor on appt ${appointmentId}. Skipping.`);
      return;
    }

    // 2. Initialize OAuth client
    const auth = getGoogleOAuthClient();
    auth.setCredentials({ refresh_token: refreshToken });
    const calendar = google.calendar({ version: 'v3', auth });

    if (job.name === 'create-gcal-event') {
      console.log(`[CalendarWorker] Creating event for appointment ${appointmentId}...`);
      const event = await calendar.events.insert({
        calendarId: 'primary',
        sendUpdates: 'all',
        requestBody: {
          summary: `Medical Appointment`,
          start: { dateTime: startTime },
          end: { dateTime: endTime },
          attendees: [{ email: patientEmail }]
        },
      });

      if (event.data.id) {
        await prisma.appointment.update({
          where: { id: appointmentId },
          data: { gcalEventId: event.data.id },
        });
        console.log(`[CalendarWorker] Created event ${event.data.id} and updated appointment.`);
      }
    } else if (job.name === 'update-gcal-event' && gcalEventId) {
      console.log(`[CalendarWorker] Updating event ${gcalEventId}...`);
      await calendar.events.update({
        calendarId: 'primary',
        eventId: gcalEventId,
        sendUpdates: 'all',
        requestBody: {
          summary: `Medical Appointment`,
          start: { dateTime: startTime },
          end: { dateTime: endTime },
          attendees: [{ email: patientEmail }]
        }
      });
      console.log(`[CalendarWorker] Updated event ${gcalEventId}.`);
    } else if (job.name === 'delete-gcal-event' && gcalEventId) {
      console.log(`[CalendarWorker] Deleting event ${gcalEventId}...`);
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: gcalEventId,
        sendUpdates: 'all'
      });
      console.log(`[CalendarWorker] Deleted event ${gcalEventId}.`);
    }
  } catch (err: any) {
    console.error(`[CalendarWorker] Error processing calendar job:`, err.message || err);
    throw err;
  }
}, { connection: redisClient });
