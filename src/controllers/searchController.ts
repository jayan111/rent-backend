import { Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import { getDB } from '../config/database';
import { parseImages, normalizeImageUrls } from '../utils/productJson';

interface ProductRow extends RowDataPacket {
  id: string;
  name: string;
  price: number;
  images: string;
  category_name: string;
}

const API_BASE = process.env.BACKEND_URL || 'http://localhost:8000';

export const searchProducts = async (req: Request, res: Response) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return res.json({ data: [], suggestions: [] });
    }

    const searchTerm = q.trim();
    const limitNum = Math.min(parseInt(limit as string) || 10, 20);

    const db = await getDB();
    if (!db) {
      return res.json({ data: [], suggestions: [], query: q });
    }

    const likeParam = `%${searchTerm}%`;

    const [productRows] = await db.query<ProductRow[]>(
      `SELECT p.id, p.name, p.price, p.images, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.is_active = TRUE AND p.availability = 'available'
         AND (p.name LIKE ? OR p.description LIKE ? OR c.name LIKE ?)
       LIMIT ?`,
      [likeParam, likeParam, likeParam, limitNum]
    );

    const results = productRows.map((row) => {
      const imgs = normalizeImageUrls(parseImages(row.images));
      return {
        id: row.id,
        name: row.name,
        category: row.category_name,
        price: row.price,
        image: imgs[0] || null
      };
    });

    const [suggestionRows] = await db.query<RowDataPacket[]>(
      `SELECT DISTINCT name FROM products WHERE name LIKE ? AND is_active = TRUE LIMIT 8`,
      [likeParam]
    );

    const [catRows] = await db.query<RowDataPacket[]>(
      `SELECT DISTINCT name FROM categories WHERE name LIKE ? AND is_active = TRUE LIMIT 4`,
      [likeParam]
    );

    const suggestions = [
      ...suggestionRows.map((r: any) => r.name),
      ...catRows.map((r: any) => r.name)
    ].slice(0, 10);

    res.json({
      data: results,
      suggestions,
      query: q
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Search failed' });
  }
};

export const getSearchSuggestions = async (req: Request, res: Response) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      return res.json({ suggestions: [] });
    }

    const likeParam = `%${q.trim()}%`;

    const db = await getDB();
    if (!db) {
      return res.json({ suggestions: [] });
    }

    const [productRows] = await db.query<RowDataPacket[]>(
      `SELECT DISTINCT name FROM products WHERE name LIKE ? AND is_active = TRUE LIMIT 8`,
      [likeParam]
    );

    const [catRows] = await db.query<RowDataPacket[]>(
      `SELECT DISTINCT name FROM categories WHERE name LIKE ? AND is_active = TRUE LIMIT 4`,
      [likeParam]
    );

    const suggestions = [
      ...productRows.map((r: any) => r.name),
      ...catRows.map((r: any) => `in ${r.name}`)
    ].slice(0, 8);

    res.json({ suggestions });
  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({ message: 'Failed to get suggestions' });
  }
};
