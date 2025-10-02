/**
 * Order Linking Service
 * Provides optimized queries using the enhanced order linking system
 */

import Order from '../models/order';
import DesignOrder from '../models/designOrder';
import mongoose from 'mongoose';

export class OrderLinkingService {
  /**
   * Get order with all linked design orders (optimized query)
   */
  static async getOrderWithDesignOrders(orderId: string) {
    return await Order.findById(orderId)
      .populate('linkedDesignOrders') // Fast ObjectId-based population
      .populate('user', 'name email')
      .populate('address');
  }

  /**
   * Get design order with main order (optimized query)
   */
  static async getDesignOrderWithMainOrder(designOrderId: string) {
    return await DesignOrder.findById(designOrderId)
      .populate('mainOrderId') // Fast ObjectId-based population
      .populate('designId');
  }

  /**
   * Get all design orders for a main order (optimized)
   */
  static async getDesignOrdersForOrder(orderId: string) {
    const order = await Order.findById(orderId).select('linkedDesignOrders');
    if (!order?.linkedDesignOrders?.length) {
      return [];
    }

    return await DesignOrder.find({
      _id: { $in: order.linkedDesignOrders }
    });
  }

  /**
   * Update status for order and all linked design orders atomically
   */
  static async updateOrderStatus(
    orderId: string, 
    status: string, 
    reason?: string
  ) {
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Update main order
        const order = await Order.findByIdAndUpdate(
          orderId,
          { 
            status,
            $push: { 
              statusHistory: { 
                status, 
                updatedAt: new Date(), 
                reason 
              }
            }
          },
          { session, new: true }
        );

        if (!order) {
          throw new Error('Order not found');
        }

        // Update all linked design orders using ObjectId references
        if (order.linkedDesignOrders?.length > 0) {
          await DesignOrder.updateMany(
            { _id: { $in: order.linkedDesignOrders } },
            { 
              status,
              $push: { 
                statusHistory: { 
                  status, 
                  updatedAt: new Date(), 
                  reason 
                }
              }
            },
            { session }
          );
        }

        // Fallback: Update design orders by orderNumber (for backward compatibility)
        await DesignOrder.updateMany(
          { orderNumber: order.order_id },
          { status },
          { session }
        );

        console.log(`✅ Updated order ${orderId} and all linked design orders to status: ${status}`);
      });
    } finally {
      await session.endSession();
    }
  }

  /**
   * Find orphaned design orders (design orders without main order references)
   */
  static async findOrphanedDesignOrders() {
    return await DesignOrder.find({
      $and: [
        { mainOrderId: { $exists: false } },
        { orderNumber: { $exists: true } }
      ]
    });
  }

  /**
   * Link existing design orders to main orders (migration utility)
   */
  static async linkExistingDesignOrders() {
    const orphanedDesignOrders = await this.findOrphanedDesignOrders();
    
    for (const designOrder of orphanedDesignOrders) {
      try {
        // Find main order by orderNumber
        const mainOrder = await Order.findOne({ 
          order_id: designOrder.orderNumber 
        });

        if (mainOrder) {
          // Update design order with main order reference
          designOrder.mainOrderId = mainOrder._id;
          await designOrder.save();

          // Update main order with design order reference
          mainOrder.linkedDesignOrders = mainOrder.linkedDesignOrders || [];
          if (!mainOrder.linkedDesignOrders.includes(designOrder._id)) {
            mainOrder.linkedDesignOrders.push(designOrder._id);
            await mainOrder.save();
          }

          console.log(`✅ Linked design order ${designOrder._id} to main order ${mainOrder._id}`);
        } else {
          console.log(`⚠️ No main order found for design order ${designOrder._id} (orderNumber: ${designOrder.orderNumber})`);
        }
      } catch (error) {
        console.error(`❌ Failed to link design order ${designOrder._id}:`, error);
      }
    }

    return orphanedDesignOrders.length;
  }

  /**
   * Get order statistics with linked design orders
   */
  static async getOrderStatistics() {
    const [
      totalOrders,
      ordersWithDesignOrders,
      totalDesignOrders,
      linkedDesignOrders
    ] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ linkedDesignOrders: { $exists: true, $ne: [] } }),
      DesignOrder.countDocuments(),
      DesignOrder.countDocuments({ mainOrderId: { $exists: true } })
    ]);

    return {
      totalOrders,
      ordersWithDesignOrders,
      totalDesignOrders,
      linkedDesignOrders,
      orphanedDesignOrders: totalDesignOrders - linkedDesignOrders,
      linkingCompleteness: totalDesignOrders > 0 ? (linkedDesignOrders / totalDesignOrders * 100).toFixed(2) + '%' : '100%'
    };
  }
}