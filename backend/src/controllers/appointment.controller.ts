import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma';
import { redisClient } from '../config/redis';
import crypto from 'crypto';
import { addMinutes, parseISO } from 'date-fns';
import { emailQueue, calendarQueue, llmQueue } from '../workers/queue';

const HoldSlotSchema = z.object({
  doctorId: z.string().uuid(),
  startTime: z.string().datetime(), // ISO datetime string
});

const ReleaseHoldSchema = z.object({
  doctorId: z.string().uuid(),
  startTime: z.string().datetime(),
  holdToken: z.string().uuid(),
});

const BookAppointmentSchema = z.object({
  doctorId: z.string().uuid(),
  startTime: z.string().datetime(),
  holdToken: z.string().uuid(),
  symptomsRaw: z.string().min(10, 'Please provide more detail about your symptoms.'),
});

export const holdSlot = async (req: Request, res: Response): Promise<void> => {
  try {
    const patientId = req.user?.id;
    if (!patientId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const validationResult = HoldSlotSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({ error: validationResult.error.issues[0].message });
      return;
    }

    const { doctorId, startTime } = validationResult.data;

    // Check if the doctor exists
    const doctor = await prisma.doctor.findUnique({ where: { userId: doctorId } });
    if (!doctor) {
      res.status(404).json({ error: 'Doctor not found' });
      return;
    }

    // Try to hold the slot in Redis (10 minutes = 600 seconds)
    const holdKey = `slot_hold:${doctorId}:${startTime}`;
    const holdToken = crypto.randomUUID();
    const holdData = JSON.stringify({ patientId, holdToken });

    // SET NX ensures we only set it if it doesn't exist
    const setRes = await redisClient.set(holdKey, holdData, 'EX', 600, 'NX');

    if (!setRes) {
      res.status(409).json({ error: 'Slot is already held or booked by someone else' });
      return;
    }

    res.json({ holdToken, message: 'Slot held for 10 minutes' });
  } catch (error) {
    console.error('Error holding slot:', error);
    res.status(500).json({ error: 'Failed to hold slot' });
  }
};

export const releaseHold = async (req: Request, res: Response): Promise<void> => {
  try {
    const patientId = req.user?.id;
    if (!patientId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const validationResult = ReleaseHoldSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({ error: validationResult.error.issues[0].message });
      return;
    }

    const { doctorId, startTime, holdToken } = validationResult.data;
    const holdKey = `slot_hold:${doctorId}:${startTime}`;

    const holdDataStr = await redisClient.get(holdKey);
    if (holdDataStr) {
      const holdData = JSON.parse(holdDataStr);
      if (holdData.patientId === patientId && holdData.holdToken === holdToken) {
        await redisClient.del(holdKey);
      }
    }

    // Always return success even if hold didn't exist or belonged to someone else
    res.json({ success: true, message: 'Hold released if it was valid' });
  } catch (error) {
    console.error('Error releasing hold:', error);
    res.status(500).json({ error: 'Failed to release hold' });
  }
};

export const bookAppointment = async (req: Request, res: Response): Promise<void> => {
  try {
    const patientId = req.user?.id;
    if (!patientId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const validationResult = BookAppointmentSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({ error: validationResult.error.issues[0].message });
      return;
    }

    const { doctorId, startTime, holdToken, symptomsRaw } = validationResult.data;
    const holdKey = `slot_hold:${doctorId}:${startTime}`;

    // 1. Verify Hold
    const holdDataStr = await redisClient.get(holdKey);
    if (!holdDataStr) {
      res.status(400).json({ error: 'Hold expired or invalid' });
      return;
    }

    const holdData = JSON.parse(holdDataStr);
    if (holdData.patientId !== patientId || holdData.holdToken !== holdToken) {
      res.status(403).json({ error: 'Invalid hold token or owner' });
      return;
    }

    // 2. Fetch Doctor and Patient for emails and slot duration
    const doctor = await prisma.doctor.findUnique({ 
      where: { userId: doctorId },
      include: { user: true }
    });
    const patient = await prisma.user.findUnique({ where: { id: patientId } });
    
    if (!doctor || !patient) {
      res.status(404).json({ error: 'Doctor or Patient not found' });
      return;
    }

    const startDateTime = parseISO(startTime);
    const endDateTime = addMinutes(startDateTime, doctor.slotDurationMins);

    // 3. Database Transaction
    const appointment = await prisma.$transaction(async (tx) => {
      // Create appointment. The UNIQUE constraint will prevent double-booking at DB level.
      const newAppt = await tx.appointment.create({
        data: {
          patientId,
          doctorId: doctor.id,
          startTime: startDateTime,
          endTime: endDateTime,
          status: 'BOOKED',
          symptomsRaw,
        },
      });

      // We can optionally delete the redis key inside or after transaction
      return newAppt;
    });

    // 4. Clean up Redis hold since booking was successful
    await redisClient.del(holdKey);

    // 5. Enqueue background jobs
    await llmQueue.add('generate-pre-visit', { 
        appointmentId: appointment.id, 
        symptoms: symptomsRaw 
    }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });

    await emailQueue.add('send-confirmation', { 
        to: patient.email, 
        subject: 'Appointment Confirmed', 
        body: `Your appointment is confirmed for ${appointment.startTime}` 
    }, { attempts: 5, backoff: { type: 'exponential', delay: 5000 } });

    await calendarQueue.add('create-gcal-event', {
        appointmentId: appointment.id,
        doctorEmail: doctor.user.email,
        patientEmail: patient.email,
        startTime: appointment.startTime,
        endTime: appointment.endTime
    }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });

    res.json({ appointment, message: 'Appointment booked successfully' });
  } catch (error: any) {
    console.error('Error booking appointment:', error);
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'This slot is already booked.' });
    } else {
      res.status(500).json({ error: 'Failed to book appointment' });
    }
  }
};
