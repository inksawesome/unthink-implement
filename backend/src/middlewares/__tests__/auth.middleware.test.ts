import { Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../auth.middleware';
import * as authUtils from '../../utils/auth.utils';

jest.mock('../../utils/auth.utils');

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction = jest.fn();

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    nextFunction = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should return 401 if authorization header is missing', () => {
      mockRequest.headers = {};
      authenticate(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });

    it('should return 401 if token format is invalid', () => {
      mockRequest.headers = { authorization: 'InvalidToken format' };
      authenticate(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it('should return 401 if verifyToken throws', () => {
      mockRequest.headers = { authorization: 'Bearer bad_token' };
      (authUtils.verifyToken as jest.Mock).mockImplementation(() => { throw new Error('Invalid'); });
      authenticate(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it('should call next and set req.user if token is valid', () => {
      mockRequest.headers = { authorization: 'Bearer good_token' };
      const decodedUser = { id: '1', role: 'PATIENT' };
      (authUtils.verifyToken as jest.Mock).mockReturnValue(decodedUser);
      
      authenticate(mockRequest as Request, mockResponse as Response, nextFunction);
      
      expect(mockRequest.user).toEqual(decodedUser);
      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    it('should return 401 if req.user is undefined', () => {
      const middleware = requireRole(['ADMIN']);
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it('should return 403 if user role is not included', () => {
      mockRequest.user = { id: '1', role: 'PATIENT' };
      const middleware = requireRole(['ADMIN']);
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('should call next if user role is included', () => {
      mockRequest.user = { id: '1', role: 'ADMIN' };
      const middleware = requireRole(['ADMIN', 'DOCTOR']);
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalled();
    });
  });
});
