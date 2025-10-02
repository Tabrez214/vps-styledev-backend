/**
 * Unified Status Management Service
 * Handles order status updates across all related records with notifications and audit trails
 */

import Order from '../models/order';
import DesignOrder from '../models/designOrder';
import mongoose from 'mongoose';
import { OrderLinkingService } from './orderLinkingService';

// Status transition validation rules
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  'pending': ['processing', 'cancelled', 'failed'],
  'processing': ['shipped', 'cancelled'],
  'shipped': ['delivered', 'returned'],
  'delivered': ['completed'],
  'completed': [], // Final state
  'cancelled': [], // Final state
  'failed': ['pending'], // Can retry
  'returned': ['processing', 'refunded']
};

// Status categories for different handling
const STATUS_CATEGORIES = {
  ACTIVE: ['pending', 'processing'],
  SHIPPED: ['shipped', 'delivered'],
  FINAL: ['completed', 'cancelled', 'failed', 'refunded'],
  PROBLEMATIC: ['returned', 'failed', 'cancelled']
};

export interface StatusChangeLog {
  orderId: string;
  previousStatus: string;
  newStatus: string;
  changedAt: Date;
  changedBy: string; // User ID or system
  reason?: string;
  automaticChange: boolean;
  notificationSent: boolean;
}

export interface StatusUpdateRequest {
  orderId: string;
  newStatus: string;
  reason?: string;
  changedBy: string;
  skipValidation?: boolean;
  skipNotification?: boolean;
  notifyCustomer?: boolean;
}

export class StatusManagementService {

  /**
   * Update order status with full validation, linking, and notifications
   */
  static async updateOrderStatus(request: StatusUpdateRequest): Promise<StatusChangeLog> {
    const session = await mongoose.startSession();

    try {
      return await session.withTransaction(async () => {
        // Get current order
        const order = await Order.findById(request.orderId).session(session);
        if (!order) {
          throw new Error(`Order ${request.orderId} not found`);
        }

        const previousStatus = order.status;

        // Validate status transition
        if (!request.skipValidation) {
          this.validateStatusTransition(previousStatus, request.newStatus);
        }

        // Update main order
        const updateData = {
          status: request.newStatus,
          updatedAt: new Date(),
          $push: {
            statusHistory: {
              previousStatus,
              newStatus: request.newStatus,
              changedAt: new Date(),
              changedBy: request.changedBy,
              reason: request.reason,
              automaticChange: false
            }
          }
        };

        await Order.findByIdAndUpdate(
          request.orderId,
          updateData,
          { session, new: true }
        );

        // Update all linked design orders
        if (order.linkedDesignOrders?.length > 0) {
          await DesignOrder.updateMany(
            { _id: { $in: order.linkedDesignOrders } },
            {
              status: request.newStatus,
              updatedAt: new Date(),
              $push: {
                statusHistory: {
                  previousStatus,
                  newStatus: request.newStatus,
                  changedAt: new Date(),
                  changedBy: request.changedBy,
                  reason: request.reason,
                  automaticChange: false
                }
              }
            },
            { session }
          );
        }

        // Fallback: Update by orderNumber for backward compatibility
        await DesignOrder.updateMany(
          { orderNumber: order.order_id },
          {
            status: request.newStatus,
            updatedAt: new Date()
          },
          { session }
        );

        // Create status change log
        const statusLog: StatusChangeLog = {
          orderId: request.orderId,
          previousStatus,
          newStatus: request.newStatus,
          changedAt: new Date(),
          changedBy: request.changedBy,
          reason: request.reason,
          automaticChange: false,
          notificationSent: false
        };

        // Send notifications (if not skipped)
        if (!request.skipNotification) {
          try {
            await this.sendStatusNotifications(order, previousStatus, request.newStatus, request.notifyCustomer);
            statusLog.notificationSent = true;
          } catch (notificationError) {
            console.error('Failed to send status notification:', notificationError);
            // Don't fail the transaction if notification fails
          }
        }

        // Log the status change
        await this.logStatusChange(statusLog);

        console.log(`✅ Updated order ${request.orderId}: ${previousStatus} → ${request.newStatus}`);
        return statusLog;
      });
    } finally {
      await session.endSession();
    }
  }

  /**
   * Bulk update status for multiple orders
   */
  static async bulkUpdateOrderStatus(
    orderIds: string[],
    newStatus: string,
    changedBy: string,
    reason?: string
  ): Promise<StatusChangeLog[]> {
    const results: StatusChangeLog[] = [];

    for (const orderId of orderIds) {
      try {
        const result = await this.updateOrderStatus({
          orderId,
          newStatus,
          changedBy,
          reason,
          notifyCustomer: true
        });
        results.push(result);
      } catch (error) {
        console.error(`Failed to update order ${orderId}:`, error);
        // Continue with other orders
      }
    }

    return results;
  }

