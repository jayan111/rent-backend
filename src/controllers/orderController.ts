import { Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { AuthenticatedRequest } from '../types';
import { stripe, STRIPE_CONFIG } from '../config/stripe';
import { getDB } from '../config/database';
import { addJob } from '../services/queue';
import { notifyOrderUpdate } from '../services/sse';
import { RowDataPacket } from 'mysql2';
import { sendOrderConfirmationEmail } from '../services/email';

interface OrderRow extends RowDataPacket {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_phone: string;
  items: string;
  total_amount: number;
  subscription_type: string;
  tenure_months: number;
  status: string;
  payment_status: string;
  payment_intent_id: string;
  subscription_id: string;
  delivery_address: string;
  tracking_number: string;
  created_at: Date;
  updated_at: Date;
}

export const createCheckoutSession = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { items, deliveryAddress, subscriptionType, tenureMonths, email, phone } = req.body;
    const userId   = req.user?.id   || null;
    const userName = req.user?.name  || 'Guest';
    const userEmail = req.user?.email || email || 'guest@example.com';
    const userPhone = req.user?.phone || phone || null;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    if (!deliveryAddress?.street || !deliveryAddress?.city || !deliveryAddress?.state || !deliveryAddress?.pincode) {
      return res.status(400).json({ message: 'Delivery address is incomplete (street, city, state, pincode required)' });
    }

    const isSubscription = subscriptionType === 'recurring';

    // Total: monthly_price × qty × tenure for both modes (DB record represents full contract value)
    const totalAmount = items.reduce(
      (sum: number, item: any) => sum + parseFloat(item.product.price) * item.quantity * (item.tenureMonths || tenureMonths || 1),
      0
    );

    // Stripe line items differ by mode:
    // - subscription: bill monthly price each month (no tenure multiplier)
    // - payment: bill the full tenure amount once
    const lineItems = items.map((item: any) => {
      const monthlyPrice = Math.round(parseFloat(item.product.price) * 100); // paise
      const tenureMonthsForItem = item.tenureMonths || tenureMonths || 1;

      const priceData: any = {
        currency: STRIPE_CONFIG.currency,
        product_data: {
          name: item.product.name,
          description: item.product.description?.slice(0, 500) || undefined,
        },
        unit_amount: isSubscription
          ? monthlyPrice                           // billed monthly — Stripe handles recurrence
          : monthlyPrice * tenureMonthsForItem,    // billed once for full tenure
      };

      if (isSubscription) {
        priceData.recurring = { interval: 'month', interval_count: 1 };
      }

      return { price_data: priceData, quantity: item.quantity };
    });

    let session: any;
    try {
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: isSubscription ? 'subscription' : 'payment',
        success_url: `${STRIPE_CONFIG.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: STRIPE_CONFIG.cancelUrl,
        customer_email: userEmail,
        metadata: {
          userId: userId || 'guest',
          subscriptionType,
          tenureMonths: String(tenureMonths || 1),
        },
      });
    } catch (stripeErr: any) {
      console.error('Stripe error:', stripeErr);
      return res.status(502).json({
        message: 'Payment gateway error',
        reason: stripeErr?.message || 'Stripe session creation failed',
        code: stripeErr?.code || stripeErr?.type,
      });
    }

    const orderId = `order_${Date.now()}`;

    try {
      const db = await getDB();
      if (db) {
        await db.query(
          `INSERT INTO orders
             (id, user_id, user_name, user_email, user_phone,
              items, total_amount, subscription_type, tenure_months,
              status, payment_status, payment_intent_id, delivery_address)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?, ?)`,
          [
            orderId, userId, userName, userEmail, userPhone,
            JSON.stringify(items), totalAmount, subscriptionType,
            tenureMonths || 1, session.id, JSON.stringify(deliveryAddress),
          ]
        );
      }
    } catch (dbErr: any) {
      // DB failure is non-fatal — Stripe session is valid; log for ops
      console.error('Order DB insert failed (session still valid):', dbErr.message);
    }

    return res.status(201).json({
      sessionId: session.id,
      url: session.url,
      orderId,
    });
  } catch (error: any) {
    console.error('createCheckoutSession unexpected error:', error);
    return res.status(500).json({
      message: 'Failed to create checkout session',
      reason: error?.message || 'Unexpected server error',
    });
  }
};

export const handleWebhook = async (req: AuthenticatedRequest, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

    switch (event.type) {
      case 'checkout.session.completed':
        await handleSuccessfulPayment(event.data.object as any);
        break;
      case 'invoice.payment_succeeded':
        await handleRecurringPayment(event.data.object as any);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionCancelled(event.data.object as any);
        break;
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(400).json({ message: 'Webhook signature verification failed', reason: error?.message });
  }
};

interface UserRow extends RowDataPacket {
  id: string;
  email: string;
  role: string;
}

async function handleSuccessfulPayment(session: any) {
  try {
    const db = await getDB();
    if (!db) return;

    await db.query(
      `UPDATE orders SET payment_status = 'paid', status = 'confirmed', subscription_id = ?, updated_at = NOW() WHERE payment_intent_id = ?`,
      [session.subscription || null, session.id]
    );

    const [orders] = await db.query<OrderRow[]>('SELECT * FROM orders WHERE payment_intent_id = ?', [session.id]);
    if (!orders?.length) return;

    const order = orders[0];
    const items = tryParseJSON(order.items, []);
    const address = tryParseJSON(order.delivery_address, {});

    // Auto-create account for guest checkouts
    let credentials: { email: string; password: string } | undefined;
    const email = order.user_email;
    const isRealEmail = email && email !== 'guest@example.com' && email.includes('@');

    if (isRealEmail) {
      const [existing] = await db.query<UserRow[]>('SELECT id FROM users WHERE email = ?', [email]);

      if (!existing?.length) {
        // Generate a memorable 8-char temp password: 4 uppercase letters + 4 digits
        const tempPassword =
          crypto.randomBytes(2).toString('hex').toUpperCase() +
          Math.floor(1000 + Math.random() * 9000).toString();

        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        const userId = `user_${Date.now()}`;
        const userName = order.user_name || email.split('@')[0];

        await db.query(
          `INSERT INTO users (id, name, email, phone, password, must_change_password)
           VALUES (?, ?, ?, ?, ?, 1)`,
          [userId, userName, email, order.user_phone || null, hashedPassword]
        );

        // Link the order to the new user account
        await db.query(
          'UPDATE orders SET user_id = ? WHERE payment_intent_id = ?',
          [userId, session.id]
        );

        credentials = { email, password: tempPassword };
      }
    }

    // Send order confirmation email with optional credentials
    try {
      await sendOrderConfirmationEmail({
        to: email,
        orderId: order.id,
        userName: order.user_name || 'Customer',
        items: items.map((item: any) => ({
          name: item.product?.name || 'Product',
          quantity: item.quantity || 1,
          price: parseFloat(item.product?.price || 0),
          tenureMonths: item.tenureMonths || order.tenure_months || 1,
        })),
        totalAmount: order.total_amount,
        deliveryAddress: address,
        credentials,
      });
    } catch (emailErr) {
      console.error('Order confirmation email failed:', emailErr);
    }

    // Queue notification job (non-blocking fallback)
    addJob.email({
      to: email,
      subject: `Order Confirmed — #${order.id.slice(-8).toUpperCase()}`,
      type: 'order_confirmation',
    }).catch(() => {});
  } catch (error) {
    console.error('handleSuccessfulPayment error:', error);
  }
}

