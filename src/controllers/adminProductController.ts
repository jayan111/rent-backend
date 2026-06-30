import { Response } from 'express';
import { getDB } from '../config/database';
import { AuthenticatedRequest } from '../types';
import { invalidateCache } from '../middleware/cache';
import { addJob } from '../services/queue';
import { RowDataPacket } from 'mysql2';
import { parseImages, parseSubscriptionDurations, normalizeImageUrls } from '../utils/productJson';

interface ProductRow extends RowDataPacket {
  id: string;
  name: string;
  description: string;
  price: number;
  category_id: string;
  stock: number;
  rating: number;
  reviews: number;
  images: string | string[] | null;
  condition_type: string;
  location: string;
  availability: string;
  subscription_durations: string | number[] | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  category_name?: string;
}

/** Convert raw DB product row → clean API response shape */
function formatProduct(product: ProductRow) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    category: product.category_id,
    categoryName: product.category_name,
    stock: product.stock,
    rating: product.rating,
    reviews: product.reviews,
    images: normalizeImageUrls(parseImages(product.images)),   // always correct URLs
    condition: product.condition_type,
    location: product.location,
    availability: product.availability,
    subscriptionDurations: parseSubscriptionDurations(product.subscription_durations),
    is_active: product.is_active,
    created_at: product.created_at,
    updated_at: product.updated_at,
  };
}

/** Parse images safely from request body (handles JSON string, array, or comma-separated) */
function parseBodyImages(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  const s = String(raw).trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [String(parsed)];
    } catch { /* fall through */ }
  }
  if (s.includes(',')) return s.split(',').map(x => x.trim()).filter(Boolean);
  return [s];
}