  /**
   * Validate status transition is allowed
   */
  static validateStatusTransition(currentStatus: string, newStatus: string): void {
    const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus];

    if (!allowedTransitions) {
      throw new Error(`Unknown current status: ${currentStatus}`);
    }

    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(
        `Invalid status transition: ${currentStatus} → ${newStatus}. ` +
        `Allowed transitions: ${allowedTransitions.join(', ')}`
      );
    }
  }

  /**
   * Get order status history
   */
  static async getOrderStatusHistory(orderId: string) {
    const order = await Order.findById(orderId).select('statusHistory status createdAt');
    if (!order) {
      throw new Error('Order not found');
    }

    return {
      currentStatus: order.status,
      orderCreatedAt: order.createdAt,
      statusHistory: order.statusHistory || []
    };
  }

  /**
   * Get orders by status with filtering
   */
  static async getOrdersByStatus(
    status?: string,
    category?: keyof typeof STATUS_CATEGORIES,
    limit: number = 50,
    skip: number = 0
  ) {
    let statusFilter: any = {};

    if (status) {
      statusFilter.status = status;
    } else if (category && STATUS_CATEGORIES[category]) {
      statusFilter.status = { $in: STATUS_CATEGORIES[category] };
    }

    const orders = await Order.find(statusFilter)
      .populate('user', 'name email')
      .populate('linkedDesignOrders', 'status totalQuantity')
      .sort({ updatedAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Order.countDocuments(statusFilter);

    return {
      orders,
      total,
      hasMore: skip + limit < total
    };
  }

  /**
   * Send status change notifications
   */
  private static async sendStatusNotifications(
    order: any,
    previousStatus: string,
    newStatus: string,
    notifyCustomer: boolean = true
  ): Promise<void> {
    // Import email service dynamically to avoid circular dependencies
    const EmailService = (await import('./emailService')).default;

    const notificationData = {
      orderId: order.order_id,
      orderNumber: order.order_id,
      previousStatus,
      newStatus,
      customerName: order.user?.name || 'Customer',
      customerEmail: order.user?.email,
      statusDescription: this.getStatusDescription(newStatus),
      estimatedDelivery: this.getEstimatedDelivery(newStatus)
    };

    // Send customer notification
    if (notifyCustomer && order.user?.email) {
      await EmailService.sendStatusUpdateEmail(notificationData);
    }

    // Send internal notification for important status changes
    if (STATUS_CATEGORIES.PROBLEMATIC.includes(newStatus)) {
      await EmailService.sendInternalAlert(notificationData);
    }
  }

  /**
   * Log status change for audit trail
   */
  private static async logStatusChange(statusLog: StatusChangeLog): Promise<void> {
    // For now, just console log. In production, you might want to store in a separate audit collection
    console.log('📋 Status Change Log:', {
      timestamp: statusLog.changedAt.toISOString(),
      order: statusLog.orderId,
      change: `${statusLog.previousStatus} → ${statusLog.newStatus}`,
      changedBy: statusLog.changedBy,
      reason: statusLog.reason || 'No reason provided',
      notificationSent: statusLog.notificationSent
    });

    // TODO: Store in dedicated audit collection for compliance
    // await AuditLog.create(statusLog);
  }

  /**
   * Get human-readable status description
   */
  private static getStatusDescription(status: string): string {
    const descriptions: Record<string, string> = {
      'pending': 'Your order has been received and is being processed',
      'processing': 'Your order is being prepared for shipment',
      'shipped': 'Your order has been shipped and is on its way',
      'delivered': 'Your order has been delivered successfully',
      'completed': 'Your order is complete. Thank you for your business!',
      'cancelled': 'Your order has been cancelled',
      'failed': 'There was an issue with your order. Please contact support',
      'returned': 'Your order has been returned and is being processed',
      'refunded': 'Your order has been refunded'
    };

    return descriptions[status] || `Order status: ${status}`;
  }

  /**
   * Get estimated delivery based on status
   */
  private static getEstimatedDelivery(status: string): string | null {
    switch (status) {
      case 'processing':
        return '2-3 business days';
      case 'shipped':
        return '3-5 business days';
      case 'delivered':
      case 'completed':
        return 'Delivered';
      default:
        return null;
    }
  }

  /**
   * Get status statistics for admin dashboard
   */
  static async getStatusStatistics() {
    const pipeline = [
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$totalAmount' },
          avgValue: { $avg: '$totalAmount' }
        }
      },
      {
        $sort: { count: -1 as const }
      }
    ];

    const statusStats = await Order.aggregate(pipeline);

    const totalOrders = await Order.countDocuments();
    const recentStatusChanges = await Order.find({
      'statusHistory.0': { $exists: true }
    })
      .sort({ 'statusHistory.changedAt': -1 })
      .limit(10)
      .select('order_id status statusHistory user')
      .populate('user', 'name email');

    return {
      statusBreakdown: statusStats,
      totalOrders,
      recentChanges: recentStatusChanges
    };
  }
}