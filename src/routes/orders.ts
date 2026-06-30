import express from 'express';
import {
  createCheckoutSession,
  handleWebhook,
  getOrders,
  getOrderById,
  updateOrderStatus,
  cancelSubscription,
  getOrderStats,
} from '../controllers/orderController';
import { authenticateToken, requireAdmin, optionalAuth } from '../middleware/auth';

const router = express.Router();

// Webhook route (no auth, raw body needed)
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Customer routes
router.post('/checkout', createCheckoutSession);
router.get('/', optionalAuth, getOrders);
router.get('/:id', optionalAuth, getOrderById);
router.post('/:id/cancel', authenticateToken, cancelSubscription);

// Admin routes (require admin auth)
router.patch('/:id/status', authenticateToken, requireAdmin, updateOrderStatus);
router.get('/admin/stats', authenticateToken, requireAdmin, getOrderStats);

export default router;