/** Strip localhost prefix so only relative paths are stored; keep external URLs unchanged */
function toRelativePath(img: string): string {
  // External URLs (Unsplash, S3, CDN, etc.) — store as-is
  if (img.startsWith('http') && !img.match(/^https?:\/\/localhost/i)) return img;
  // Local: strip scheme+host to get relative path
  return img
    .replace(/^https?:\/\/localhost(:\d+)?\//, '')
    .replace(/^\/+/, '')
    .replace(/\\/g, '/');
}

export const getAdminProducts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      category,
      minPrice,
      maxPrice,
      search,
      sortBy = 'relevance',
      rating,
      page = 1,
      limit = 50,
      status = 'all',
    } = req.query;

    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    let query = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status === 'all') {
      // Default: show only active (non-deleted) products
      query += ` AND p.is_active = TRUE`;
    } else if (status === 'active') {
      query += ` AND p.is_active = TRUE`;
    } else if (status === 'inactive') {
      query += ` AND p.is_active = FALSE`;
    } else {
      // e.g. available / rented / maintenance / retired
      query += ` AND p.is_active = TRUE AND p.availability = ?`;
      params.push(status);
    }

    if (search) {
      query += ` AND (p.name LIKE ? OR p.description LIKE ? OR c.name LIKE ?)`;
      const t = `%${search}%`;
      params.push(t, t, t);
    }

    if (category && category !== 'all') {
      query += ` AND p.category_id = ?`;
      params.push(category);
    }

    if (minPrice) {
      query += ` AND p.price >= ?`;
      params.push(parseFloat(minPrice as string));
    }

    if (maxPrice) {
      query += ` AND p.price <= ?`;
      params.push(parseFloat(maxPrice as string));
    }

    if (rating) {
      query += ` AND p.rating >= ?`;
      params.push(parseFloat(rating as string));
    }

    switch (sortBy) {
      case 'price-low':  query += ` ORDER BY p.price ASC`;      break;
      case 'price-high': query += ` ORDER BY p.price DESC`;     break;
      case 'rating':     query += ` ORDER BY p.rating DESC`;    break;
      case 'newest':     query += ` ORDER BY p.created_at DESC`; break;
      default:           query += ` ORDER BY p.created_at DESC`; break;
    }

    const countQuery = query
      .replace('SELECT p.*, c.name as category_name', 'SELECT COUNT(*) as total')
      .split('ORDER BY')[0];
    const [countResult] = await db.query<any[]>(countQuery, params);
    const total = countResult[0]?.total || 0;

    const pageNum  = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset   = (pageNum - 1) * limitNum;

    query += ` LIMIT ? OFFSET ?`;
    params.push(limitNum, offset);

    const [products] = await db.query<ProductRow[]>(query, params);

    res.json({
      data: products.map(formatProduct),
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      hasMore: pageNum < Math.ceil(total / limitNum),
      limit: limitNum,
    });
  } catch (error) {
    console.error('Get admin products error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createAdminProduct = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, price, category, stock, condition = 'Good', location, availability = 'available' } = req.body;

    if (!name || !price || !category) {
      return res.status(400).json({ message: 'Name, price, and category are required' });
    }

    const multerFiles = (req.files as Express.Multer.File[]) || [];
    let images: string[] = multerFiles.map(f => `uploads/${f.filename}`);

    if (!images.length) {
      // No files uploaded — try body field
      images = parseBodyImages(req.body.images).map(toRelativePath);
    }

    const subscriptionDurations = parseSubscriptionDurations(
      req.body.subscription_durations ?? req.body.subscriptionDurations
    );

    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const productId = `product_${Date.now()}`;

    await db.query(
      `INSERT INTO products (id, name, description, price, category_id, stock, images, condition_type, location, availability, subscription_durations)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        productId,
        name,
        description,
        parseFloat(price),
        category,
        parseInt(stock) || 0,
        JSON.stringify(images),
        condition,
        location,
        availability,
        JSON.stringify(subscriptionDurations),
      ]
    );

    const [rows] = await db.query<ProductRow[]>(
      `SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?`,
      [productId]
    );

    if (!rows || rows.length === 0) {
      return res.status(500).json({ message: 'Failed to retrieve created product' });
    }

    try { await invalidateCache.products(); } catch { /* non-fatal */ }

    try {
      await addJob.analytics({
        event: 'product_created',
        userId: req.user?.id || 'admin',
        data: { productId, category, price: parseFloat(price) },
      });
    } catch { /* non-fatal */ }

    res.status(201).json({ message: 'Product created successfully', data: formatProduct(rows[0]) });
  } catch (error: any) {
    console.error('Create admin product error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const updateAdminProduct = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    // Verify product exists
    const [existing] = await db.query<ProductRow[]>('SELECT id FROM products WHERE id = ? AND is_active = TRUE', [id]);
    if (!existing || (existing as any[]).length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const updates: Record<string, any> = { ...req.body };

    // --- Image handling (fix: use 'existingImages' to avoid multer collision) ---
    const multerFiles = (req.files as Express.Multer.File[]) || [];
    const newImagePaths = multerFiles.map(f => `uploads/${f.filename}`);

    // existingImages field carries the paths the client wants to keep
    const existingPaths = parseBodyImages(updates.existingImages).map(toRelativePath);
    delete updates.existingImages; // don't try to store this as a DB column

    // Merge kept + new images
    if (newImagePaths.length > 0 || 'existingImages' in req.body) {
      updates.images = [...existingPaths, ...newImagePaths];
    } else if (updates.images !== undefined) {
      // Fallback: images sent directly (parse safely, no double-encode)
      updates.images = parseBodyImages(updates.images).map(toRelativePath);
    }

    // --- Build UPDATE query ---
    const allowedKeys = [
      'name', 'description', 'price', 'stock', 'availability', 'is_active',
      'images', 'subscription_durations', 'category', 'condition', 'location',
    ];

    const updateFields: string[] = [];
    const values: any[] = [];

    for (const key of Object.keys(updates)) {
      if (!allowedKeys.includes(key)) continue;
      const val = updates[key];

      if (key === 'images' || key === 'subscription_durations') {
        updateFields.push(`${key} = ?`);
        // Always store as JSON — never double-encode
        values.push(Array.isArray(val) ? JSON.stringify(val) : JSON.stringify(parseBodyImages(val)));
      } else if (key === 'category') {
        updateFields.push('category_id = ?');
        values.push(val);
      } else if (key === 'condition') {
        updateFields.push('condition_type = ?');
        values.push(val);
      } else {
        updateFields.push(`${key} = ?`);
        values.push(val);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    values.push(id);
    await db.query(
      `UPDATE products SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );

    try { await invalidateCache.product(id); } catch { /* non-fatal */ }

    if (updates.stock !== undefined) {
      try {
        await addJob.inventory({ productId: id, action: 'stock_update', quantity: updates.stock });
      } catch { /* non-fatal */ }
    }

    // Return refreshed product from DB
    const [rows] = await db.query<ProductRow[]>(
      `SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?`,
      [id]
    );

    res.json({ message: 'Product updated successfully', data: formatProduct(rows[0]) });
  } catch (error: any) {
    console.error('Update admin product error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const deleteAdminProduct = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const [existing] = await db.query<ProductRow[]>('SELECT id FROM products WHERE id = ?', [id]);
    if (!existing || (existing as any[]).length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await db.query('UPDATE products SET is_active = FALSE, updated_at = NOW() WHERE id = ?', [id]);

    try { await invalidateCache.product(id); } catch { /* non-fatal */ }
    try { await invalidateCache.products(); } catch { /* non-fatal */ }

    try {
      await addJob.analytics({
        event: 'product_deleted',
        userId: req.user?.id || 'admin',
        data: { productId: id },
      });
    } catch { /* non-fatal */ }

    res.json({ message: 'Product deleted successfully' });
  } catch (error: any) {
    console.error('Delete admin product error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const uploadAdminImage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image file provided' });
    res.json({ url: `uploads/${req.file.filename}` });
  } catch (error: any) {
    console.error('Upload admin image error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
