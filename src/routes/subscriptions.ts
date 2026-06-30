import { Router } from 'express';
import { 
  getUserSubscriptions, 
  getSubscriptionById, 
  cancelSubscription, 
  pauseSubscription, 
  resumeSubscription 
} from '../controllers/subscriptionController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, getUserSubscriptions);
router.get('/:id', authenticateToken, getSubscriptionById);
router.post('/:id/cancel', authenticateToken, cancelSubscription);
router.post('/:id/pause', authenticateToken, pauseSubscription);
router.post('/:id/resume', authenticateToken, resumeSubscription);

export default router;