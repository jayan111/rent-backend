import { Request, Response, NextFunction } from 'express';
import { getDB } from '../config/database';

// Health check middleware
export const healthCheck = (req: Request, res: Response, next: NextFunction) => {
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid
    };
    res.json(healthStatus);
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: 'Server health check failed' });
  }
};

// DB health check — shows actual connection status and which env vars are present
export const dbHealthCheck = async (req: Request, res: Response) => {
  const db = await getDB();

  const envVars = {
    MYSQL_URL:         !!process.env.MYSQL_URL,
    MYSQL_PRIVATE_URL: !!process.env.MYSQL_PRIVATE_URL,
    MYSQL_PUBLIC_URL:  !!process.env.MYSQL_PUBLIC_URL,
    DATABASE_URL:      !!process.env.DATABASE_URL,
    DB_HOST:           process.env.DB_HOST    || process.env.MYSQLHOST    || process.env.MYSQL_HOST    || '(not set)',
    DB_USER:           process.env.DB_USER    || process.env.MYSQLUSER    || process.env.MYSQL_USER    || '(not set)',
    DB_NAME:           process.env.DB_NAME    || process.env.MYSQLDATABASE|| process.env.MYSQL_DATABASE|| '(not set)',
    DB_PORT:           process.env.DB_PORT    || process.env.MYSQLPORT    || process.env.MYSQL_PORT    || '(not set)',
    DB_PASSWORD_SET:   !!(process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD),
  };

  if (!db) {
    return res.status(503).json({ status: 'disconnected', envVars });
  }

  try {
    await db.query('SELECT 1');
    return res.json({ status: 'connected', envVars });
  } catch (err: any) {
    return res.status(503).json({ status: 'error', error: err.message, envVars });
  }
};

// Global error handler
export const globalErrorHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Global error:', error);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(error.status || 500).json({
    message: error.message || 'Internal server error',
    ...(isDevelopment && { stack: error.stack }),
    timestamp: new Date().toISOString(),
    path: req.path
  });
};

// Request validation middleware
export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Basic request validation
    if (!req.headers['user-agent']) {
      return res.status(400).json({ message: 'Invalid request headers' });
    }
    
    // Rate limiting check
    const clientIp = req.ip || req.connection.remoteAddress;
    if (!clientIp) {
      return res.status(400).json({ message: 'Unable to identify client' });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ message: 'Request validation failed' });
  }
};

// Graceful shutdown handler
export const setupGracefulShutdown = (server: any) => {
  const shutdown = (signal: string) => {
    console.log(`Received ${signal}. Starting graceful shutdown...`);
    
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });
};