async function handleRecurringPayment(invoice: any) {
  try {
    const db = await getDB();
    if (!db) return;

    const [orders] = await db.query<OrderRow[]>('SELECT * FROM orders WHERE subscription_id = ?', [invoice.subscription]);
    if (orders?.length > 0) {
      await addJob.email({
        to: orders[0].user_email,
        subject: 'Subscription Payment Successful',
        message: `Your subscription payment of ₹${invoice.amount_paid / 100} was successful`,
        type: 'payment_success',
      }).catch(console.error);
    }
  } catch (error) {
    console.error('handleRecurringPayment error:', error);
  }
}

async function handleSubscriptionCancelled(subscription: any) {
  try {
    const db = await getDB();
    if (!db) return;
    await db.query(
      `UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE subscription_id = ?`,
      [subscription.id]
    );
  } catch (error) {
    console.error('handleSubscriptionCancelled error:', error);
  }
}

export const getOrders = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDB();
    if (!db) {
      return res.status(503).json({ success: false, message: 'Database unavailable', data: [], total: 0 });
    }

    const userId = req.user?.id;
    const { status, page = 1, limit = 10, email, phone } = req.query;

    let query = 'SELECT * FROM orders';
    const params: any[] = [];
    const conditions: string[] = [];

    if (userId && req.user?.role !== 'admin') {
      conditions.push('user_id = ?');
      params.push(userId);
    } else if (!userId && (email || phone)) {
      const guestConds: string[] = [];
      if (email) { guestConds.push('user_email = ?'); params.push(email); }
      if (phone) { guestConds.push('user_phone = ?'); params.push(phone); }
      if (guestConds.length) conditions.push(`(${guestConds.join(' OR ')})`);
    } else if (req.user?.role !== 'admin' && !email && !phone) {
      return res.json({ success: true, data: [], total: 0 });
    }

    if (status && status !== 'all') {
      conditions.push('status = ?');
      params.push(status);
    }

    if (conditions.length) query += ` WHERE ${conditions.join(' AND ')}`;
    query += ' ORDER BY created_at DESC';

    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total').split('ORDER BY')[0];
    const [countResult] = await db.query<any[]>(countQuery, params);
    const total = countResult[0]?.total || 0;

    const pageNum  = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    query += ' LIMIT ? OFFSET ?';
    params.push(limitNum, (pageNum - 1) * limitNum);

    const [orders] = await db.query<OrderRow[]>(query, params);

    const formattedOrders = (orders || []).map(order => {
      const items = tryParseJSON(order.items, []);
      const address = tryParseJSON(order.delivery_address, {});
      const estimatedDelivery = new Date(order.created_at);
      estimatedDelivery.setDate(estimatedDelivery.getDate() + 5);

      return {
        orderId: order.id,
        status: order.status?.toUpperCase(),
        createdAt: order.created_at,
        user: { userId: order.user_id, name: order.user_name, email: order.user_email, phone: order.user_phone },
        items: items.map((item: any) => ({
          productId: item.product?.id,
          name: item.product?.name,
          quantity: item.quantity,
          price: item.product?.price,
          tenureMonths: item.tenureMonths || 1,
          total: parseFloat(item.product?.price || 0) * item.quantity * (item.tenureMonths || 1),
        })),
        pricing: {
          subtotal: order.total_amount,
          discount: 0,
          tax: Math.round(order.total_amount * 0.18),
          deliveryFee: 0,
          grandTotal: order.total_amount,
        },
        payment: {
          paymentId: order.payment_intent_id,
          method: order.subscription_type === 'recurring' ? 'SUBSCRIPTION' : 'ONE_TIME',
          status: order.payment_status?.toUpperCase(),
          transactionId: order.payment_intent_id,
        },
        shippingAddress: {
          addressLine1: address.street,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          country: 'India',
        },
        estimatedDelivery: estimatedDelivery.toISOString().split('T')[0],
        tenureMonths: order.tenure_months,
        trackingNumber: order.tracking_number,
      };
    });

    const totalPages = Math.ceil(total / limitNum);
    res.json({
      success: true,
      data: formattedOrders,
      pagination: { total, page: pageNum, totalPages, hasMore: pageNum < totalPages, limit: limitNum },
    });
  } catch (error: any) {
    console.error('getOrders error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch orders', reason: error?.message });
  }
};

