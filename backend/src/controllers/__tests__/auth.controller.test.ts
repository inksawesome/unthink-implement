import { Request, Response } from 'express';
import { register, login } from '../auth.controller';
import { prismaMock } from '../../setupTests';
import * as authUtils from '../../utils/auth.utils';

jest.mock('../../utils/auth.utils');

describe('Auth Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockRequest = { body: {} };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('register', () => {
    const validBody = { email: 'test@example.com', password: 'password123', name: 'Test User' };

    it('should return 400 if validation fails', async () => {
      mockRequest.body = { email: 'invalid' };
      await register(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Validation failed' }));
    });

    it('should return 409 if user exists', async () => {
      mockRequest.body = validBody;
      prismaMock.user.findUnique.mockResolvedValue({ id: '1', ...validBody, role: 'PATIENT', passwordHash: 'hash', createdAt: new Date(), updatedAt: new Date() });
      await register(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(409);
    });

    it('should create user and return token on success', async () => {
      mockRequest.body = validBody;
      prismaMock.user.findUnique.mockResolvedValue(null);
      (authUtils.hashPassword as jest.Mock).mockResolvedValue('hashed_password');
      prismaMock.user.create.mockResolvedValue({ id: '1', email: validBody.email, name: validBody.name, role: 'PATIENT', passwordHash: 'hashed_password', createdAt: new Date(), updatedAt: new Date() });
      (authUtils.generateToken as jest.Mock).mockReturnValue('mock_token');

      await register(mockRequest as Request, mockResponse as Response);

      expect(prismaMock.user.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ email: validBody.email })
      }));
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ token: 'mock_token' }));
    });
  });

  describe('login', () => {
    const validBody = { email: 'test@example.com', password: 'password123' };

    it('should return 400 if validation fails', async () => {
      mockRequest.body = { email: 'invalid' };
      await login(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should return 401 if user not found', async () => {
      mockRequest.body = validBody;
      prismaMock.user.findUnique.mockResolvedValue(null);
      await login(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it('should return 401 if password does not match', async () => {
      mockRequest.body = validBody;
      prismaMock.user.findUnique.mockResolvedValue({ id: '1', ...validBody, name: 'T', role: 'PATIENT', passwordHash: 'hash', createdAt: new Date(), updatedAt: new Date() });
      (authUtils.comparePassword as jest.Mock).mockResolvedValue(false);
      await login(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it('should return token if login successful', async () => {
      mockRequest.body = validBody;
      prismaMock.user.findUnique.mockResolvedValue({ id: '1', ...validBody, name: 'T', role: 'PATIENT', passwordHash: 'hash', createdAt: new Date(), updatedAt: new Date() });
      (authUtils.comparePassword as jest.Mock).mockResolvedValue(true);
      (authUtils.generateToken as jest.Mock).mockReturnValue('mock_token');

      await login(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ token: 'mock_token' }));
    });
  });
});
