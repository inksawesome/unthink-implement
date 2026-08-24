import { Router } from 'express';
import { createLeave, createDoctor, updateDoctor, deleteDoctor } from '../controllers/admin.controller';
import { authenticate, requireRole } from '../middlewares/auth.middleware';

const router = Router();

// Only admins can access these routes
router.use(authenticate, requireRole(['ADMIN']));

router.post('/leaves', createLeave);
router.post('/doctors', createDoctor);
router.put('/doctors/:id', updateDoctor);
router.delete('/doctors/:id', deleteDoctor);

export default router;
