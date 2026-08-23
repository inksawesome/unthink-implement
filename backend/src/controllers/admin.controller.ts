import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma';
import { emailQueue, calendarQueue } from '../workers/queue';
import { startOfDay, endOfDay, parseISO } from 'date-fns';

const CreateLeaveSchema = z.object({
  doctorId: z.string().uuid(),
  leaveDate: z.string(), // YYYY-MM-DD
});

export const createLeave = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = CreateLeaveSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({ error: validationResult.error.issues[0].message });
      return;
    }

    const { doctorId, leaveDate } = validationResult.data;
    const dateStr = parseISO(leaveDate);
    const start = startOfDay(dateStr);
    const end = endOfDay(dateStr);

    const doctor = await prisma.doctor.findUnique({
      where: { userId: doctorId },
      include: { user: true }
    });

    if (!doctor) {
      res.status(404).json({ error: 'Doctor not found' });
      return;
    }

    // Begin Transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Insert Leave
      const newLeave = await tx.leave.create({
        data: {
          doctorId: doctor.id,
          leaveDate: start, // Assuming DB handles Date correctly
        },
      });

      // 2. Find overlapping BOOKED appointments
      const overlappingAppointments = await tx.appointment.findMany({
        where: {
          doctorId: doctor.id,
          status: 'BOOKED',
          startTime: {
            gte: start,
            lte: end,
          }
        },
        include: { patient: true }
      });

      // 3. Cancel them
      if (overlappingAppointments.length > 0) {
        await tx.appointment.updateMany({
          where: {
            id: { in: overlappingAppointments.map(a => a.id) }
          },
          data: {
            status: 'CANCELLED'
          }
        });
      }

      return { newLeave, overlappingAppointments };
    });

    // 4. Dispatch jobs to notify patients and delete events
    for (const appt of result.overlappingAppointments) {
      // Email
      await emailQueue.add('send-cancellation', {
        to: appt.patient.email,
        subject: 'Appointment Cancelled - Doctor on Leave',
        body: `We are sorry to inform you that your appointment on ${appt.startTime} has been cancelled because the doctor is on leave. Please book a new slot.`
      });

      // Calendar
      if (appt.gcalEventId) {
        await calendarQueue.add('delete-gcal-event', {
          gcalEventId: appt.gcalEventId,
          appointmentId: appt.id
        });
      }
    }

    res.json({
      message: 'Leave created and affected appointments cancelled',
      leave: result.newLeave,
      cancelledCount: result.overlappingAppointments.length
    });

  } catch (error: any) {
    console.error('Error creating leave:', error);
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Leave already exists for this date.' });
    } else {
      res.status(500).json({ error: 'Failed to create leave' });
    }
  }
};
