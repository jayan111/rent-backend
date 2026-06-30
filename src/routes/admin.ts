import express, { Response } from 'express';
import {
  // Dashboard
  getDashboardStats,
  getRevenueAnalytics,
  getInventoryAnalytics,
  getCustomerAnalytics,
  getOperationalMetrics,
  // Inventory
  getInventoryAdmin,
  updateInventoryItem,
  bulkUpdateInventory
} from '../controllers/adminController';
import {
  getAdminProducts,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  uploadAdminImage
} from '../controllers/adminProductController';
import { getAllSubscriptionsAdmin, updateSubscriptionAdmin } from '../controllers/subscriptionController';
import { getAllUsers } from '../controllers/userController';
import { getAdminOrders } from '../controllers/orderController';
import {
  getMaintenanceRequests,
  getDamageReports,
  addInventoryItem
} from '../controllers/inventoryController';
import { adminGetKYCList, adminUpdateKYC } from '../controllers/kycController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import { cacheDashboard } from '../middleware/cache';
import { rateLimits } from '../middleware/rateLimiting';
import { uploadProductImages, uploadSingleImage } from '../middleware/upload';
import { getDB } from '../config/database';
import { RowDataPacket } from 'mysql2';

const router = express.Router();

// Apply admin rate limiting and authentication
router.use(rateLimits.admin);
router.use(authenticateToken, requireAdmin);

// Disable browser/proxy caching for all admin GET responses so updates are always visible
router.use((req, res, next) => {
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Dashboard routes
router.get('/stats', cacheDashboard, getDashboardStats);
router.get('/analytics/revenue', getRevenueAnalytics);
router.get('/analytics/inventory', getInventoryAnalytics);
router.get('/analytics/customers', getCustomerAnalytics);
router.get('/metrics/operations', getOperationalMetrics);

// Product management routes
router.get('/products', getAdminProducts);
router.post('/products', uploadProductImages, createAdminProduct);
router.put('/products/:id', uploadProductImages, updateAdminProduct);
router.delete('/products/:id', deleteAdminProduct);
router.post('/upload-image', uploadSingleImage, uploadAdminImage);

// Inventory management routes
router.get('/inventory', getInventoryAdmin);
router.put('/inventory/:id', updateInventoryItem);
router.patch('/inventory/bulk', bulkUpdateInventory);

// Orders routes (admin flat format)
router.get('/orders', getAdminOrders);

// User management routes
router.get('/users', getAllUsers);
router.patch('/users/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { is_active, role } = req.body;

    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const updates: string[] = [];
    const values: any[] = [];

    if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active); }
    if (role) { updates.push('role = ?'); values.push(role); }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    values.push(id);
    await db.query(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, values);

    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT id, name, email, phone, role, is_active, created_at FROM users WHERE id = ?',
      [id]
    );

    res.json({ message: 'User updated successfully', data: (rows as any[])[0] });
  } catch (error) {
    console.error('Update user admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Subscription management routes
router.get('/subscriptions', getAllSubscriptionsAdmin);
router.patch('/subscriptions/:id', updateSubscriptionAdmin);

// Maintenance management routes
router.get('/maintenance', getMaintenanceRequests);
router.patch('/maintenance/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes, priority } = req.body;
    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const updates: string[] = [];
    const values: any[] = [];
    if (status) { updates.push('status = ?'); values.push(status); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }
    if (priority) { updates.push('priority = ?'); values.push(priority); }
    if (updates.length === 0) return res.status(400).json({ message: 'No fields to update' });

    values.push(id);
    await db.query(`UPDATE maintenance_requests SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, values);

    const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM maintenance_requests WHERE id = ?', [id]);
    res.json({ message: 'Maintenance request updated', data: (rows as any[])[0] });
  } catch (error) {
    console.error('Update maintenance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Damage reports management routes
router.get('/damages', getDamageReports);
router.patch('/damages/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, repair_cost, charged_amount } = req.body;
    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const updates: string[] = [];
    const values: any[] = [];
    if (status) { updates.push('status = ?'); values.push(status); }
    if (repair_cost !== undefined) { updates.push('repair_cost = ?'); values.push(repair_cost); }
    if (charged_amount !== undefined) { updates.push('charged_amount = ?'); values.push(charged_amount); }
    if (updates.length === 0) return res.status(400).json({ message: 'No fields to update' });

    values.push(id);
    await db.query(`UPDATE damage_reports SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, values);

    const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM damage_reports WHERE id = ?', [id]);
    res.json({ message: 'Damage report updated', data: (rows as any[])[0] });
  } catch (error) {
    console.error('Update damage report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Inventory item creation route
router.post('/inventory', addInventoryItem);

// KYC management routes
router.get('/kyc', adminGetKYCList);
router.patch('/kyc/:id', adminUpdateKYC);

// Settings routes
router.get('/settings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });
    const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM admin_settings LIMIT 1');
    res.json({ data: (rows as any[])[0] || {} });
  } catch (error) {
    res.json({ data: {} });
  }
});

router.put('/settings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });
    const settings = req.body;
    const keys = Object.keys(settings);
    if (keys.length === 0) return res.status(400).json({ message: 'No settings provided' });

    // Upsert each key-value pair
    for (const key of keys) {
      await db.query(
        `INSERT INTO admin_settings (\`key\`, \`value\`) VALUES (?, ?) ON DUPLICATE KEY UPDATE \`value\` = ?, updated_at = NOW()`,
        [key, String(settings[key]), String(settings[key])]
      );
    }
    res.json({ message: 'Settings saved successfully' });
  } catch (error) {
    console.error('Settings save error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
