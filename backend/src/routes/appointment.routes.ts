import { Router } from 'express';
import { holdSlot, releaseHold, bookAppointment } from '../controllers/appointment.controller';
import { authenticate, requireRole } from '../middlewares/auth.middleware';

const router = Router();

// Only patients can book appointments
router.use(authenticate, requireRole(['PATIENT']));

router.post('/hold', holdSlot);
router.delete('/hold', releaseHold);
router.post('/book', bookAppointment);

export default router;
