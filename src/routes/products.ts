import { Router, Request, Response } from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
} from '../controllers/productController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { cacheProducts, cacheProduct } from '../middleware/cache';
import { rateLimits } from '../middleware/rateLimiting';
import { getDB } from '../config/database';
import { parseImages, normalizeImageUrls, parseSubscriptionDurations } from '../utils/productJson';
import { RowDataPacket } from 'mysql2';

interface FeaturedProductRow extends RowDataPacket {
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
  category_name?: string;
}

const router = Router();

// Apply rate limiting
router.use(rateLimits.products);

// Override the global Cache-Control so browsers never serve stale product data.
// Redis still provides server-side caching (invalidated on admin updates).
router.use((req: Request, res: Response, next) => {
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// GET /featured — returns 8 highest-rated products for TrendingProducts component
router.get('/featured', async (req: Request, res: Response) => {
  try {
    const db = await getDB();
    if (!db) {
      return res.status(500).json({ message: 'Database connection failed' });
    }

    const [products] = await db.query<FeaturedProductRow[]>(
      `SELECT p.*, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.is_active = TRUE AND p.availability = 'available'
       ORDER BY p.rating DESC
       LIMIT 8`
    );

    const formattedProducts = products.map(product => ({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category_id,
      categoryName: product.category_name,
      stock: product.stock,
      rating: product.rating,
      reviews: product.reviews,
      images: normalizeImageUrls(parseImages(product.images)),
      condition: product.condition_type,
      condition_type: product.condition_type,
      location: product.location,
      availability: product.availability,
      subscriptionDurations: parseSubscriptionDurations(product.subscription_durations),
    }));

    res.json({ data: formattedProducts });
  } catch (error) {
    console.error('Get featured products error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', cacheProducts, getProducts);
router.get('/:id', cacheProduct, getProductById);
router.post('/', authenticateToken, requireAdmin, createProduct);
router.put('/:id', authenticateToken, requireAdmin, updateProduct);
router.delete('/:id', authenticateToken, requireAdmin, deleteProduct);

export default router;