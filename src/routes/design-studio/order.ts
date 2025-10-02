import express from 'express';
import { param, body, query, validationResult } from 'express-validator';
import * as orderController from '../../controllers/design-studio/order';
import { authMiddleware } from '../../middleware/authMiddleware';
import { requireAdmin } from '../../middleware/requireAuthAdapter';


const router = express.Router();

// Global error handler for validation
const handleValidationErrors = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array()
    });
  }
  next();
};

/**
 * @route   POST /design-studio/orders
 * @desc    Create a new order
 * @access  Public
 */
router.post(
  '/',
  [
    body('designId')
      .isMongoId()
      .withMessage('Valid design ID is required'),
    body('customer').notEmpty().withMessage('Customer information is required'),
    body('customer.name')
      .notEmpty()
      .isLength({ min: 2, max: 100 })
      .matches(/^[a-zA-Z\s]+$/)
      .withMessage('Customer name must be 2-100 characters and contain only letters and spaces'),
    body('customer.email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid customer email is required'),
    body('customer.phone')
      .notEmpty()
      .matches(/^[\d\s\-\+\(\)]+$/)
      .isLength({ min: 10, max: 20 })
      .withMessage('Valid customer phone number is required (10-20 digits)'),
    body('customer.address').notEmpty().withMessage('Customer address is required'),
    body('customer.address.street')
      .notEmpty()
      .isLength({ min: 5, max: 200 })
      .withMessage('Street address must be 5-200 characters'),
    body('customer.address.city')
      .notEmpty()
      .isLength({ min: 2, max: 100 })
      .matches(/^[a-zA-Z\s]+$/)
      .withMessage('City must be 2-100 characters and contain only letters and spaces'),
    body('customer.address.state')
      .notEmpty()
      .isLength({ min: 2, max: 100 })
      .matches(/^[a-zA-Z\s]+$/)
      .withMessage('State must be 2-100 characters and contain only letters and spaces'),
    body('customer.address.zipCode')
      .notEmpty()
      .matches(/^[\d\-\s]+$/)
      .isLength({ min: 3, max: 15 })
      .withMessage('Valid zip code is required'),
    body('customer.address.country')
      .notEmpty()
      .isLength({ min: 2, max: 100 })
      .matches(/^[a-zA-Z\s]+$/)
      .withMessage('Country must be 2-100 characters and contain only letters and spaces'),
    body('sizes')
      .isArray({ min: 1 })
      .withMessage('At least one size and quantity is required'),
    body('sizes.*.size')
      .notEmpty()
      .isIn(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'])
      .withMessage('Valid size is required'),
    body('sizes.*.quantity')
      .isInt({ min: 1, max: 100 })
      .withMessage('Quantity must be between 1 and 100'),
    body('specialInstructions')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Special instructions must not exceed 500 characters')
  ],
  handleValidationErrors,
  orderController.createOrder
);

/**
 * @route   GET /design-studio/orders/:id
 * @desc    Get order by ID or order number
 * @access  Public (in production, should require auth or order access token)
 */
router.get(
  '/:id',
  [
    param('id')
      .notEmpty()
      .withMessage('Order ID is required'),
    query('accessToken')
      .optional()
      .isLength({ min: 1, max: 200 })
      .withMessage('Access token must be valid if provided')
  ],
  handleValidationErrors,
  orderController.getOrderById
);

/**
 * @route   GET /design-studio/orders/tracking/:orderNumber
 * @desc    Get order by order number for tracking
 * @access  Public
 */
router.get(
  '/tracking/:orderNumber',
  [
    param('orderNumber')
      .notEmpty()
      .isLength({ min: 6, max: 20 })
      .matches(/^[A-Z0-9\-]+$/)
      .withMessage('Valid order number is required')
  ],
  handleValidationErrors,
  orderController.getOrderByNumber
);

/**
 * @route   GET /design-studio/orders
 * @desc    Get all orders (admin only)
 * @access  Admin
 */
router.get(
  '/',
  requireAdmin, // Add admin middleware
  [
    query('page')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Page must be between 1 and 1000'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('status')
      .optional()
      .isIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled'])
      .withMessage('Invalid status filter'),
    query('paymentStatus')
      .optional()
      .isIn(['pending', 'paid', 'failed', 'refunded'])
      .withMessage('Invalid payment status filter'),
    query('sortBy')
      .optional()
      .isIn(['createdAt', 'updatedAt', 'totalAmount', 'orderNumber'])
      .withMessage('Invalid sort field'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be asc or desc')
  ],
  handleValidationErrors,
  orderController.getAllOrders
);

/**
 * @route   PUT /design-studio/orders/:id/status
 * @desc    Update order status
 * @access  Admin
 */
router.put(
  '/:id/status',
  requireAdmin, // Add admin middleware
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid order ID format'),
    body('status')
      .isIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled'])
      .withMessage('Invalid status value'),
    body('statusNote')
      .optional()
      .isLength({ max: 200 })
      .withMessage('Status note must not exceed 200 characters'),
    body('trackingNumber')
      .optional()
      .isLength({ min: 5, max: 50 })
      .withMessage('Tracking number must be 5-50 characters if provided')
  ],
  handleValidationErrors,
  orderController.updateOrderStatus
);

/**
 * @route   PUT /design-studio/orders/:id/payment
 * @desc    Update payment status
 * @access  Admin
 */
router.put(
  '/:id/payment',
  requireAdmin, // Add admin middleware
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid order ID format'),
    body('paymentStatus')
      .isIn(['pending', 'paid', 'failed', 'refunded'])
      .withMessage('Invalid payment status value'),
    body('paymentMethod')
      .optional()
      .isIn(['credit_card', 'debit_card', 'paypal', 'stripe', 'cash', 'bank_transfer'])
      .withMessage('Invalid payment method'),
    body('transactionId')
      .optional()
      .isLength({ min: 5, max: 100 })
      .withMessage('Transaction ID must be 5-100 characters if provided'),
    body('paymentNote')
      .optional()
      .isLength({ max: 200 })
      .withMessage('Payment note must not exceed 200 characters')
  ],
  handleValidationErrors,
  orderController.updatePaymentStatus
);

/**
 * @route   POST /design-studio/orders/:id/refund
 * @desc    Process order refund
 * @access  Admin
 */
router.post(
  '/:id/refund',
  requireAdmin, // Add admin middleware
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid order ID format'),
    body('refundAmount')
      .isFloat({ min: 0.01 })
      .withMessage('Refund amount must be greater than 0'),
    body('refundReason')
      .notEmpty()
      .isLength({ min: 10, max: 500 })
      .withMessage('Refund reason must be 10-500 characters'),
    body('refundMethod')
      .optional()
      .isIn(['original_payment', 'store_credit', 'bank_transfer'])
      .withMessage('Invalid refund method')
  ],
  handleValidationErrors,
  orderController.processRefund
);

/**
 * @route   DELETE /design-studio/orders/:id
 * @desc    Cancel an order (soft delete)
 * @access  Admin or Order Owner
 */
router.delete(
  '/:id',
  authMiddleware, // Add authentication middleware
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid order ID format'),
    body('cancellationReason')
      .optional()
      .isLength({ max: 200 })
      .withMessage('Cancellation reason must not exceed 200 characters')
  ],
  handleValidationErrors,
  orderController.cancelOrder
);

export default router;