import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma';
import { emailQueue, calendarQueue } from '../workers/queue';
import { startOfDay, endOfDay, parseISO } from 'date-fns';
import { hashPassword } from '../utils/auth.utils';

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

const CreateDoctorSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  specialization: z.string(),
  workingHours: z.any(),
  slotDurationMins: z.number().int().min(5).default(30)
});

export const createDoctor = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsedData = CreateDoctorSchema.safeParse(req.body);
    if (!parsedData.success) {
      res.status(400).json({ error: 'Validation failed', details: parsedData.error.issues });
      return;
    }

    const { email, password, name, specialization, workingHours, slotDurationMins } = parsedData.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ error: 'User with this email already exists' });
      return;
    }

    const hashedPassword = await hashPassword(password);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash: hashedPassword,
          name,
          role: 'DOCTOR'
        }
      });

      const doctor = await tx.doctor.create({
        data: {
          userId: user.id,
          specialization,
          workingHours,
          slotDurationMins
        }
      });

      return { user, doctor };
    });

    res.status(201).json({ message: 'Doctor profile created successfully', doctor: result.doctor });
  } catch (error) {
    console.error('Error creating doctor:', error);
    res.status(500).json({ error: 'Failed to create doctor' });
  }
};

const UpdateDoctorSchema = z.object({
  name: z.string().min(2).optional(),
  specialization: z.string().optional(),
  workingHours: z.any().optional(),
  slotDurationMins: z.number().int().min(5).optional()
});

export const updateDoctor = async (req: Request, res: Response): Promise<void> => {
  try {
    const doctorId = req.params.id; // This is the Doctor.id
    const parsedData = UpdateDoctorSchema.safeParse(req.body);
    if (!parsedData.success) {
      res.status(400).json({ error: 'Validation failed', details: parsedData.error.issues });
      return;
    }

    const { name, specialization, workingHours, slotDurationMins } = parsedData.data;

    const existingDoctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!existingDoctor) {
      res.status(404).json({ error: 'Doctor not found' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      let updatedUser = null;
      if (name) {
        updatedUser = await tx.user.update({
          where: { id: existingDoctor.userId },
          data: { name }
        });
      }

      const updatedDoctor = await tx.doctor.update({
        where: { id: doctorId },
        data: {
          specialization,
          workingHours,
          slotDurationMins
        }
      });

      return { updatedUser, updatedDoctor };
    });

    res.json({ message: 'Doctor profile updated successfully', doctor: result.updatedDoctor });
  } catch (error) {
    console.error('Error updating doctor:', error);
    res.status(500).json({ error: 'Failed to update doctor' });
  }
};

export const deleteDoctor = async (req: Request, res: Response): Promise<void> => {
  try {
    const doctorId = req.params.id;

    const existingDoctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      include: {
        _count: {
          select: { appointments: true }
        }
      }
    });

    if (!existingDoctor) {
      res.status(404).json({ error: 'Doctor not found' });
      return;
    }

    if (existingDoctor._count.appointments > 0) {
      res.status(400).json({ error: 'Cannot delete doctor with existing appointments to preserve medical records.' });
      return;
    }

    // Delete the user; cascading deletes the doctor profile and leaves
    await prisma.user.delete({
      where: { id: existingDoctor.userId }
    });

    res.json({ message: 'Doctor deleted successfully' });
  } catch (error) {
    console.error('Error deleting doctor:', error);
    res.status(500).json({ error: 'Failed to delete doctor' });
  }
};
