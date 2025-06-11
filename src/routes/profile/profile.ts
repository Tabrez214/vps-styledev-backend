import express from 'express';
import { authMiddleware, RequestWithUser } from '../../middleware/authMiddleware';
import { 
  getProfileDashboard, 
  getUserOrders, 
  getUserDesigns, 
  getWalletDetails, 
  updateProfile 
} from '../../controllers/profile';

const router = express.Router();
// Profile dashboard route - gets overview data
router.get('/dashboard', authMiddleware, (req, res) => getProfileDashboard(req as RequestWithUser, res));

// Get user orders with pagination and filtering
router.get('/orders', authMiddleware, (req, res) => getUserOrders(req as RequestWithUser, res));

// Get user designs with pagination and filtering
router.get('/designs', authMiddleware, getUserDesigns);

// Get wallet details and transactions
router.get('/wallet', authMiddleware, getWalletDetails);

// Update user profile
router.put('/update', authMiddleware, updateProfile);

// Get current user profile details
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // Import User model here to fix "Cannot find name 'User'" error
    const { default: User } = await import('../../models/user');
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const user = await User.findById(userId).select('-password');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;