import { Request, Response } from 'express';
import { holdSlot, releaseHold, bookAppointment } from '../appointment.controller';
import { prismaMock } from '../../setupTests';
import { redisClient } from '../../config/redis';

describe('Appointment Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockRequest = { user: { id: 'patient1', role: 'PATIENT' }, body: {} };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
    
    // Mock queue adds
    const { emailQueue, calendarQueue, llmQueue } = require('../../workers/queue');
    emailQueue.add = jest.fn().mockResolvedValue(true);
    calendarQueue.add = jest.fn().mockResolvedValue(true);
    llmQueue.add = jest.fn().mockResolvedValue(true);
  });

  describe('holdSlot', () => {
    it('should return 400 on invalid body', async () => {
      mockRequest.body = { doctorId: 'not-a-uuid' };
      await holdSlot(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 if doctor not found', async () => {
      mockRequest.body = { doctorId: '123e4567-e89b-12d3-a456-426614174000', startTime: new Date().toISOString() };
      prismaMock.doctor.findUnique.mockResolvedValue(null);
      await holdSlot(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should return 409 if slot is already held', async () => {
      mockRequest.body = { doctorId: '123e4567-e89b-12d3-a456-426614174000', startTime: new Date().toISOString() };
      prismaMock.doctor.findUnique.mockResolvedValue({ id: 'd1', userId: 'doc', specialization: '', workingHours: {}, slotDurationMins: 30, createdAt: new Date(), updatedAt: new Date(), googleRefreshToken: null });
      (redisClient.set as jest.Mock).mockResolvedValue(null); // 'NX' returns null if key exists
      
      await holdSlot(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(409);
    });

    it('should return hold token on success', async () => {
      mockRequest.body = { doctorId: '123e4567-e89b-12d3-a456-426614174000', startTime: new Date().toISOString() };
      prismaMock.doctor.findUnique.mockResolvedValue({ id: 'd1', userId: 'doc', specialization: '', workingHours: {}, slotDurationMins: 30, createdAt: new Date(), updatedAt: new Date(), googleRefreshToken: null });
      (redisClient.set as jest.Mock).mockResolvedValue('OK');
      
      await holdSlot(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ holdToken: expect.any(String) }));
    });
  });

  describe('releaseHold', () => {
    it('should release hold if token matches', async () => {
      mockRequest.body = { doctorId: '123e4567-e89b-12d3-a456-426614174000', startTime: new Date().toISOString(), holdToken: '123e4567-e89b-12d3-a456-426614174001' };
      (redisClient.get as jest.Mock).mockResolvedValue(JSON.stringify({ patientId: 'patient1', holdToken: '123e4567-e89b-12d3-a456-426614174001' }));
      
      await releaseHold(mockRequest as Request, mockResponse as Response);
      
      expect(redisClient.del).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should not delete redis key if hold belongs to someone else', async () => {
      mockRequest.body = { doctorId: '123e4567-e89b-12d3-a456-426614174000', startTime: new Date().toISOString(), holdToken: '123e4567-e89b-12d3-a456-426614174001' };
      (redisClient.get as jest.Mock).mockResolvedValue(JSON.stringify({ patientId: 'patient2', holdToken: '123e4567-e89b-12d3-a456-426614174001' }));
      
      await releaseHold(mockRequest as Request, mockResponse as Response);
      
      expect(redisClient.del).not.toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('bookAppointment', () => {
    const validBody = {
      doctorId: '123e4567-e89b-12d3-a456-426614174000',
      startTime: new Date().toISOString(),
      holdToken: '123e4567-e89b-12d3-a456-426614174001',
      symptomsRaw: 'I have a headache and fever.'
    };

    it('should return 400 if hold expired or invalid', async () => {
      mockRequest.body = validBody;
      (redisClient.get as jest.Mock).mockResolvedValue(null);
      await bookAppointment(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should return 403 if invalid hold token', async () => {
      mockRequest.body = validBody;
      (redisClient.get as jest.Mock).mockResolvedValue(JSON.stringify({ patientId: 'patient1', holdToken: 'wrong-token' }));
      await bookAppointment(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('should book successfully and delete hold', async () => {
      mockRequest.body = validBody;
      (redisClient.get as jest.Mock).mockResolvedValue(JSON.stringify({ patientId: 'patient1', holdToken: validBody.holdToken }));
      prismaMock.doctor.findUnique.mockResolvedValue({ id: 'd1', userId: 'doc', specialization: '', workingHours: {}, slotDurationMins: 30, createdAt: new Date(), updatedAt: new Date(), googleRefreshToken: null, user: { email: 'doctor@test.com' } } as any);
      prismaMock.user.findUnique.mockResolvedValue({ id: 'patient1', email: 'patient@test.com', role: 'PATIENT', passwordHash: '', name: 'P', createdAt: new Date(), updatedAt: new Date() } as any);
      
      const mockTx = { appointment: { create: jest.fn().mockResolvedValue({ id: 'a1' }) } };
      prismaMock.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx as any);
      });

      await bookAppointment(mockRequest as Request, mockResponse as Response);
      
      expect(mockTx.appointment.create).toHaveBeenCalled();
      expect(redisClient.del).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Appointment booked successfully' }));
    });

    it('should return 409 if unique constraint violated (P2002)', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockRequest.body = validBody;
      (redisClient.get as jest.Mock).mockResolvedValue(JSON.stringify({ patientId: 'patient1', holdToken: validBody.holdToken }));
      prismaMock.doctor.findUnique.mockResolvedValue({ id: 'd1', userId: 'doc', specialization: '', workingHours: {}, slotDurationMins: 30, createdAt: new Date(), updatedAt: new Date(), googleRefreshToken: null, user: { email: 'doctor@test.com' } } as any);
      prismaMock.user.findUnique.mockResolvedValue({ id: 'patient1', email: 'patient@test.com', role: 'PATIENT', passwordHash: '', name: 'P', createdAt: new Date(), updatedAt: new Date() } as any);
      
      prismaMock.$transaction.mockImplementation(async () => {
        const error = new Error('Unique constraint');
        (error as any).code = 'P2002';
        throw error;
      });

      await bookAppointment(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.status).toHaveBeenCalledWith(409);
      consoleSpy.mockRestore();
    });
  });
});
