import express from 'express';
import { submitKYC, getKYCStatus } from '../controllers/kycController';
import { optionalAuth } from '../middleware/auth';

const router = express.Router();

router.post('/', optionalAuth, submitKYC);
router.get('/status', optionalAuth, getKYCStatus);

export default router;
