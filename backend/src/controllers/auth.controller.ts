import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma';
import { hashPassword, comparePassword, generateToken } from '../utils/auth.utils';
import { getGoogleOAuthClient } from '../utils/googleAuth';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/jwt';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  name: z.string().min(2, 'Name must be at least 2 characters long')
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsedData = registerSchema.safeParse(req.body);
    if (!parsedData.success) {
      res.status(400).json({ error: 'Validation failed', details: parsedData.error.format() });
      return;
    }

    const { email, password, name } = parsedData.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ error: 'User with this email already exists' });
      return;
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        name,
        role: 'PATIENT'
      }
    });

    const token = generateToken({ id: user.id, role: user.role });

    res.status(201).json({
      message: 'Patient registered successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsedData = loginSchema.safeParse(req.body);
    if (!parsedData.success) {
      res.status(400).json({ error: 'Validation failed', details: parsedData.error.format() });
      return;
    }

    const { email, password } = parsedData.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = generateToken({ id: user.id, role: user.role });

    res.status(200).json({
      message: 'Logged in successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getGoogleAuthUrl = async (req: Request, res: Response): Promise<void> => {
  try {
    const doctorId = req.user?.id;
    if (!doctorId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const oauth2Client = getGoogleOAuthClient();
    const stateToken = jwt.sign({ userId: doctorId }, JWT_SECRET, { expiresIn: '15m' });

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/calendar.events'],
      state: stateToken
    });

    res.json({ url });
  } catch (error) {
    console.error('Error generating Google auth URL:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
};

export const googleAuthCallback = async (req: Request, res: Response): Promise<void> => {
  const { code, state, error: authError } = req.query;
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
  
  if (authError) {
    console.error('Google Auth Error from query:', authError);
    res.redirect(`${FRONTEND_URL}/doctor/dashboard?calendarSync=error`);
    return;
  }

  try {
    const decoded = jwt.verify(state as string, JWT_SECRET) as { userId: string };
    const oauth2Client = getGoogleOAuthClient();
    
    const { tokens } = await oauth2Client.getToken(code as string);
    
    if (tokens.refresh_token) {
      await prisma.doctor.update({
        where: { userId: decoded.userId },
        data: { googleRefreshToken: tokens.refresh_token }
      });
    }

    res.redirect(`${FRONTEND_URL}/schedule?calendarSync=success`);
  } catch (error) {
    console.error('Google OAuth Callback Error:', error);
    res.redirect(`${FRONTEND_URL}/schedule?calendarSync=error`);
  }
};
