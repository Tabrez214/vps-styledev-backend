import { Request, Response, NextFunction } from 'express';
import { authMiddleware } from './authMiddleware'; // Your existing auth middleware
import { AuthenticationError } from './errorMiddleware';

/**
 * Adapter to use your existing authMiddleware as requireAuth
 * This ensures compatibility with your existing auth system
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  // Call your existing authMiddleware
  authMiddleware(req, res, next);
};

/**
 * Helper function to get user ID from your auth system
 * Adapts to your user structure: { userId: string, role: string, consent: boolean }
 */
export const getUserId = (req: Request): string => {
  if (!req.user) {
    throw new AuthenticationError('User not authenticated');
  }
  
  // Your user structure has userId field
  return req.user.userId;
};

/**
 * Helper function to check if user is admin
 * Adapts to your role system
 */
export const isUserAdmin = (req: Request): boolean => {
  if (!req.user) {
    return false;
  }
  
  // Check if user has admin role
  return req.user.role === 'admin' || req.user.role === 'Admin';
};

/**
 * Middleware to require admin role using your auth system
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  // First ensure user is authenticated
  if (!req.user) {
    throw new AuthenticationError('Authentication required');
  }
  
  // Check admin role
  if (!isUserAdmin(req)) {
    throw new AuthenticationError('Access denied. Admin privileges required.');
  }
  
  next();
};

/**
 * Updated middleware that works with your user structure
 * Use this in your asset routes instead of the original requireAuth
 */
export const assetAuth = (req: Request, res: Response, next: NextFunction): void => {
  // Use your existing auth middleware
  authMiddleware(req, res, (error?: any) => {
    if (error) {
      // Handle auth errors
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    next();
  });
};