export const getOrderById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDB();
    if (!db) {
      return res.status(503).json({ success: false, message: 'Database unavailable' });
    }

    const [orders] = await db.query<OrderRow[]>('SELECT * FROM orders WHERE id = ?', [id]);
    if (!orders?.length) {
      return res.status(404).json({ success: false, message: `Order '${id}' not found` });
    }

    const order = orders[0];
    if (req.user?.role !== 'admin' && order.user_id !== req.user?.id) {
      return res.status(403).json({ success: false, message: 'Access denied — this order belongs to another user' });
    }

    const items = tryParseJSON(order.items, []);
    const address = tryParseJSON(order.delivery_address, {});
    const estimatedDelivery = new Date(order.created_at);
    estimatedDelivery.setDate(estimatedDelivery.getDate() + 5);

    res.json({
      success: true,
      order: {
        orderId: order.id,
        status: order.status?.toUpperCase(),
        createdAt: order.created_at,
        user: { userId: order.user_id, name: order.user_name, email: order.user_email },
        items: items.map((item: any) => ({
          productId: item.product?.id,
          name: item.product?.name,
          quantity: item.quantity,
          price: item.product?.price,
          total: parseFloat(item.product?.price || 0) * item.quantity * (item.tenureMonths || 1),
        })),
        pricing: {
          subtotal: order.total_amount,
          discount: 0,
          tax: Math.round(order.total_amount * 0.18),
          deliveryFee: 0,
          grandTotal: order.total_amount,
        },
        payment: {
          paymentId: order.payment_intent_id,
          method: order.subscription_type === 'recurring' ? 'SUBSCRIPTION' : 'ONE_TIME',
          status: order.payment_status?.toUpperCase(),
          transactionId: order.payment_intent_id,
        },
        shippingAddress: { addressLine1: address.street, city: address.city, state: address.state, pincode: address.pincode, country: 'India' },
        estimatedDelivery: estimatedDelivery.toISOString().split('T')[0],
        tenureMonths: order.tenure_months,
      },
    });
  } catch (error: any) {
    console.error('getOrderById error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch order', reason: error?.message });
  }
};

