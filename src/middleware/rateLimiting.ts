import rateLimit from 'express-rate-limit';

export const createRateLimit = (windowMs: number, max: number, message?: string) => {
  return rateLimit({
    windowMs,
    max,
    message: message || 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  });
};

export const rateLimits = {
  general: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path.startsWith('/api/admin'),
  }),
  auth: createRateLimit(15 * 60 * 1000, 10),
  products: createRateLimit(1 * 60 * 1000, 50),
  admin: createRateLimit(15 * 60 * 1000, 200),
  search: createRateLimit(1 * 60 * 1000, 20),
};