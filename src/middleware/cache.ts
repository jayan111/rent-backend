import { Request, Response, NextFunction } from 'express';
import { redis, getCacheKey, CACHE_TTL, isRedisConnected } from '../config/redis';

export const cacheMiddleware = (ttl: number, keyGenerator: (req: Request) => string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!isRedisConnected) {
      return next();
    }

    try {
      const cacheKey = keyGenerator(req);
      const cachedData = await redis.get(cacheKey);

      if (cachedData) {
        return res.json(JSON.parse(cachedData));
      }

      const originalJson = res.json;
      
      res.json = function(data: any) {
        redis.setex(cacheKey, ttl, JSON.stringify(data)).catch(() => {});
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      next();
    }
  };
};

// Specific cache middlewares
export const cacheProducts = cacheMiddleware(
  CACHE_TTL.PRODUCTS,
  (req) => getCacheKey.products(req.query)
);

export const cacheProduct = cacheMiddleware(
  CACHE_TTL.PRODUCTS,
  (req) => getCacheKey.product(req.params.id)
);

export const cacheInventory = cacheMiddleware(
  CACHE_TTL.INVENTORY,
  (req) => getCacheKey.inventory(req.query)
);

export const cacheDashboard = cacheMiddleware(
  CACHE_TTL.DASHBOARD,
  () => getCacheKey.dashboard()
);

export const invalidateCache = {
  products: async () => {
    if (!isRedisConnected) return;
    try {
      const keys = await redis.keys('products:*');
      if (keys.length > 0) await redis.del(...keys);
    } catch (e) {}
  },
  
  product: async (id: string) => {
    if (!isRedisConnected) return;
    try {
      await redis.del(getCacheKey.product(id));
      await invalidateCache.products();
    } catch (e) {}
  },
  
  inventory: async () => {
    if (!isRedisConnected) return;
    try {
      const keys = await redis.keys('inventory:*');
      if (keys.length > 0) await redis.del(...keys);
    } catch (e) {}
  },
  
  dashboard: async () => {
    if (!isRedisConnected) return;
    try {
      await redis.del(getCacheKey.dashboard());
    } catch (e) {}
  }
};