export const updateOrderStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const VALID_STATUSES = ['pending', 'confirmed', 'processing', 'delivered', 'active', 'cancelled', 'returned'];
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const db = await getDB();
    if (!db) return res.status(503).json({ message: 'Database unavailable' });

    const [existing] = await db.query<OrderRow[]>('SELECT id FROM orders WHERE id = ?', [id]);
    if (!existing?.length) {
      return res.status(404).json({ message: `Order '${id}' not found` });
    }

    await db.query('UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?', [status, id]);
    notifyOrderUpdate(id, status);

    const [orders] = await db.query<OrderRow[]>('SELECT * FROM orders WHERE id = ?', [id]);
    if (orders?.length) {
      await addJob.email({
        to: orders[0].user_email,
        subject: 'Order Status Updated',
        message: `Your order ${orders[0].id} status has changed to: ${status}`,
        type: 'status_update',
      }).catch(console.error);
    }

    res.json({ message: 'Order status updated', status, orderId: id });
  } catch (error: any) {
    console.error('updateOrderStatus error:', error);
    res.status(500).json({ message: 'Failed to update order status', reason: error?.message });
  }
};

export const cancelSubscription = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDB();
    if (!db) return res.status(503).json({ message: 'Database unavailable' });

    const [orders] = await db.query<OrderRow[]>('SELECT * FROM orders WHERE id = ?', [id]);
    if (!orders?.length) {
      return res.status(404).json({ message: `Order '${id}' not found` });
    }

    const order = orders[0];

    if (order.subscription_id) {
      try {
        await stripe.subscriptions.cancel(order.subscription_id);
      } catch (stripeErr: any) {
        console.error('Stripe subscription cancellation failed:', stripeErr.message);
        // Continue — cancel in DB regardless
      }
    }

    await db.query('UPDATE orders SET status = "cancelled", updated_at = NOW() WHERE id = ?', [id]);

    res.json({ message: 'Subscription cancelled', orderId: id });
  } catch (error: any) {
    console.error('cancelSubscription error:', error);
    res.status(500).json({ message: 'Failed to cancel subscription', reason: error?.message });
  }
};

export const getAdminOrders = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDB();
    if (!db) return res.status(503).json({ message: 'Database unavailable', data: [], total: 0 });

    const { status, page = 1, limit = 50 } = req.query;
    const pageNum  = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset   = (pageNum - 1) * limitNum;

    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (status && status !== 'all') { where += ' AND status = ?'; params.push(status); }

    const [countRows] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) as total FROM orders ${where}`, params);
    const total = (countRows[0] as any).total;

    const [rows] = await db.query<OrderRow[]>(
      `SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    const data = (rows || []).map(order => ({
      id: order.id,
      user_id: order.user_id,
      user_name: order.user_name,
      user_email: order.user_email,
      user_phone: order.user_phone,
      items: order.items,
      total_amount: order.total_amount,
      subscription_type: order.subscription_type,
      tenure_months: order.tenure_months,
      status: order.status,
      payment_status: order.payment_status,
      delivery_address: order.delivery_address,
      tracking_number: order.tracking_number,
      created_at: order.created_at,
    }));

    res.json({ data, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (error: any) {
    console.error('getAdminOrders error:', error);
    res.status(500).json({ message: 'Failed to fetch orders', reason: error?.message, data: [], total: 0 });
  }
};

export const getOrderStats = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDB();
    if (!db) return res.status(503).json({ message: 'Database unavailable' });

    const [stats] = await db.query<any[]>(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending'   THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'active'    THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) as totalRevenue,
        SUM(CASE WHEN subscription_type = 'recurring' AND status = 'active' THEN total_amount ELSE 0 END) as recurringRevenue
      FROM orders
    `);

    res.json({ data: stats?.[0] || {} });
  } catch (error: any) {
    console.error('getOrderStats error:', error);
    res.status(500).json({ message: 'Failed to fetch order stats', reason: error?.message });
  }
};

function tryParseJSON(raw: string | null | undefined, fallback: any) {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}
