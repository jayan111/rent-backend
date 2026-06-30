import { Request, Response } from 'express';
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

export const getProducts = async (req: Request, res: Response) => {
  try {
    const { 
      category, 
      minPrice, 
      search, 
      sortBy = 'relevance',
      rating,
      page = 1,
      limit = 9
    } = req.query;
    
    const db = await getDB();
    if (!db) {
      return res.status(500).json({ message: 'Database connection failed' });
    }

    let query = `
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.is_active = TRUE AND p.availability = 'available'
    `;
    const params: any[] = [];
    
    if (search) {
      query += ` AND (p.name LIKE ? OR p.description LIKE ? OR c.name LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (category && category !== 'all') {
      query += ` AND p.category_id = ?`;
      params.push(category);
    }
    
    if (minPrice) {
      query += ` AND p.price >= ?`;
      params.push(parseFloat(minPrice as string));
    }

    if (req.query.maxPrice) {
      query += ` AND p.price <= ?`;
      params.push(parseFloat(req.query.maxPrice as string));
    }

    if (rating) {
      query += ` AND p.rating >= ?`;
      params.push(parseFloat(rating as string));
    }
    
    // Sorting
    switch (sortBy) {
      case 'price-low':
        query += ` ORDER BY p.price ASC`;
        break;
      case 'price-high':
        query += ` ORDER BY p.price DESC`;
        break;
      case 'rating':
        query += ` ORDER BY p.rating DESC`;
        break;
      case 'newest':
        query += ` ORDER BY p.created_at DESC`;
        break;
      default:
        query += ` ORDER BY p.created_at DESC`;
        break;
    }
    
    // Count total products for pagination
    const countQuery = query.replace('SELECT p.*, c.name as category_name', 'SELECT COUNT(*) as total').split('ORDER BY')[0];
    const [countResult] = await db.query<any[]>(countQuery, params);
    const total = countResult[0]?.total || 0;
    
    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;
    
    query += ` LIMIT ? OFFSET ?`;
    params.push(limitNum, offset);
    
    const [products] = await db.query<ProductRow[]>(query, params);
    
    const formattedProducts = products.map(product => {
      const parsedImages = normalizeImageUrls(parseImages(product.images));
      const parsedSubscriptionDurations = parseSubscriptionDurations(product.subscription_durations);
      
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
        images: parsedImages,
        condition: product.condition_type,
        condition_type: product.condition_type,
        location: product.location,
        availability: product.availability,
        subscriptionDurations: parsedSubscriptionDurations,
        created_at: product.created_at,
        updated_at: product.updated_at
      };
    });

    const totalPages = Math.ceil(total / limitNum);
    const hasMore = pageNum < totalPages;
    
    const response = {
      data: formattedProducts,
      total,
      page: pageNum,
      totalPages,
      hasMore,
      limit: limitNum
    };
    
    res.json(response);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDB();
    
    if (!db) {
      return res.status(500).json({ message: 'Database connection failed' });
    }
    
    const [products] = await db.query<ProductRow[]>(
      `SELECT p.*, c.name as category_name 
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       WHERE p.id = ? AND p.is_active = TRUE`,
      [id]
    );
    
    if (!products || products.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    const product = products[0];
    const parsedImages = normalizeImageUrls(parseImages(product.images));
    const parsedSubscriptionDurations = parseSubscriptionDurations(product.subscription_durations);
    
    const formattedProduct = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category_id,
      categoryName: product.category_name,
      stock: product.stock,
      rating: product.rating,
      reviews: product.reviews,
      images: parsedImages,
      condition: product.condition_type,
      condition_type: product.condition_type,
      location: product.location,
      availability: product.availability,
      subscriptionDurations: parsedSubscriptionDurations,
      created_at: product.created_at,
      updated_at: product.updated_at
    };

    res.json({ data: formattedProduct });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createProduct = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      name, 
      description, 
      price, 
      category, // Accept category instead of category_id
      stock, 
      images, 
      condition = 'Good', // Accept condition instead of condition_type
      location,
      subscription_durations = [3, 6, 12]
    } = req.body;
    
    if (!name || !price || !category) {
      return res.status(400).json({ message: 'Name, price, and category are required' });
    }
    
    const db = await getDB();
    if (!db) {
      return res.status(500).json({ message: 'Database connection failed' });
    }
    
    const productId = `product_${Date.now()}`;
    
    await db.query(
      `INSERT INTO products (id, name, description, price, category_id, stock, images, condition_type, location, subscription_durations) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        productId, 
        name, 
        description, 
        price, 
        category, // Use category as category_id
        stock || 0, 
        JSON.stringify(images || []), 
        condition, // Use condition as condition_type
        location,
        JSON.stringify(subscription_durations)
      ]
    );
    
    // Get the created product with all details
    const [products] = await db.query<ProductRow[]>(
      `SELECT p.*, c.name as category_name 
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       WHERE p.id = ?`,
      [productId]
    );
    
    if (!products || products.length === 0) {
      return res.status(500).json({ message: 'Failed to retrieve created product' });
    }
    
    const product = products[0];
    const parsedImages = normalizeImageUrls(parseImages(product.images));
    const parsedSubscriptionDurations = parseSubscriptionDurations(product.subscription_durations);
    
    const formattedProduct = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category_id,
      categoryName: product.category_name,
      stock: product.stock,
      rating: product.rating,
      reviews: product.reviews,
      images: parsedImages,
      condition: product.condition_type,
      location: product.location,
      availability: product.availability,
      subscriptionDurations: parsedSubscriptionDurations,
      created_at: product.created_at,
      updated_at: product.updated_at
    };
    
    // Try to invalidate cache, but don't fail if it doesn't work
    try {
      await invalidateCache.products();
    } catch (cacheError) {
      console.log('Cache invalidation failed:', cacheError);
    }
    
    // Try to add analytics job, but don't fail if it doesn't work
    try {
      await addJob.analytics({
        event: 'product_created',
        userId: req.user?.id || 'admin',
        data: { productId, category, price }
      });
    } catch (queueError) {
      console.log('Analytics job failed:', queueError);
    }
    
    res.status(201).json({
      message: 'Product created successfully',
      data: formattedProduct
    });
  } catch (error: any) {
    console.error('Create product error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const updateProduct = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const db = await getDB();
    if (!db) {
      return res.status(500).json({ message: 'Database connection failed' });
    }
    
    const updateFields: string[] = [];
    const values: any[] = [];
    
    Object.keys(updates).forEach(key => {
      if (['images', 'subscription_durations'].includes(key)) {
        updateFields.push(`${key} = ?`);
        values.push(JSON.stringify(updates[key]));
      } else if (key !== 'id') {
        updateFields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    });
    
    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }
    
    values.push(id);
    
    await db.query(
      `UPDATE products SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );
    
    await invalidateCache.product(id);
    
    if (updates.stock !== undefined) {
      await addJob.inventory({
        productId: id,
        action: 'stock_update',
        quantity: updates.stock
      });
    }
    
    res.json({ message: 'Product updated successfully' });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteProduct = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const db = await getDB();
    if (!db) {
      return res.status(500).json({ message: 'Database connection failed' });
    }
    
    await db.query('UPDATE products SET is_active = FALSE WHERE id = ?', [id]);
    
    await invalidateCache.product(id);
    
    await addJob.analytics({
      event: 'product_deleted',
      userId: req.user?.id || 'admin',
      data: { productId: id }
    });
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};