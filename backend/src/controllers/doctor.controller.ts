import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma';
import { redisClient } from '../config/redis';
import { addMinutes, isBefore, isAfter, parse, format, parseISO, startOfDay, endOfDay } from 'date-fns';

const GetSlotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Expected YYYY-MM-DD'),
});

export const getSlots = async (req: Request, res: Response): Promise<void> => {
  try {
    const doctorId = req.params.id as string;
    const validationResult = GetSlotsQuerySchema.safeParse(req.query);

    if (!validationResult.success) {
      res.status(400).json({ error: validationResult.error.issues[0].message });
      return;
    }

    const { date } = validationResult.data;
    const requestDate = parseISO(date); // YYYY-MM-DD parsed into local time/UTC at midnight
    const dayOfWeek = format(requestDate, 'eee').toLowerCase(); // 'mon', 'tue', etc.

    // 1. Fetch Doctor
    const doctor = await prisma.doctor.findUnique({
      where: { userId: doctorId },
    });

    if (!doctor) {
      res.status(404).json({ error: 'Doctor not found' });
      return;
    }

    // 2. Check for Leaves
    const leave = await prisma.leave.findFirst({
      where: {
        doctorId: doctor.id,
        leaveDate: {
          gte: startOfDay(requestDate),
          lte: endOfDay(requestDate)
        },
      },
    });

    if (leave) {
      res.json({ slots: [] }); // Doctor is on leave for the entire day
      return;
    }

    // 3. Fetch existing booked/completed appointments
    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId: doctor.id,
        status: { in: ['BOOKED', 'COMPLETED'] },
        startTime: {
          gte: startOfDay(requestDate),
          lte: endOfDay(requestDate),
        },
      },
    });

    const existingAppointmentTimes = new Set(
      appointments.map(app => app.startTime.toISOString())
    );

    // 4. Determine Working Hours
    const workingHours = doctor.workingHours as Record<string, string[]>;
    const todaysHours = workingHours[dayOfWeek];

    if (!todaysHours || todaysHours.length === 0) {
      res.json({ slots: [] }); // Doctor does not work on this day
      return;
    }

    // 5. Generate all possible slots
    const allSlots: string[] = [];
    for (const period of todaysHours) {
      const [startStr, endStr] = period.split('-');
      let currentSlot = parse(startStr, 'HH:mm', requestDate);
      const periodEnd = parse(endStr, 'HH:mm', requestDate);

      while (isBefore(currentSlot, periodEnd)) {
        allSlots.push(currentSlot.toISOString());
        currentSlot = addMinutes(currentSlot, doctor.slotDurationMins);
      }
    }

    // 6. Filter slots
    const now = new Date();
    const availableSlots: string[] = [];

    for (const slotStr of allSlots) {
      const slotTime = new Date(slotStr);

      // Filter out past slots
      if (isBefore(slotTime, now)) {
        continue;
      }

      // Filter out DB appointments
      if (existingAppointmentTimes.has(slotTime.toISOString())) {
        continue;
      }

      // Filter out Redis holds
      const holdKey = `slot_hold:${doctorId}:${slotTime.toISOString()}`;
      const holdValue = await redisClient.get(holdKey);
      
      if (holdValue) {
        continue; // Slot is held by someone else
      }

      availableSlots.push(slotTime.toISOString());
    }

    res.json({ slots: availableSlots });
  } catch (error) {
    console.error('Error fetching slots:', error);
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
};

export const getAllDoctors = async (req: Request, res: Response): Promise<void> => {
  try {
    const { specialization } = req.query;
    const filter = specialization ? { specialization: specialization as string } : {};

    const doctors = await prisma.doctor.findMany({
      where: filter,
      include: {
        user: {
          select: { name: true, email: true }
        }
      }
    });

    res.json({ doctors });
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ error: 'Failed to fetch doctors' });
  }
};
