import { Response } from 'express';
import { RowDataPacket } from 'mysql2';
import { AuthenticatedRequest } from '../types';
import { getDB } from '../config/database';

interface UserRow extends RowDataPacket {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  address: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export const getUserProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const [rows] = await db.query<UserRow[]>(
      'SELECT id, name, email, phone, role, address, is_active, created_at, updated_at FROM users WHERE id = ? AND is_active = TRUE',
      [userId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = rows[0];
    let parsedAddress = null;
    try {
      parsedAddress = user.address ? JSON.parse(user.address) : null;
    } catch {
      parsedAddress = user.address;
    }

    res.json({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        address: parsedAddress,
        is_active: user.is_active,
        kycStatus: 'not_required',
        kycDocuments: [],
        creditScore: null,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { name, phone, address } = req.body;

    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const updates: string[] = [];
    const values: any[] = [];

    if (name) { updates.push('name = ?'); values.push(name); }
    if (phone) { updates.push('phone = ?'); values.push(phone); }
    if (address) { updates.push('address = ?'); values.push(JSON.stringify(address)); }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    values.push(userId);
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    const [rows] = await db.query<UserRow[]>(
      'SELECT id, name, email, phone, role, address, is_active, created_at, updated_at FROM users WHERE id = ?',
      [userId]
    );

    const user = rows[0];
    let parsedAddress = null;
    try {
      parsedAddress = user.address ? JSON.parse(user.address) : null;
    } catch {
      parsedAddress = user.address;
    }

    res.json({
      message: 'Profile updated successfully',
      data: { ...user, address: parsedAddress }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const uploadKYCDocument = async (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json({
      message: 'KYC document uploaded successfully',
      data: { type: req.body.type, number: req.body.number, verified: false }
    });
  } catch (error) {
    console.error('Upload KYC error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const verifyKYC = async (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json({
      message: 'KYC verification updated successfully',
      data: {}
    });
  } catch (error) {
    console.error('Verify KYC error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getAllUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;

    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];

    if (search && typeof search === 'string' && search.trim()) {
      whereClause += ' AND (name LIKE ? OR email LIKE ?)';
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    const [countRows] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      queryParams
    );
    const total = (countRows[0] as any).total;

    const [rows] = await db.query<UserRow[]>(
      `SELECT id, name, email, phone, role, is_active, created_at, updated_at FROM users ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...queryParams, limitNum, offset]
    );

    res.json({
      data: rows,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getUserStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT
        COUNT(*) as totalUsers,
        SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) as activeUsers,
        SUM(CASE WHEN is_active = FALSE THEN 1 ELSE 0 END) as inactiveUsers,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as adminUsers
      FROM users
    `);

    const stats = rows[0] as any;

    res.json({
      data: {
        totalUsers: parseInt(stats.totalUsers) || 0,
        activeUsers: parseInt(stats.activeUsers) || 0,
        inactiveUsers: parseInt(stats.inactiveUsers) || 0,
        adminUsers: parseInt(stats.adminUsers) || 0,
        verifiedUsers: parseInt(stats.activeUsers) || 0,
        pendingKYC: 0,
        rejectedKYC: 0
      }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
