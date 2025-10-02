/**
 * Admin Status Management Routes
 * Provides comprehensive order status management for administrators
 */

import express, { Request, Response } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware';
import { authorizeRoles } from '../../middleware/roleMiddleware';
import { StatusManagementService } from '../../services/statusManagementService';
import { statusUpdateMiddleware } from '../../middleware/statusValidationMiddleware';

const router = express.Router();

// Apply admin authentication to all routes
router.use(authMiddleware);
router.use(authorizeRoles('admin'));

/**
 * GET /api/admin/status-management/overview
 * Get status management dashboard overview
 */
router.get('/overview', async (req, res): Promise<void> => {
  try {
    const stats = await StatusManagementService.getStatusStatistics();

    res.json({
      success: true,
      data: {
        statusBreakdown: stats.statusBreakdown,
        totalOrders: stats.totalOrders,
        recentChanges: stats.recentChanges,
        summary: {
          active: stats.statusBreakdown
            .filter(s => ['pending', 'processing'].includes(s._id))
            .reduce((sum, s) => sum + s.count, 0),
          shipped: stats.statusBreakdown
            .filter(s => ['shipped', 'delivered'].includes(s._id))
            .reduce((sum, s) => sum + s.count, 0),
          completed: stats.statusBreakdown
            .filter(s => s._id === 'completed')
            .reduce((sum, s) => sum + s.count, 0),
          problematic: stats.statusBreakdown
            .filter(s => ['cancelled', 'failed', 'returned'].includes(s._id))
            .reduce((sum, s) => sum + s.count, 0)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching status overview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch status overview'
    });
  }
});

/**
 * GET /api/admin/status-management/orders
 * Get orders filtered by status with pagination
 */
router.get('/orders', async (req, res): Promise<void> => {
  try {
    const {
      status,
      category,
      limit = 20,
      skip = 0
    } = req.query;

    const result = await StatusManagementService.getOrdersByStatus(
      status as string,
      category as any,
      parseInt(limit as string),
      parseInt(skip as string)
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching orders by status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders'
    });
  }
});

/**
 * GET /api/admin/status-management/orders/:orderId/history
 * Get status history for a specific order
 */
router.get('/orders/:orderId/history', async (req, res): Promise<void> => {
  try {
    const { orderId } = req.params;
    const history = await StatusManagementService.getOrderStatusHistory(orderId);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error fetching order status history:', error);

    if (error instanceof Error && error.message === 'Order not found') {
      res.status(404).json({
        success: false,
        message: 'Order not found'
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Failed to fetch order status history'
    });
  }
});

/**
 * PATCH /api/admin/status-management/orders/:orderId/status
 * Update order status with validation and notifications
 */
router.patch('/orders/:orderId/status', statusUpdateMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { status, reason, skipValidation, notifyCustomer = true } = req.body;
    const changedBy = (req.user as any)?._id || 'admin';

    const result = await StatusManagementService.updateOrderStatus({
      orderId,
      newStatus: status,
      reason,
      changedBy,
      skipValidation,
      notifyCustomer
    });

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: result
    });
  } catch (error) {
    console.error('Error updating order status:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        message: error.message
      });
      return;
    }

    if (error instanceof Error && error.message.includes('Invalid status transition')) {
      res.status(400).json({
        success: false,
        message: error.message
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update order status'
    });
  }
});

/**
 * POST /api/admin/status-management/bulk-update
 * Bulk update status for multiple orders
 */
router.post('/bulk-update', async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderIds, status, reason } = req.body;
    const changedBy = (req.user as any)?._id || 'admin';

    // Validate input
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'orderIds array is required and must not be empty'
      });
      return;
    }

    if (!status) {
      res.status(400).json({
        success: false,
        message: 'status is required'
      });
      return;
    }

    // Limit bulk operations to prevent abuse
    if (orderIds.length > 100) {
      res.status(400).json({
        success: false,
        message: 'Bulk update limited to 100 orders at a time'
      });
      return;
    }

    const results = await StatusManagementService.bulkUpdateOrderStatus(
      orderIds,
      status,
      changedBy,
      reason
    );

    const successful = results.filter(r => r.notificationSent !== undefined).length;
    const failed = orderIds.length - successful;

    res.json({
      success: true,
      message: `Bulk update completed. ${successful} successful, ${failed} failed`,
      data: {
        total: orderIds.length,
        successful,
        failed,
        results
      }
    });
  } catch (error) {
    console.error('Error in bulk status update:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform bulk status update'
    });
  }
});

/**
 * GET /api/admin/status-management/validation-rules
 * Get available status transitions and validation rules
 */
router.get('/validation-rules', (req, res): void => {
  const validTransitions = {
    'pending': ['processing', 'cancelled', 'failed'],
    'processing': ['shipped', 'cancelled'],
    'shipped': ['delivered', 'returned'],
    'delivered': ['completed'],
    'completed': [], // Final state
    'cancelled': [], // Final state
    'failed': ['pending'], // Can retry
    'returned': ['processing', 'refunded']
  };

  const statusCategories = {
    ACTIVE: ['pending', 'processing'],
    SHIPPED: ['shipped', 'delivered'],
    FINAL: ['completed', 'cancelled', 'failed', 'refunded'],
    PROBLEMATIC: ['returned', 'failed', 'cancelled']
  };

  const statusDescriptions = {
    'pending': 'Order received and awaiting processing',
    'processing': 'Order is being prepared for shipment',
    'shipped': 'Order has been shipped to customer',
    'delivered': 'Order successfully delivered to customer',
    'completed': 'Order completed successfully',
    'cancelled': 'Order was cancelled',
    'failed': 'Order failed due to payment or other issues',
    'returned': 'Order was returned by customer',
    'refunded': 'Order amount has been refunded'
  };

  res.json({
    success: true,
    data: {
      validTransitions,
      statusCategories,
      statusDescriptions,
      allStatuses: Object.keys(validTransitions)
    }
  });
});

/**
 * POST /api/admin/status-management/simulate-update
 * Simulate status update without actually performing it (for testing)
 */
router.post('/simulate-update', async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId, newStatus } = req.body;

    if (!orderId || !newStatus) {
      res.status(400).json({
        success: false,
        message: 'orderId and newStatus are required'
      });
      return;
    }

    // Get current order
    const Order = (await import('../../models/order')).default;
    const order = await Order.findById(orderId).select('status user').populate('user', 'name email');

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found'
      });
      return;
    }

    // Validate transition
    try {
      StatusManagementService.validateStatusTransition(order.status, newStatus);

      res.json({
        success: true,
        message: 'Status transition is valid',
        data: {
          currentStatus: order.status,
          newStatus,
          customerWillBeNotified: !!order.user?.email,
          customerEmail: order.user?.email,
          transitionValid: true
        }
      });
    } catch (validationError) {
      res.json({
        success: false,
        message: (validationError as Error).message,
        data: {
          currentStatus: order.status,
          newStatus,
          transitionValid: false
        }
      });
    }
  } catch (error) {
    console.error('Error simulating status update:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to simulate status update'
    });
  }
});

export default router;