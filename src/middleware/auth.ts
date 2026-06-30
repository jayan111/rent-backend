import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDB } from '../config/database';
import { AuthenticatedRequest } from '../types';

export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        message: 'Access token required',
        error: 'MISSING_TOKEN'
      });
    }

    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret';

    const decoded = jwt.verify(token, jwtSecret) as { 
      userId: string; 
      email: string;
      role: string;
      iat?: number; 
      exp?: number; 
    };
    
    if (!decoded.userId || !decoded.email) {
      return res.status(403).json({ 
        message: 'Invalid token payload',
        error: 'INVALID_PAYLOAD'
      });
    }
    
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      name: decoded.email.split('@')[0], // Add name for compatibility
      role: decoded.role || 'user'
    };
    
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ 
        message: 'Token expired',
        error: 'TOKEN_EXPIRED'
      });
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({ 
        message: 'Invalid token',
        error: 'INVALID_TOKEN'
      });
    }
    
    return res.status(500).json({ 
      message: 'Token verification failed',
      error: 'VERIFICATION_ERROR'
    });
  }
};

export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ 
      message: 'Admin access required',
      error: 'INSUFFICIENT_PERMISSIONS'
    });
  }
  next();
};

export const optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = undefined;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as { 
      userId: string; 
      email: string;
      role: string;
    };
    
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role || 'user'
    };
  } catch (error) {
    req.user = undefined;
  }
  
  next();
};