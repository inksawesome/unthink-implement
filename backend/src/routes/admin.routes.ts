import { Router } from 'express';
import { createLeave, createDoctor } from '../controllers/admin.controller';
import { authenticate, requireRole } from '../middlewares/auth.middleware';

const router = Router();

// Only admins can access these routes
router.use(authenticate, requireRole(['ADMIN']));

router.post('/leaves', createLeave);
router.post('/doctors', createDoctor);

export default router;
