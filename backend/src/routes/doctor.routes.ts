import { Router } from 'express';
import { getSlots, getAllDoctors } from '../controllers/doctor.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticate, getAllDoctors);
router.get('/:id/slots', authenticate, getSlots);

export default router;
