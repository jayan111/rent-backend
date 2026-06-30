import { Request, Response, NextFunction } from 'express';

// Health check middleware
export const healthCheck = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check server health
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid
    };
    
    res.json(healthStatus);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: 'Server health check failed'
    });
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