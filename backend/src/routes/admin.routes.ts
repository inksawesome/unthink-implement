import { Router } from 'express';
import { createLeave } from '../controllers/admin.controller';
import { authenticate, requireRole } from '../middlewares/auth.middleware';

const router = Router();

// Only admins can access these routes
router.use(authenticate, requireRole(['ADMIN']));

router.post('/leaves', createLeave);

export default router;
