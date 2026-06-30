import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { getDB } from '../config/database';
import { RowDataPacket } from 'mysql2';
import { parseImages, normalizeImageUrls } from '../utils/productJson';

interface SubscriptionRow extends RowDataPacket {
  id: string;
  user_id: string;
  order_id: string;
  product_id: string;
  status: string;
  start_date: Date;
  end_date: Date;
  tenure_months: number;
  monthly_amount: number;
  stripe_subscription_id: string;
  created_at: Date;
  updated_at: Date;
  product_name?: string;
  product_images?: string;
  order_status?: string;
}

export const getUserSubscriptions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { status = 'active', page = 1, limit = 10 } = req.query;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const db = await getDB();
    if (!db) {
      return res.status(500).json({ message: 'Database connection failed' });
    }

    let query = `
      SELECT s.*, p.name as product_name, p.images as product_images, o.status as order_status
      FROM subscriptions s
      LEFT JOIN products p ON s.product_id = p.id
      LEFT JOIN orders o ON s.order_id = o.id
      WHERE s.user_id = ?
    `;
    const params: any[] = [userId];

    if (status && status !== 'all') {
      query += ' AND s.status = ?';
      params.push(status);
    }

    query += ' ORDER BY s.created_at DESC';

    // Count total subscriptions
    const countQuery = query.replace('SELECT s.*, p.name as product_name, p.images as product_images, o.status as order_status', 'SELECT COUNT(*) as total').split('ORDER BY')[0];
    const [countResult] = await db.query<any[]>(countQuery, params);
    const total = countResult[0]?.total || 0;

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    query += ' LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    const [subscriptions] = await db.query<SubscriptionRow[]>(query, params);

    const formattedSubscriptions = subscriptions.map(sub => ({
      id: sub.id,
      orderId: sub.order_id,
      productId: sub.product_id,
      productName: sub.product_name,
      productImages: sub.product_images ? JSON.parse(sub.product_images) : [],
      status: sub.status.toUpperCase(),
      orderStatus: sub.order_status?.toUpperCase(),
      startDate: sub.start_date,
      endDate: sub.end_date,
      tenureMonths: sub.tenure_months,
      monthlyAmount: sub.monthly_amount,
      totalAmount: sub.monthly_amount * sub.tenure_months,
      stripeSubscriptionId: sub.stripe_subscription_id,
      createdAt: sub.created_at,
      updatedAt: sub.updated_at
    }));

    const totalPages = Math.ceil(total / limitNum);
    const hasMore = pageNum < totalPages;

    res.json({
      success: true,
      data: formattedSubscriptions,
      pagination: {
        total,
        page: pageNum,
        totalPages,
        hasMore,
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('Get user subscriptions error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getSubscriptionById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const db = await getDB();
    if (!db) {
      return res.status(500).json({ message: 'Database connection failed' });
    }

    const [subscriptions] = await db.query<SubscriptionRow[]>(
      `SELECT s.*, p.name as product_name, p.images as product_images, o.status as order_status
       FROM subscriptions s
       LEFT JOIN products p ON s.product_id = p.id
       LEFT JOIN orders o ON s.order_id = o.id
       WHERE s.id = ? AND s.user_id = ?`,
      [id, userId]
    );

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    const sub = subscriptions[0];
    const formattedSubscription = {
      id: sub.id,
      orderId: sub.order_id,
      productId: sub.product_id,
      productName: sub.product_name,
      productImages: sub.product_images ? JSON.parse(sub.product_images) : [],
      status: sub.status.toUpperCase(),
      orderStatus: sub.order_status?.toUpperCase(),
      startDate: sub.start_date,
      endDate: sub.end_date,
      tenureMonths: sub.tenure_months,
      monthlyAmount: sub.monthly_amount,
      totalAmount: sub.monthly_amount * sub.tenure_months,
      stripeSubscriptionId: sub.stripe_subscription_id,
      createdAt: sub.created_at,
      updatedAt: sub.updated_at
    };

    res.json({
      success: true,
      data: formattedSubscription
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const cancelSubscription = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const db = await getDB();
    if (!db) {
      return res.status(500).json({ message: 'Database connection failed' });
    }

    // Check if subscription belongs to user
    const [subscriptions] = await db.query<SubscriptionRow[]>(
      'SELECT * FROM subscriptions WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    const subscription = subscriptions[0];

    if (subscription.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Subscription already cancelled' });
    }

    // Update subscription status
    await db.query(
      'UPDATE subscriptions SET status = "cancelled", updated_at = NOW() WHERE id = ?',
      [id]
    );

    // TODO: Cancel Stripe subscription if exists
    // if (subscription.stripe_subscription_id) {
    //   await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
    // }

    res.json({
      success: true,
      message: 'Subscription cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const pauseSubscription = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const db = await getDB();
    if (!db) {
      return res.status(500).json({ message: 'Database connection failed' });
    }

    // Check if subscription belongs to user
    const [subscriptions] = await db.query<SubscriptionRow[]>(
      'SELECT * FROM subscriptions WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    const subscription = subscriptions[0];

    if (subscription.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Can only pause active subscriptions' });
    }

    // Update subscription status
    await db.query(
      'UPDATE subscriptions SET status = "paused", updated_at = NOW() WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Subscription paused successfully'
    });
  } catch (error) {
    console.error('Pause subscription error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const resumeSubscription = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const db = await getDB();
    if (!db) {
      return res.status(500).json({ message: 'Database connection failed' });
    }

    // Check if subscription belongs to user
    const [subscriptions] = await db.query<SubscriptionRow[]>(
      'SELECT * FROM subscriptions WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    const subscription = subscriptions[0];

    if (subscription.status !== 'paused') {
      return res.status(400).json({ success: false, message: 'Can only resume paused subscriptions' });
    }

    // Update subscription status
    await db.query(
      'UPDATE subscriptions SET status = "active", updated_at = NOW() WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Subscription resumed successfully'
    });
  } catch (error) {
    console.error('Resume subscription error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Admin: get all subscriptions (no user_id filter)
export const getAllSubscriptionsAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (status && status !== 'all') {
      whereClause += ' AND s.status = ?';
      params.push(status);
    }

    const [countRows] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM subscriptions s ${whereClause}`,
      params
    );
    const total = (countRows[0] as any).total;

    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT s.*, p.name as product_name, u.name as user_name, u.email as user_email
       FROM subscriptions s
       LEFT JOIN products p ON s.product_id = p.id
       LEFT JOIN users u ON s.user_id = u.id
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    const formatted = (rows as any[]).map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      userName: r.user_name,
      userEmail: r.user_email,
      orderId: r.order_id,
      productId: r.product_id,
      productName: r.product_name,
      status: r.status,
      startDate: r.start_date,
      endDate: r.end_date,
      tenureMonths: r.tenure_months,
      monthlyAmount: parseFloat(r.monthly_amount),
      totalAmount: parseFloat(r.monthly_amount) * r.tenure_months,
      createdAt: r.created_at
    }));

    res.json({
      data: formatted,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (error) {
    console.error('Get all subscriptions admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: update any subscription status
export const updateSubscriptionAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, monthly_amount, tenure_months } = req.body;

    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const [existing] = await db.query<RowDataPacket[]>('SELECT id FROM subscriptions WHERE id = ?', [id]);
    if (!existing || (existing as any[]).length === 0) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (status) { updates.push('status = ?'); values.push(status); }
    if (monthly_amount !== undefined) { updates.push('monthly_amount = ?'); values.push(monthly_amount); }
    if (tenure_months !== undefined) { updates.push('tenure_months = ?'); values.push(tenure_months); }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    values.push(id);
    await db.query(`UPDATE subscriptions SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, values);

    res.json({ message: 'Subscription updated successfully' });
  } catch (error) {
    console.error('Update subscription admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};