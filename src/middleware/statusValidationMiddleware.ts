/**
 * Status Validation Middleware
 * Validates order status transitions and enforces business rules
 */

import { Response, NextFunction } from 'express';
import { StatusManagementService } from '../services/statusManagementService';
import Order from '../models/order';
import { RequestWithUser } from './authMiddleware';

/**
 * Middleware to validate status transitions
 */
export const validateStatusTransition = async (
  req: RequestWithUser,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { status: newStatus, skipValidation } = req.body;

    // Skip validation if explicitly requested (admin override)
    if (skipValidation && req.user?.role === 'admin') {
      return next();
    }

    // Get current order status
    const order = await Order.findById(orderId).select('status');
    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found'
      });
      return;
    }

    // Validate the transition
    try {
      StatusManagementService.validateStatusTransition(order.status, newStatus);
      next();
    } catch (validationError) {
      res.status(400).json({
        success: false,
        message: (validationError as Error).message,
        currentStatus: order.status,
        requestedStatus: newStatus
      });
      return;
    }
  } catch (error) {
    console.error('Status validation middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during status validation'
    });
    return;
  }
};

/**
 * Middleware to validate required fields for status updates
 */
export const validateStatusUpdateFields = (
  req: RequestWithUser,
  res: Response,
  next: NextFunction
): void => {
  const { status } = req.body;
  const { orderId } = req.params;

  // Validate required fields
  if (!status) {
    res.status(400).json({
      success: false,
      message: 'Status is required'
    });
    return;
  }

  if (!orderId) {
    res.status(400).json({
      success: false,
      message: 'Order ID is required'
    });
    return;
  }

  // Validate status format
  if (typeof status !== 'string' || status.trim().length === 0) {
    res.status(400).json({
      success: false,
      message: 'Status must be a non-empty string'
    });
    return;
  }

  // Validate orderId format (MongoDB ObjectId)
  if (!/^[0-9a-fA-F]{24}$/.test(orderId)) {
    res.status(400).json({
      success: false,
      message: 'Invalid order ID format'
    });
    return;
  }

  next();
};

/**
 * Middleware to check if user has permission to update order status
 */
export const validateStatusUpdatePermission = async (
  req: RequestWithUser,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orderId } = req.params;
    const user = req.user;

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    // Admins can update any order
    if (user.role === 'admin') {
      return next();
    }

    // Regular users can only update their own orders (limited status changes)
    if (user.role === 'user') {
      const order = await Order.findById(orderId).select('user status');

      if (!order) {
        res.status(404).json({
          success: false,
          message: 'Order not found'
        });
        return;
      }

      // Check if user owns the order
      if (order.user.toString() !== user.userId.toString()) {
        res.status(403).json({
          success: false,
          message: 'You can only update your own orders'
        });
        return;
      }

      // Users can only cancel pending orders
      const { status: newStatus } = req.body;
      const allowedUserActions: Record<string, string[]> = {
        'pending': ['cancelled']
      };

      const allowedStatuses = allowedUserActions[order.status];
      if (!allowedStatuses || !allowedStatuses.includes(newStatus)) {
        res.status(403).json({
          success: false,
          message: `You cannot change order status from ${order.status} to ${newStatus}`,
          allowedActions: allowedStatuses || []
        });
        return;
      }
    }

    next();
  } catch (error) {
    console.error('Status update permission validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during permission validation'
    });
    return;
  }
};

/**
 * Middleware to add audit information to status updates
 */
export const addStatusUpdateAudit = (
  req: RequestWithUser,
  res: Response,
  next: NextFunction
): void => {
  // Add user information for audit trail
  req.body.changedBy = req.user?.userId || 'system';
  req.body.changedAt = new Date();

  // Add user-friendly reason if not provided
  if (!req.body.reason && req.user) {
    req.body.reason = `Status updated by ${req.user.role}`;
  }

  next();
};

/**
 * Combined middleware chain for status updates
 */
export const statusUpdateMiddleware = [
  validateStatusUpdateFields,
  validateStatusUpdatePermission,
  validateStatusTransition,
  addStatusUpdateAudit
];