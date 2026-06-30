import { Response } from 'express';
import { RowDataPacket } from 'mysql2';
import { AuthenticatedRequest } from '../types';
import { getDB } from '../config/database';

interface InventoryRow extends RowDataPacket {
  id: string;
  product_id: string;
  product_name: string;
  serial_number: string;
  status: string;
  condition_notes: string;
  location: string;
  assigned_order_id: string;
  created_at: Date;
  updated_at: Date;
}

export const getInventory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { productId, status, location, page = 1, limit = 20 } = req.query;

    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (productId) { whereClause += ' AND i.product_id = ?'; params.push(productId); }
    if (status) { whereClause += ' AND i.status = ?'; params.push(status); }
    if (location) { whereClause += ' AND i.location LIKE ?'; params.push(`%${location}%`); }

    const [countRows] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM inventory i ${whereClause}`,
      params
    );
    const total = (countRows[0] as any).total;

    const [rows] = await db.query<InventoryRow[]>(
      `SELECT i.*, p.name as product_name
       FROM inventory i
       LEFT JOIN products p ON i.product_id = p.id
       ${whereClause}
       ORDER BY i.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    res.json({
      data: rows,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const addInventoryItem = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { productId, serialNumber, status = 'available', conditionNotes, location } = req.body;

    if (!productId) {
      return res.status(400).json({ message: 'productId is required' });
    }

    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const id = `inv_${Date.now()}`;
    await db.query(
      `INSERT INTO inventory (id, product_id, serial_number, status, condition_notes, location)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, productId, serialNumber || null, status, conditionNotes || null, location || null]
    );

    res.status(201).json({
      message: 'Inventory item added successfully',
      data: { id, productId, serialNumber, status, conditionNotes, location }
    });
  } catch (error) {
    console.error('Add inventory error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateInventoryStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, conditionNotes, location } = req.body;

    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const [existing] = await db.query<RowDataPacket[]>('SELECT id FROM inventory WHERE id = ?', [id]);
    if (!existing || (existing as any[]).length === 0) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (status) { updates.push('status = ?'); values.push(status); }
    if (conditionNotes !== undefined) { updates.push('condition_notes = ?'); values.push(conditionNotes); }
    if (location !== undefined) { updates.push('location = ?'); values.push(location); }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    values.push(id);
    await db.query(`UPDATE inventory SET ${updates.join(', ')} WHERE id = ?`, values);

    const [rows] = await db.query<InventoryRow[]>(
      'SELECT i.*, p.name as product_name FROM inventory i LEFT JOIN products p ON i.product_id = p.id WHERE i.id = ?',
      [id]
    );

    res.json({
      message: 'Inventory updated successfully',
      data: rows[0]
    });
  } catch (error) {
    console.error('Update inventory error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createMaintenanceRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { subscriptionId, productId, inventoryId, issue, priority = 'medium' } = req.body;
    const userId = req.user?.id;

    if (!productId || !issue) {
      return res.status(400).json({ message: 'productId and issue are required' });
    }

    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const id = `maint_${Date.now()}`;
    await db.query(
      `INSERT INTO maintenance_requests (id, subscription_id, user_id, product_id, inventory_id, issue, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, subscriptionId || null, userId || null, productId, inventoryId || null, issue, priority]
    );

    res.status(201).json({
      message: 'Maintenance request created successfully',
      data: { id, subscriptionId, userId, productId, inventoryId, issue, priority, status: 'pending' }
    });
  } catch (error) {
    console.error('Create maintenance request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getMaintenanceRequests = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, priority, page = 1, limit = 20 } = req.query;

    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (status) { whereClause += ' AND status = ?'; params.push(status); }
    if (priority) { whereClause += ' AND priority = ?'; params.push(priority); }

    const [countRows] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM maintenance_requests ${whereClause}`,
      params
    );
    const total = (countRows[0] as any).total;

    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT * FROM maintenance_requests ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    res.json({ data: rows, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (error) {
    console.error('Get maintenance requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const reportDamage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { inventoryId, subscriptionId, description, severity, images } = req.body;
    const userId = req.user?.id;

    if (!inventoryId || !description || !severity) {
      return res.status(400).json({ message: 'inventoryId, description, and severity are required' });
    }

    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const id = `dmg_${Date.now()}`;
    await db.query(
      `INSERT INTO damage_reports (id, inventory_id, subscription_id, user_id, description, severity, images)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, inventoryId, subscriptionId || null, userId || null, description, severity, JSON.stringify(images || [])]
    );

    res.status(201).json({
      message: 'Damage reported successfully',
      data: { id, inventoryId, subscriptionId, userId, description, severity, status: 'reported' }
    });
  } catch (error) {
    console.error('Report damage error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getDamageReports = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, severity, page = 1, limit = 20 } = req.query;

    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (status) { whereClause += ' AND status = ?'; params.push(status); }
    if (severity) { whereClause += ' AND severity = ?'; params.push(severity); }

    const [countRows] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM damage_reports ${whereClause}`,
      params
    );
    const total = (countRows[0] as any).total;

    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT * FROM damage_reports ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    res.json({ data: rows, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (error) {
    console.error('Get damage reports error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
