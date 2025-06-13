import { Request, Response } from 'express';
import User from '../models/user';
import Order from '../models/order';
import Design from '../models/design';
import { Wallet, WalletTransaction } from '../models/wallet';
import { RequestWithUser } from '../middleware/authMiddleware';

// Get user profile dashboard data
export const getProfileDashboard = async (req: RequestWithUser, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Get user details
    const user = await User.findById(userId).select('-password');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Get user statistics
    const [orderCount, designCount, wallet] = await Promise.all([
      Order.countDocuments({ userId }),
      Design.countDocuments({ userId, status: { $ne: 'archived' } }),
      Wallet.findOne({ userId }) || { balance: 0 }
    ]);

    // Get recent orders
    const recentOrders = await Order.find({ userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('orderId status createdAt items totalAmount');

    // Get saved designs
    const savedDesigns = await Design.find({ 
      userId, 
      status: { $ne: 'archived' } 
    })
      .sort({ createdAt: -1 })
      .limit(6)
      .select('name thumbnail status createdAt');

    // Format response
    const dashboardData = {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified
      },
      stats: {
        orders: orderCount,
        wallet: wallet && typeof wallet.balance === 'number' ? wallet.balance : 0,
        savedDesigns: designCount
      },
      recentOrders: recentOrders.map(order => ({
        id: order.order_id, // Fixed: use orderId instead of order_id
        status: formatOrderStatus(order.status),
        date: order.createdAt.toISOString().split('T')[0],
        amount: order.totalAmount,
        items: order.items.length
      })),
      savedDesigns: savedDesigns.map(design => ({
        id: design._id,
        name: design.get("name"),
        image: design.get("thumbnail"),
        status: design.get("status"),
        date: design.get("createdAt") ? design.get("createdAt").toISOString().split('T')[0] : ''
      }))
    };

    res.json(dashboardData);
  } catch (error) {
    console.error('Profile dashboard error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get user orders with pagination
export const getUserOrders = async (req: RequestWithUser, res: Response) => {
  try {
    const userId = req.user?.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const query: any = { userId };
    if (status && status !== 'all') {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const [orders, totalCount] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('items.designId', 'name thumbnail'),
      Order.countDocuments(query)
    ]);

    const formattedOrders = orders.map(order => ({
      _id: order._id,
      orderId: order.order_id,
      status: formatOrderStatus(order.status),
      date: order.createdAt.toISOString().split('T')[0],
      totalAmount: order.totalAmount,
      items: order.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price
      }))
    }));

    res.json({
      orders: formattedOrders,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount: totalCount,
        hasNext: page < Math.ceil(totalCount / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get user designs with pagination
export const getUserDesigns = async (req: RequestWithUser, res: Response) => {
  try {
    const userId = req.user?.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;
    const status = req.query.status as string;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const query: any = { userId, status: { $ne: 'archived' } };
    if (status && status !== 'all') {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const [designs, totalCount] = await Promise.all([
      Design.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('name thumbnail status createdAt category tags likes downloads'),
      Design.countDocuments(query)
    ]);
    
    const formattedDesigns = designs.map(design => ({
      id: design._id,
      name: design.name,
      image: design.get("thumbnail"),
      status: design.get("status"),
      date: design.get("createdAt").toISOString().split('T')[0],
      category: design.get("category"),
      tags: design.get("tags"),
      likes: design.get("likes"),
      downloads: design.get("downloads")
    }));

    res.json({
      designs: formattedDesigns,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: page < Math.ceil(totalCount / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get user designs error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get wallet details and transactions
export const getWalletDetails = async (req: RequestWithUser, res: Response) => {
  try {
    const userId = req.user?.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Get or create wallet
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = new Wallet({ userId, balance: 0 });
      await wallet.save();
    }

    const skip = (page - 1) * limit;

    // Get transactions
    const [transactions, totalCount] = await Promise.all([
      WalletTransaction.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      WalletTransaction.countDocuments({ userId })
    ]);

    const formattedTransactions = transactions.map(transaction => ({
      _id: transaction._id,
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description,
      reference: transaction.reference,
      status: transaction.status,
      date: transaction.createdAt.toISOString().split('T')[0],
      time: transaction.createdAt.toLocaleTimeString()
    }));

    res.json({
      wallet: {
        balance: wallet.balance,
        currency: wallet.currency,
        isActive: wallet.isActive
      },
      transactions: formattedTransactions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: page < Math.ceil(totalCount / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get wallet details error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update user profile
export const updateProfile = async (req: RequestWithUser, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { name, username, email, phone, address, dateOfBirth, newsletterSubscribed } = req.body;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Build update data object
    const updateData: any = {};
    
    if (name !== undefined && name !== null) updateData.name = name.trim();
    if (username !== undefined && username !== null) updateData.username = username.trim();
    if (email !== undefined && email !== null) updateData.email = email.trim().toLowerCase();
    if (phone !== undefined && phone !== null) updateData.phone = phone.trim();
    if (address !== undefined && address !== null) updateData.address = address;
    if (dateOfBirth !== undefined && dateOfBirth !== null) updateData.dateOfBirth = dateOfBirth;
    if (typeof newsletterSubscribed === 'boolean') {
      updateData.newsletterSubscribed = newsletterSubscribed;
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ message: 'No valid fields to update' });
      return;
    }

    // Pre-check for username uniqueness if username is being updated
    if (updateData.username) {
      const existingUserWithUsername = await User.findOne({ 
        username: updateData.username,
        _id: { $ne: userId } // Exclude current user
      });
      
      if (existingUserWithUsername) {
        res.status(400).json({ 
          message: 'Username is already taken',
          field: 'username'
        });
        return;
      }
    }

    // Pre-check for email uniqueness if email is being updated
    if (updateData.email) {
      const existingUserWithEmail = await User.findOne({ 
        email: updateData.email,
        _id: { $ne: userId } // Exclude current user
      });
      
      if (existingUserWithEmail) {
        res.status(400).json({ 
          message: 'Email is already taken',
          field: 'email'
        });
        return; // FIXED: This was missing, causing the function to continue
      }
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { 
        new: true, 
        runValidators: true,
        context: 'query'
      }
    ).select('-password -__v');

    if (!updatedUser) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Log the activity
    await User.findByIdAndUpdate(userId, {
      $push: {
        activityLog: {
          action: 'profile_updated',
          route: '/profile/update',
          timestamp: new Date()
        }
      }
    });

    res.status(200).json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
    return;
  } catch (error: unknown) {
    console.error('Update profile error:', error);
    
    // Handle specific MongoDB errors (fallback)
    if (error instanceof Error) {
      if ('code' in error && error.code === 11000) {
        // Parse the error message to determine which field
        const errorMessage = error.message;
        if (errorMessage.includes('username')) {
          res.status(400).json({ 
            message: 'Username is already taken',
            field: 'username'
          });
          return;
        } else if (errorMessage.includes('email')) {
          res.status(400).json({ 
            message: 'Email is already taken',
            field: 'email'
          });
          return;
        }
        res.status(400).json({ 
          message: 'Duplicate field detected'
        });
        return;
      }
      
      if (error.name === 'ValidationError') {
        res.status(400).json({ 
          message: 'Validation failed', 
          details: error.message 
        });
        return;
      }
    }
    
    res.status(500).json({ message: 'Internal server error' });
    return;
  }
};

// Helper function to format order status
const formatOrderStatus = (status: string): string => {
  const statusMap: { [key: string]: string } = {
    'pending': 'Pending',
    'confirmed': 'Confirmed',
    'in_production': 'In Production',
    'shipped': 'Shipped',
    'delivered': 'Delivered',
    'cancelled': 'Cancelled'
  };
  return statusMap[status] || status;
};