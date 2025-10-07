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

export default router;