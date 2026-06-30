import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 1,
  lazyConnect: true,
  enableOfflineQueue: false
};

// Main Redis client for caching
export const redis = new Redis(redisConfig);

// Separate Redis client for Bull queue
export const queueRedis = new Redis(redisConfig);

// Cache TTL constants
export const CACHE_TTL = {
  PRODUCTS: 300,
  INVENTORY: 180,
  DASHBOARD: 60,
  USER_SESSION: 3600
};

// Cache key generators
export const getCacheKey = {
  products: (filters: any) => `products:${JSON.stringify(filters)}`,
  product: (id: string) => `product:${id}`,
  inventory: (filters: any) => `inventory:${JSON.stringify(filters)}`,
  dashboard: () => 'dashboard:stats',
  userSession: (userId: string) => `session:${userId}`
};

let isRedisConnected = false;

redis.on('connect', () => {
  console.log('✅ Redis connected successfully');
  isRedisConnected = true;
});

redis.on('error', (err: Error) => {
  console.warn('⚠️  Redis not available, running without cache');
  isRedisConnected = false;
});

// Try to connect but don't fail if Redis is not available
redis.connect().catch(() => {
  console.warn('⚠️  Redis connection failed, continuing without cache');
});

export { isRedisConnected };
export default redis;