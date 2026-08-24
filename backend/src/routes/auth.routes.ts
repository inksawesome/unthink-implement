import { Router } from 'express';
import { register, login, getGoogleAuthUrl, googleAuthCallback } from '../controllers/auth.controller';
import { authenticate, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);

router.get('/google/url', authenticate, requireRole(['DOCTOR']), getGoogleAuthUrl);
router.get('/google/callback', googleAuthCallback);

export default router;
