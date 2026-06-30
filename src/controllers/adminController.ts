import { Response } from 'express';
import { RowDataPacket } from 'mysql2';
import { AuthenticatedRequest } from '../types';
import { getDB } from '../config/database';

export const getDashboardStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const [revenueRows, subscriptionRows, inventoryRows, userRows, orderRows] = await Promise.all([
      db.query<RowDataPacket[]>(
        `SELECT
          COALESCE(SUM(CASE WHEN payment_status='paid' THEN total_amount ELSE 0 END), 0) as totalRevenue,
          COALESCE(SUM(CASE WHEN payment_status='paid' AND created_at >= DATE_FORMAT(NOW(),'%Y-%m-01') THEN total_amount ELSE 0 END), 0) as monthlyRevenue,
          COALESCE(SUM(CASE WHEN payment_status='paid' AND created_at >= DATE_SUB(DATE_FORMAT(NOW(),'%Y-%m-01'), INTERVAL 3 MONTH) THEN total_amount ELSE 0 END), 0) as quarterlyRevenue
         FROM orders`

      ),
      db.query<RowDataPacket[]>(
        `SELECT status, COUNT(*) as count FROM subscriptions GROUP BY status`
      ),
      db.query<RowDataPacket[]>(
        `SELECT status, COUNT(*) as count FROM inventory GROUP BY status`
      ),
      db.query<RowDataPacket[]>(
        `SELECT COUNT(*) as total, SUM(CASE WHEN is_active=TRUE THEN 1 ELSE 0 END) as active FROM users`
      ),
      db.query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM orders`
      )
    ]);

    const revenue = (revenueRows[0] as any)[0] || {};
    const subscriptionCounts: Record<string, number> = {};
    (subscriptionRows[0] as any[]).forEach((r: any) => { subscriptionCounts[r.status] = parseInt(r.count); });
    const inventoryCounts: Record<string, number> = {};
    (inventoryRows[0] as any[]).forEach((r: any) => { inventoryCounts[r.status] = parseInt(r.count); });
    const userStats = (userRows[0] as any)[0] || {};

    const totalSubs = Object.values(subscriptionCounts).reduce((a, b) => a + b, 0);
    const totalInv = Object.values(inventoryCounts).reduce((a, b) => a + b, 0);

    // Calculate growth: compare this month vs last month
    const [growthRows] = await db.query<RowDataPacket[]>(
      `SELECT
        COALESCE(SUM(CASE WHEN created_at >= DATE_FORMAT(NOW(),'%Y-%m-01') AND payment_status='paid' THEN total_amount ELSE 0 END), 0) as thisMonth,
        COALESCE(SUM(CASE WHEN created_at >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH),'%Y-%m-01')
          AND created_at < DATE_FORMAT(NOW(),'%Y-%m-01') AND payment_status='paid' THEN total_amount ELSE 0 END), 0) as lastMonth
       FROM orders`
    );
    const growthData = (growthRows as any)[0] || {};
    const growth = growthData.lastMonth > 0
      ? parseFloat((((growthData.thisMonth - growthData.lastMonth) / growthData.lastMonth) * 100).toFixed(1))
      : 0;

    res.json({
      data: {
        revenue: {
          monthly: parseFloat(revenue.monthlyRevenue) || 0,
          quarterly: parseFloat(revenue.quarterlyRevenue) || 0,
          yearly: parseFloat(revenue.totalRevenue) || 0,
          growth
        },
        subscriptions: {
          active: subscriptionCounts['active'] || 0,
          paused: subscriptionCounts['paused'] || 0,
          cancelled: subscriptionCounts['cancelled'] || 0,
          expired: subscriptionCounts['expired'] || 0,
          total: totalSubs
        },
        inventory: {
          total: totalInv,
          available: inventoryCounts['available'] || 0,
          rented: inventoryCounts['rented'] || 0,
          maintenance: inventoryCounts['maintenance'] || 0,
          damaged: inventoryCounts['damaged'] || 0
        },
        users: {
          total: parseInt(userStats.total) || 0,
          active: parseInt(userStats.active) || 0,
          verified: parseInt(userStats.active) || 0,
          pending: 0,
          rejected: 0
        },
        orders: {
          total: parseInt(((orderRows[0] as any)[0] || {}).total) || 0
        }
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getRevenueAnalytics = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT
        DATE_FORMAT(created_at, '%Y-%m') as month,
        DATE_FORMAT(created_at, '%b %Y') as label,
        COALESCE(SUM(CASE WHEN payment_status='paid' THEN total_amount ELSE 0 END), 0) as revenue,
        COUNT(*) as orders,
        SUM(CASE WHEN subscription_type='recurring' THEN 1 ELSE 0 END) as recurringOrders
       FROM orders
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY month ASC`
    );

    const analytics = (rows as any[]).map((r: any) => ({
      month: r.label,
      revenue: parseFloat(r.revenue),
      orders: parseInt(r.orders),
      recurringOrders: parseInt(r.recurringOrders)
    }));

    res.json({ data: { analytics } });
  } catch (error) {
    console.error('Get revenue analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getInventoryAnalytics = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const [totalRows] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total, SUM(CASE WHEN status='rented' THEN 1 ELSE 0 END) as rented FROM inventory`
    );

    const stats = (totalRows as any)[0] || {};
    const total = parseInt(stats.total) || 0;
    const rented = parseInt(stats.rented) || 0;
    const utilizationRate = total > 0 ? parseFloat(((rented / total) * 100).toFixed(1)) : 0;

    const [topProducts] = await db.query<RowDataPacket[]>(
      `SELECT p.id as productId, p.name, COUNT(s.id) as rentals, COALESCE(SUM(s.monthly_amount), 0) as revenue
       FROM products p
       LEFT JOIN subscriptions s ON p.id = s.product_id AND s.status='active'
       WHERE p.is_active = TRUE
       GROUP BY p.id, p.name
       ORDER BY rentals DESC
       LIMIT 5`
    );

    res.json({
      data: {
        utilizationRate,
        topPerformingProducts: (topProducts as any[]).map((r: any) => ({
          productId: r.productId,
          name: r.name,
          rentals: parseInt(r.rentals),
          revenue: parseFloat(r.revenue)
        }))
      }
    });
  } catch (error) {
    console.error('Get inventory analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getCustomerAnalytics = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT
        COALESCE(AVG(user_total), 0) as avgLifetimeValue,
        COUNT(CASE WHEN sub_count = 0 THEN 1 END) as churned,
        COUNT(*) as total
       FROM (
         SELECT u.id, COALESCE(SUM(o.total_amount), 0) as user_total,
           COUNT(s.id) as sub_count
         FROM users u
         LEFT JOIN orders o ON u.id = o.user_id AND o.payment_status='paid'
         LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status='active'
         WHERE u.role = 'user'
         GROUP BY u.id
       ) t`
    );

    const stats = (rows as any)[0] || {};
    const churnRate = stats.total > 0
      ? parseFloat(((parseInt(stats.churned) / parseInt(stats.total)) * 100).toFixed(1))
      : 0;

    res.json({
      data: {
        customerLifetimeValue: parseFloat(stats.avgLifetimeValue) || 0,
        churnRate
      }
    });
  } catch (error) {
    console.error('Get customer analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getOperationalMetrics = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const [onTimeRows] = await db.query<RowDataPacket[]>(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status IN ('delivered','active') THEN 1 ELSE 0 END) as onTime
       FROM orders
       WHERE status != 'cancelled'`
    );

    const opStats = (onTimeRows as any)[0] || {};
    const total = parseInt(opStats.total) || 0;
    const onTime = parseInt(opStats.onTime) || 0;
    const onTimeRate = total > 0 ? parseFloat(((onTime / total) * 100).toFixed(1)) : 0;

    res.json({
      data: {
        deliveryMetrics: {
          averageDeliveryTime: 2.5,
          onTimeDeliveryRate: onTimeRate
        }
      }
    });
  } catch (error) {
    console.error('Get operational metrics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getInventoryAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT i.*, p.name as product_name
       FROM inventory i
       LEFT JOIN products p ON i.product_id = p.id
       ORDER BY i.created_at DESC
       LIMIT 100`
    );

    res.json({ data: rows });
  } catch (error) {
    console.error('Get inventory admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateInventoryItem = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, condition_notes, location } = req.body;

    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const updates: string[] = [];
    const values: any[] = [];

    if (status) { updates.push('status = ?'); values.push(status); }
    if (condition_notes !== undefined) { updates.push('condition_notes = ?'); values.push(condition_notes); }
    if (location !== undefined) { updates.push('location = ?'); values.push(location); }

    if (updates.length > 0) {
      values.push(id);
      await db.query(`UPDATE inventory SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    res.json({
      message: 'Inventory item updated successfully',
      data: { id, ...req.body, updated_at: new Date() }
    });
  } catch (error) {
    console.error('Update inventory item error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const bulkUpdateInventory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { items, action } = req.body;

    if (!items || !Array.isArray(items) || !action) {
      return res.status(400).json({ message: 'items array and action are required' });
    }

    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    for (const itemId of items) {
      await db.query('UPDATE inventory SET status = ? WHERE id = ?', [action, itemId]);
    }

    res.json({
      message: `Bulk ${action} completed successfully`,
      data: { updatedCount: items.length }
    });
  } catch (error) {
    console.error('Bulk update inventory error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
