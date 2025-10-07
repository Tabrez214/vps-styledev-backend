import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Store CSRF tokens temporarily (in production, use Redis or database)
const csrfTokens = new Map<string, { token: string; expires: number }>();

/**
 * Generate CSRF token
 */
export const generateCSRFToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * CSRF Protection Middleware
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const token = req.headers['x-csrf-token'] as string || req.body._csrf;
  const sessionId = req.headers['x-session-id'] as string;

  if (!token) {
    res.status(403).json({
      error: 'CSRF token missing',
      message: 'CSRF token is required for this operation'
    });
    return;
  }

  if (!sessionId) {
    res.status(403).json({
      error: 'Session ID missing',
      message: 'Session ID is required for CSRF validation'
    });
    return;
  }

  // Validate CSRF token
  const storedTokenData = csrfTokens.get(sessionId);
  if (!storedTokenData || storedTokenData.token !== token || storedTokenData.expires < Date.now()) {
    res.status(403).json({
      error: 'Invalid CSRF token',
      message: 'CSRF token is invalid or expired'
    });
    return;
  }

  next();
};

/**
 * Flexible CSRF Protection for Express Checkout
 * Allows requests without CSRF but logs them for monitoring
 */
export const flexibleCSRFProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const token = req.headers['x-csrf-token'] as string || req.body._csrf;
  const sessionId = req.headers['x-session-id'] as string;

  // If both token and sessionId are present, validate them
  if (token && sessionId) {
    const storedTokenData = csrfTokens.get(sessionId);
    if (!storedTokenData || storedTokenData.token !== token || storedTokenData.expires < Date.now()) {
      console.log('⚠️ Express checkout: Invalid CSRF token provided, but allowing request');
    } else {
      console.log('✅ Express checkout: Valid CSRF token provided');
    }
  } else {
    console.log('⚠️ Express checkout: No CSRF token provided, but allowing request');
  }

  // Always proceed for express checkout
  next();
};

/**
 * Generate and store CSRF token for session
 */
export const getCSRFToken = (req: Request, res: Response) => {
  const sessionId = req.headers['x-session-id'] as string || crypto.randomBytes(16).toString('hex');
  const token = generateCSRFToken();
  const expires = Date.now() + (60 * 60 * 1000); // 1 hour

  // Store token
  csrfTokens.set(sessionId, { token, expires });

  // Clean up expired tokens
  cleanupExpiredTokens();

  res.json({
    csrfToken: token,
    sessionId,
    expires: new Date(expires).toISOString()
  });
};

/**
 * Clean up expired CSRF tokens
 */
const cleanupExpiredTokens = () => {
  const now = Date.now();
  for (const [sessionId, tokenData] of csrfTokens.entries()) {
    if (tokenData.expires < now) {
      csrfTokens.delete(sessionId);
    }
  }
};

/**
 * CSRF Error Handler
 */
export const csrfErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.code === 'EBADCSRFTOKEN') {
    res.status(403).json({
      error: 'CSRF token mismatch',
      message: 'Invalid CSRF token'
    });
  } else {
    next(err);
  }
};