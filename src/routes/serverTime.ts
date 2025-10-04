import { Router, Request, Response } from 'express';
import { getCSRFToken } from '../middleware/csrfMiddleware';

const router = Router();

/**
 * Server time synchronization endpoint
 * Helps frontend handle clock skew issues
 */
router.get('/server-time', (req: Request, res: Response) => {
  const serverTime = Date.now();
  
  res.json({
    timestamp: serverTime,
    iso: new Date(serverTime).toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
});

/**
 * Get CSRF token for frontend
 */
router.get('/csrf-token', (req, res, next) => {
  console.log('🔍 CSRF token request received:', {
    method: req.method,
    url: req.url,
    origin: req.headers.origin,
    headers: Object.keys(req.headers)
  });
  getCSRFToken(req, res);
});

export default router;