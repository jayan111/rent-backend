import express from 'express';
import {
  getInventory,
  addInventoryItem,
  updateInventoryStatus,
  createMaintenanceRequest,
  getMaintenanceRequests,
  reportDamage,
  getDamageReports
} from '../controllers/inventoryController';
import { cacheInventory } from '../middleware/cache';
import { rateLimits } from '../middleware/rateLimiting';

const router = express.Router();

// Apply rate limiting
router.use(rateLimits.general);

// Inventory routes
router.get('/', cacheInventory, getInventory);
router.post('/', addInventoryItem);
router.patch('/:id', updateInventoryStatus);

// Maintenance routes
router.post('/maintenance', createMaintenanceRequest);
router.get('/maintenance', getMaintenanceRequests);

// Damage routes
router.post('/damage', reportDamage);
router.get('/damage', getDamageReports);

export default router;