import { Request, Response } from 'express';
import { getDB } from '../config/database';
import { AuthenticatedRequest } from '../types';
import { RowDataPacket } from 'mysql2';

interface CategoryRow extends RowDataPacket {
  id: string;
  name: string;
  description: string;
  image: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  product_count?: number;
}

export const getCategories = async (req: Request, res: Response) => {
  try {
    const db = await getDB();
    if (!db) {
      return res.status(500).json({ message: 'Database connection failed' });
    }

    const [categories] = await db.query<CategoryRow[]>(`
      SELECT c.*, COUNT(p.id) as product_count 
      FROM categories c 
      LEFT JOIN products p ON c.id = p.category_id AND p.is_active = TRUE AND p.availability = 'available'
      WHERE c.is_active = TRUE 
      GROUP BY c.id
      ORDER BY c.name
    `);

    const formattedCategories = categories.map(category => ({
      id: category.id,
      name: category.name,
      description: category.description,
      image: category.image,
      productCount: category.product_count || 0
    }));

    res.json({ data: formattedCategories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createCategory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, image } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Category name is required' });
    }
    
    const db = await getDB();
    if (!db) {
      return res.status(500).json({ message: 'Database connection failed' });
    }
    
    const categoryId = name.toLowerCase().replace(/\s+/g, '-');
    
    await db.query(
      'INSERT INTO categories (id, name, description, image) VALUES (?, ?, ?, ?)',
      [categoryId, name, description, image]
    );
    
    res.status(201).json({
      message: 'Category created successfully',
      data: { id: categoryId, name, description, image }
    });
  } catch (error: any) {
    console.error('Create category error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Category already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateCategory = async (req: AuthenticatedRequest, res: Response) => {
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
      if (key !== 'id') {
        updateFields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    });
    
    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }
    
    values.push(id);
    
    await db.query(
      `UPDATE categories SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );
    
    res.json({ message: 'Category updated successfully' });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteCategory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const db = await getDB();
    if (!db) {
      return res.status(500).json({ message: 'Database connection failed' });
    }
    
    // Check if category has products
    const [products] = await db.query<any[]>(
      'SELECT COUNT(*) as count FROM products WHERE category_id = ? AND is_active = TRUE',
      [id]
    );
    
    if (products[0].count > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete category with active products' 
      });
    }
    
    await db.query('UPDATE categories SET is_active = FALSE WHERE id = ?', [id]);
    
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};