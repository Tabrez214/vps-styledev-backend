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

// Update user preferences (notifications, privacy) - MISSING from your current setup
router.put('/preferences', authMiddleware, async (req, res) => {
  try {
    const { default: User } = await import('../../models/user');
    const userId = req.user?.userId;
    const { notifications, privacy, newsletterSubscribed } = req.body;

    const updateData: any = {};

    // Handle notification preferences
    if (notifications) {
      updateData['preferences.notifications'] = {
        email: notifications.orderUpdates !== undefined ? notifications.orderUpdates : true,
        sms: notifications.promotions !== undefined ? notifications.promotions : false,
        push: notifications.push !== undefined ? notifications.push : true
      };
    }

    // Handle privacy preferences
    if (privacy) {
      updateData['preferences.privacy'] = {
        profileVisible: privacy.profileVisible !== undefined ? privacy.profileVisible : true,
        showEmail: privacy.showEmail !== undefined ? privacy.showEmail : false
      };
    }

    // Handle newsletter subscription
    if (newsletterSubscribed !== undefined) {
      updateData.newsletterSubscribed = newsletterSubscribed;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json({ 
      message: "Preferences updated successfully", 
      user: updatedUser.toObject() 
    });
  } catch (error) {
    console.error('Error updating user preferences:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Change password route
router.put('/change-password', authMiddleware, async (req, res) => {
  try {
    const { default: User } = await import('../../models/user');
    const userId = req.user?.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: "Current password and new password are required" });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ message: "New password must be at least 6 characters long" });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      res.status(400).json({ message: "Current password is incorrect" });
      return;
    }

    // Update password (will be hashed by pre-save middleware)
    user.password = newPassword;
    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;