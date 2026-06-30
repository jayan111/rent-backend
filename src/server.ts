import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

import { connectDB } from './config/database';
import './config/redis'; // Initialize Redis connection
import './services/queue'; // Initialize queue processors
import { addSSEClient } from './services/sse';
import { errorHandler } from './middleware/errorHandler';
import { responseTime, cacheControl } from './middleware/performance';
import { rateLimits } from './middleware/rateLimiting';
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import orderRoutes from './routes/orders';
import userRoutes from './routes/users';
import searchRoutes from './routes/search';
import categoryRoutes from './routes/categories';
import contentRoutes from './routes/content';
import subscriptionRoutes from './routes/subscriptions';
import inventoryRoutes from './routes/inventory';
import adminRoutes from './routes/admin';
import kycRoutes from './routes/kyc';
import { healthCheck, dbHealthCheck, globalErrorHandler, validateRequest, setupGracefulShutdown } from './middleware/serverValidation';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests
app.options('*', cors());

// Apply general rate limiting
app.use(rateLimits.general);

// Performance middleware
app.use(responseTime);
app.use(cacheControl(300)); // 5 minutes cache for GET requests

// Validation middleware
app.use(validateRequest);

// General middleware
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files for uploaded images
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes with specific rate limiting
app.use('/api/auth', rateLimits.auth, authRoutes);
app.use('/api/products', productRoutes); // Rate limiting applied in route file
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/search', rateLimits.search, searchRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/inventory', inventoryRoutes); // Rate limiting applied in route file
app.use('/api/admin', adminRoutes); // Rate limiting applied in route file
app.use('/api/kyc', kycRoutes);

// Real-time order updates via SSE
app.get('/api/orders/stream', (req, res) => {
  const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  addSSEClient(clientId, res);
});

// Health checks
app.get('/health', healthCheck);
app.get('/health/db', dbHealthCheck);

// Error handling
app.use(errorHandler);
app.use(globalErrorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const startServer = async () => {
  try {
    await connectDB();
    const server = app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Local: http://localhost:${PORT}`);
      console.log(`Network: http://192.168.1.35:${PORT}`);
      console.log(`Health check available at http://localhost:${PORT}/health`);
    });
    
    setupGracefulShutdown(server);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();