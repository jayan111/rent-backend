import { Response } from 'express';
import { getDB } from '../config/database';
import { AuthenticatedRequest } from '../types';
import { RowDataPacket } from 'mysql2';

export const submitKYC = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const { documentType, documentNumber, fullName, dateOfBirth, address, email: bodyEmail } = req.body;

    // Validate required fields
    if (!documentType || !documentNumber || !fullName || !dateOfBirth) {
      return res.status(400).json({ message: 'documentType, documentNumber, fullName, and dateOfBirth are required' });
    }

    const validDocTypes = ['aadhaar', 'pan', 'driving_license', 'passport'];
    if (!validDocTypes.includes(documentType)) {
      return res.status(400).json({ message: `documentType must be one of: ${validDocTypes.join(', ')}` });
    }

    const userId = req.user?.id || null;
    const userEmail = req.user?.email || bodyEmail;

    if (!userEmail) {
      return res.status(400).json({ message: 'Email is required for KYC submission' });
    }

    // Check existing KYC
    const [existing] = await db.query<RowDataPacket[]>(
      'SELECT id, status FROM kyc_verifications WHERE user_email = ? ORDER BY submitted_at DESC LIMIT 1',
      [userEmail]
    );

    if ((existing as any[]).length > 0 && (existing as any[])[0].status === 'verified') {
      return res.status(409).json({ message: 'KYC already verified for this account' });
    }

    const id = `kyc_${Date.now()}`;

    await db.execute(
      `INSERT INTO kyc_verifications
        (id, user_id, user_email, document_type, document_number, full_name, date_of_birth, address, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [id, userId, userEmail, documentType, documentNumber, fullName, dateOfBirth, address || null]
    );

    const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM kyc_verifications WHERE id = ?', [id]);

    return res.status(201).json({ message: 'KYC submitted successfully', data: (rows as any[])[0] });
  } catch (error) {
    console.error('Submit KYC error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const getKYCStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const userId = req.user?.id;
    const email = req.user?.email || (req.query.email as string);

    if (!userId && !email) {
      return res.status(400).json({ message: 'User ID or email is required' });
    }

    let rows: RowDataPacket[];
    if (userId) {
      [rows] = await db.query<RowDataPacket[]>(
        'SELECT id, status, document_type, submitted_at, reviewed_at, rejection_reason FROM kyc_verifications WHERE user_id = ? ORDER BY submitted_at DESC LIMIT 1',
        [userId]
      ) as [RowDataPacket[], any];
    } else {
      [rows] = await db.query<RowDataPacket[]>(
        'SELECT id, status, document_type, submitted_at, reviewed_at, rejection_reason FROM kyc_verifications WHERE user_email = ? ORDER BY submitted_at DESC LIMIT 1',
        [email]
      ) as [RowDataPacket[], any];
    }

    if ((rows as any[]).length === 0) {
      return res.status(404).json({ message: 'No KYC record found', data: null });
    }

    return res.json({ message: 'KYC status fetched', data: (rows as any[])[0] });
  } catch (error) {
    console.error('Get KYC status error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const adminGetKYCList = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM kyc_verifications';
    const params: any[] = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY submitted_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await db.query<RowDataPacket[]>(query, params);

    let countQuery = 'SELECT COUNT(*) as total FROM kyc_verifications';
    const countParams: any[] = [];
    if (status) {
      countQuery += ' WHERE status = ?';
      countParams.push(status);
    }
    const [countRows] = await db.query<RowDataPacket[]>(countQuery, countParams);
    const total = (countRows as any[])[0]?.total || 0;

    return res.json({
      message: 'KYC list fetched',
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Admin get KYC list error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const adminUpdateKYC = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const { id } = req.params;
    const { status, rejection_reason } = req.body;

    const validStatuses = ['pending', 'under_review', 'verified', 'rejected'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${validStatuses.join(', ')}` });
    }

    await db.execute(
      `UPDATE kyc_verifications SET status = ?, rejection_reason = ?, reviewed_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [status, rejection_reason || null, id]
    );

    const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM kyc_verifications WHERE id = ?', [id]);

    if ((rows as any[]).length === 0) {
      return res.status(404).json({ message: 'KYC record not found' });
    }

    return res.json({ message: 'KYC updated successfully', data: (rows as any[])[0] });
  } catch (error) {
    console.error('Admin update KYC error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};
