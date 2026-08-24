import { Request, Response } from 'express';
import { getSlots } from '../doctor.controller';
import { prismaMock } from '../../setupTests';
import { redisClient } from '../../config/redis';
import { addDays, format, startOfDay } from 'date-fns';

describe('Doctor Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockRequest = { params: {}, query: {} };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('getSlots', () => {
    it('should return 400 for invalid date', async () => {
      mockRequest.params = { id: 'doctor1' };
      mockRequest.query = { date: 'invalid-date' };
      await getSlots(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 if doctor not found', async () => {
      mockRequest.params = { id: 'doctor1' };
      // Request date tomorrow to avoid "past slot" filtering issues
      const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      mockRequest.query = { date: tomorrowStr };
      
      prismaMock.doctor.findUnique.mockResolvedValue(null);
      await getSlots(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should return empty array if doctor is on leave', async () => {
      const tomorrow = addDays(new Date(), 1);
      const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');
      mockRequest.params = { id: 'doctor1' };
      mockRequest.query = { date: tomorrowStr };
      
      prismaMock.doctor.findUnique.mockResolvedValue({ id: 'd1', userId: 'doctor1', specialization: 'test', workingHours: {}, slotDurationMins: 30, createdAt: new Date(), updatedAt: new Date(), googleRefreshToken: null });
      prismaMock.leave.findFirst.mockResolvedValue({ id: 'l1', doctorId: 'd1', leaveDate: tomorrow, createdAt: new Date() });
      
      await getSlots(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.json).toHaveBeenCalledWith({ slots: [] });
    });

    it('should generate slots correctly based on working hours', async () => {
      const tomorrow = addDays(new Date(), 1);
      const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');
      const dayOfWeek = format(tomorrow, 'eee').toLowerCase();

      mockRequest.params = { id: 'doctor1' };
      mockRequest.query = { date: tomorrowStr };
      
      prismaMock.doctor.findUnique.mockResolvedValue({ 
        id: 'd1', userId: 'doctor1', specialization: 'test', 
        workingHours: { [dayOfWeek]: ['09:00-10:00'] }, 
        slotDurationMins: 30, createdAt: new Date(), updatedAt: new Date(), googleRefreshToken: null 
      });
      prismaMock.leave.findFirst.mockResolvedValue(null);
      prismaMock.appointment.findMany.mockResolvedValue([]);
      
      await getSlots(mockRequest as Request, mockResponse as Response);
      
      // Should generate 09:00 and 09:30 slots
      expect(mockResponse.json).toHaveBeenCalled();
      const responseArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(responseArgs.slots.length).toBe(2);
    });

    it('should exclude slots that are booked in db or held in redis', async () => {
      const tomorrow = addDays(new Date(), 1);
      const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');
      const dayOfWeek = format(tomorrow, 'eee').toLowerCase();

      mockRequest.params = { id: 'doctor1' };
      mockRequest.query = { date: tomorrowStr };
      
      prismaMock.doctor.findUnique.mockResolvedValue({ 
        id: 'd1', userId: 'doctor1', specialization: 'test', 
        workingHours: { [dayOfWeek]: ['09:00-10:30'] }, // 3 slots: 09:00, 09:30, 10:00
        slotDurationMins: 30, createdAt: new Date(), updatedAt: new Date(), googleRefreshToken: null 
      });
      prismaMock.leave.findFirst.mockResolvedValue(null);
      
      // Mock db appointment at 09:00
      const bookedTime = new Date(startOfDay(tomorrow));
      bookedTime.setHours(9, 0, 0, 0);
      prismaMock.appointment.findMany.mockResolvedValue([
        { id: 'a1', patientId: 'p1', doctorId: 'd1', startTime: bookedTime, endTime: new Date(), status: 'BOOKED', createdAt: new Date(), updatedAt: new Date(), symptomsRaw: null, preVisitSummary: null, postVisitNotesRaw: null, postVisitSummaryPatient: null, gcalEventId: null }
      ]);

      // Mock redis hold at 10:00
      const heldTime = new Date(startOfDay(tomorrow));
      heldTime.setHours(10, 0, 0, 0);
      (redisClient.get as jest.Mock).mockImplementation((key: string) => {
        if (key.includes(heldTime.toISOString())) return 'held';
        return null;
      });
      
      await getSlots(mockRequest as Request, mockResponse as Response);
      
      // Only 09:30 should remain
      expect(mockResponse.json).toHaveBeenCalled();
      const responseArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(responseArgs.slots.length).toBe(1);
    });
  });
});
