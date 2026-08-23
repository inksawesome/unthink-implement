import { Router } from 'express';
import { holdSlot, releaseHold, bookAppointment, submitPostVisitNotes, addPrescription } from '../controllers/appointment.controller';
import { authenticate, requireRole } from '../middlewares/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Patient routes
router.post('/hold', requireRole(['PATIENT']), holdSlot);
router.delete('/hold', requireRole(['PATIENT']), releaseHold);
router.post('/book', requireRole(['PATIENT']), bookAppointment);

// Doctor routes
router.post('/:id/post-visit', requireRole(['DOCTOR']), submitPostVisitNotes);
router.post('/:id/prescriptions', requireRole(['DOCTOR']), addPrescription);

export default router;
