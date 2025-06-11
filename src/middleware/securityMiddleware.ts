import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { errorHandler } from './errorMiddleware';

/**
 * Configure security middleware
 */

// Rate limiting middleware
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
});

// Helmet middleware for security headers
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  xssFilter: true,
  noSniff: true,
  referrerPolicy: { policy: 'same-origin' }
});

/**
 * Configure API middleware
 */

// Apply all middleware to Express app
export const configureMiddleware = (app: any) => {
  // Security middleware
  app.use(helmetMiddleware);
  app.use('/api/', rateLimiter);
  
  // Global error handler
  app.use(errorHandler);
  
  return app;
};

export default {
  rateLimiter,
  helmetMiddleware,
  configureMiddleware
};
