import { Router, Request, Response } from 'express';
import EmailCampaignService from '../services/emailCampaignService';
import { authMiddleware } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';

const router = Router();

// Get campaign statistics (Admin only)
router.get('/stats', authMiddleware, authorizeRoles('admin'), async (req: Request, res: Response) => {
  try {
    const stats = await EmailCampaignService.getCampaignStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting campaign stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get campaign statistics'
    });
  }
});

// Manually trigger pending campaigns processing (Admin only)
router.post('/process-pending', authMiddleware, authorizeRoles('admin'), async (req: Request, res: Response) => {
  try {
    await EmailCampaignService.processPendingCampaigns();
    res.json({
      success: true,
      message: 'Pending campaigns processed successfully'
    });
  } catch (error) {
    console.error('Error processing pending campaigns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process pending campaigns'
    });
  }
});

// Manually trigger cleanup (Admin only)
router.post('/cleanup', authMiddleware, authorizeRoles('admin'), async (req: Request, res: Response) => {
  try {
    await EmailCampaignService.cleanupOldCampaigns();
    res.json({
      success: true,
      message: 'Old campaigns cleaned up successfully'
    });
  } catch (error) {
    console.error('Error cleaning up campaigns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup old campaigns'
    });
  }
});

export default router;