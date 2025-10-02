import { Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import Order from '../../models/design-studio/order';
import Design from '../../models/design-studio/design';
import { asyncHandler } from '../../middleware/errorMiddleware';
import { ValidationError, NotFoundError, AuthenticationError } from '../../middleware/errorMiddleware';
import { generatePrinterChallan } from '../../services/design-studio/pdf';
import { sendOrderConfirmationEmail } from '../../services/design-studio/email';
import config from '../../config/config';
import { IOrder, OrderSizes } from '../../interfaces';
import { getUserId, isUserAdmin } from '../../middleware/requireAuthAdapter';

declare module 'express-serve-static-core' {
  interface Request {
    orderContext?: {
      orderId: string;
      orderNumber: string;
      total: number;
    };
    user?: {
      userId: string;
      role: string;
      consent: boolean;
    };
  }
}

// Valid shipping methods
const VALID_SHIPPING_METHODS = ['standard', 'rush'] as const;
type ShippingMethod = typeof VALID_SHIPPING_METHODS[number];

// Valid sizes
const VALID_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const;

// Valid order statuses
const VALID_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
const VALID_PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'] as const;

// Custom validation for sizes object
const validateSizes = (sizes: any): boolean => {
  if (!sizes || typeof sizes !== 'object') return false;
  
  const entries = Object.entries(sizes);
  if (entries.length === 0) return false;
  
  return entries.every(([size, quantity]) => {
    return VALID_SIZES.includes(size as any) && 
           typeof quantity === 'number' && 
           quantity > 0 && 
           Number.isInteger(quantity);
  });
};

function calculateEstimatedDelivery(shippingMethod: string): Date {
  const now = new Date();
  if (shippingMethod === 'rush') {
    now.setDate(now.getDate() + 3); // 3 days for rush
  } else {
    now.setDate(now.getDate() + 7); // 7 days for standard
  }
  return now;
}

/**
 * @route   POST /api/orders
 * @desc    Create a new order
 * @access  Public
 */
export const createOrder = [
  // Validation middleware
  body('designId').isMongoId().withMessage('Valid design ID is required'),
  body('customer').notEmpty().withMessage('Customer information is required'),
  body('customer.name').trim().isLength({ min: 2, max: 100 }).withMessage('Customer name must be between 2 and 100 characters'),
  body('customer.email').isEmail().normalizeEmail().withMessage('Valid customer email is required'),
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
  body('shippingMethod').isIn(VALID_SHIPPING_METHODS).withMessage('Valid shipping method is required (standard or rush)'),
  body('specialInstructions').optional().isLength({ max: 500 }).withMessage('Special instructions must be less than 500 characters'),
  
  // Handler
  asyncHandler(async (req: Request, res: Response) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation error', errors.array());
    }
    
    const { designId, customer, sizes, shippingMethod, specialInstructions } = req.body;
    
    // Start a MongoDB session for transaction
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Find design by ID
        const design = await Design.findOne({ 
          _id: designId,
          'metadata.isDeleted': { $ne: true }
        }).session(session);
        
        if (!design) {
          throw new NotFoundError('Design not found');
        }
        
        // Convert sizes array to object for easier calculation
        const sizesObj: OrderSizes = {};
        sizes.forEach((item: any) => {
          sizesObj[item.size] = item.quantity;
        });
        
        // Calculate total quantity
        const totalQuantity = Object.values(sizesObj).reduce((sum, quantity) => sum + quantity, 0);
        
        if (totalQuantity <= 0) {
          throw new ValidationError('Total quantity must be greater than 0');
        }
        
        // Validate configuration values exist
        if (!config.BASE_TSHIRT_PRICE || !config.TEXT_PRINTING_COST || !config.IMAGE_PRINTING_COST) {
          throw new Error('Pricing configuration is missing');
        }
        
        // Calculate price breakdown
        const basePrice = Number(config.BASE_TSHIRT_PRICE);
        const additionalCosts = [];
        
        // Add cost for text elements
        const textElements = design.elements.filter((el: { type: string; }) => el.type === 'text');
        if (textElements.length > 0) {
          additionalCosts.push({
            description: `Text printing (${textElements.length} element${textElements.length > 1 ? 's' : ''})`,
            amount: Number(config.TEXT_PRINTING_COST) * textElements.length
          });
        }
        
        // Add cost for image/clipart elements
        const imageElements = design.elements.filter((el: { type: string; }) => el.type === 'image' || el.type === 'clipart');
        if (imageElements.length > 0) {
          additionalCosts.push({
            description: `Image printing (${imageElements.length} element${imageElements.length > 1 ? 's' : ''})`,
            amount: Number(config.IMAGE_PRINTING_COST) * imageElements.length
          });
        }
        
        // Add cost for back design
        const backElements = design.elements.filter((el: { view: string; }) => el.view === 'back');
        if (backElements.length > 0) {
          additionalCosts.push({
            description: 'Back design printing',
            amount: Number(config.BACK_DESIGN_COST) || 50
          });
        }
        
        // Add size-based pricing (if applicable)
        const sizePremium = Object.entries(sizesObj).reduce((total, [size, quantity]) => {
          const premium = (size === 'XXXL') ? 30 : (size === 'XXL') ? 20 : (size === 'XL') ? 10 : 0;
          return total + (premium * quantity);
        }, 0);
        
        if (sizePremium > 0) {
          additionalCosts.push({
            description: 'Size premium (XL/XXL/XXXL)',
            amount: sizePremium
          });
        }
        
        // Calculate shipping cost based on method and quantity
        const baseShippingCost = (shippingMethod as ShippingMethod) === 'rush' 
          ? Number(config.RUSH_SHIPPING_COST) || 100
          : Number(config.STANDARD_SHIPPING_COST) || 50;
        
        // Add extra shipping cost for large orders
        const extraShippingCost = totalQuantity > 10 ? Math.ceil(totalQuantity / 10) * 25 : 0;
        const totalShippingCost = baseShippingCost + extraShippingCost;
        
        // Calculate subtotal per item
        const subtotalPerItem = basePrice + additionalCosts.reduce((sum, cost) => sum + cost.amount, 0);
        
        // Calculate total subtotal
        const subtotal = subtotalPerItem * totalQuantity;
        
        // Calculate tax
        const taxRate = Number(config.TAX_RATE) || 0.1;
        const tax = subtotal * taxRate;
        
        // Calculate final total
        const total = subtotal + tax + totalShippingCost;
        
        // Generate unique order number with better format
        const timestamp = Date.now().toString().slice(-6);
        const randomPart = uuidv4().slice(0, 6).toUpperCase();
        const orderNumber = `ORD-${timestamp}-${randomPart}`;
        
        // Create new order
        const newOrder = new Order({
          orderNumber,
          designId: design._id,
          customer,
          sizes: sizesObj,
          totalQuantity,
          priceBreakdown: {
            basePrice,
            additionalCosts,
            subtotal,
            tax,
            shipping: totalShippingCost,
            total: Math.round(total * 100) / 100 // Round to 2 decimal places
          },
          shippingMethod: shippingMethod as ShippingMethod,
          specialInstructions: specialInstructions?.trim(),
          status: 'pending',
          paymentStatus: 'pending',
          estimatedDelivery: calculateEstimatedDelivery(shippingMethod as ShippingMethod),
          metadata: {
            ipAddress: req.ip || 'unknown',
            userAgent: req.headers['user-agent'] || 'unknown',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        
        // Save order to database
        await newOrder.save({ session });
        
        // Store the order ID for use outside the transaction
        req.orderContext = {
          orderId: newOrder._id as string,
          orderNumber: newOrder.orderNumber,
          total: newOrder.priceBreakdown.total
        };
      });
      
      // After successful transaction, handle external services
      const { orderId, orderNumber, total } = req.orderContext as any;
      
      // Generate printer challan (non-blocking for user response)
      let challanGenerated = false;
      try {
        const challanPath = await generatePrinterChallan(orderId);
        await Order.findByIdAndUpdate(orderId, { printerChallanUrl: challanPath });
        challanGenerated = true;
      } catch (challanError) {
        console.error('Failed to generate printer challan:', challanError);
        // Log error but continue with order creation
      }
      
      // Send order confirmation email (non-blocking for user response)
      let emailSent = false;
      try {
        await sendOrderConfirmationEmail(orderId);
        emailSent = true;
      } catch (emailError) {
        console.error('Failed to send order confirmation email:', emailError);
        // Log error but continue with order creation
      }
      
      res.status(201).json({
        success: true,
        orderNumber,
        orderId,
        total,
        challanGenerated,
        emailSent,
        message: 'Order created successfully'
      });
      
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  })
];

/**
 * @route   GET /api/orders/:id
 * @desc    Get order by ID or order number
 * @access  Public (would require auth middleware in production)
 */
export const getOrderById = [
  // Validation middleware
  param('id').notEmpty().withMessage('Order ID or order number is required'),
  query('includeDesign').optional().isBoolean().withMessage('includeDesign must be boolean'),
  
  // Handler
  asyncHandler(async (req: Request, res: Response) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation error', errors.array());
    }
    
    const { id } = req.params;
    const { includeDesign } = req.query;
    
    // Build the query
    let query = Order.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(id) ? id : null },
        { orderNumber: id }
      ],
      'metadata.isDeleted': { $ne: true }
    });
    
    // Populate design if requested
    if (includeDesign === 'true') {
      query = query.populate('designId');
    }
    
    const order = await query.exec();
    
    if (!order) {
      throw new NotFoundError('Order not found');
    }
    
    res.json({
      success: true,
      order: {
        ...order.toObject(),
        // Add calculated fields
        daysUntilDelivery: order.estimatedDelivery 
          ? Math.ceil((order.estimatedDelivery.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null,
        canCancel: order.status === 'pending' && order.paymentStatus !== 'paid'
      }
    });
  })
];

/**
 * @route   GET /api/orders/tracking/:orderNumber
 * @desc    Get order by order number for tracking
 * @access  Public
 */
export const getOrderByNumber = [
  // Validation middleware
  param('orderNumber')
    .notEmpty()
    .isLength({ min: 6, max: 20 })
    .matches(/^[A-Z0-9\-]+$/)
    .withMessage('Valid order number is required'),
  
  // Handler
  asyncHandler(async (req: Request, res: Response) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation error', errors.array());
    }
    
    const { orderNumber } = req.params;
    
    const order = await Order.findOne({
      orderNumber,
      'metadata.isDeleted': { $ne: true }
    }).populate('designId', 'name thumbnail');
    
    if (!order) {
      throw new NotFoundError('Order not found');
    }
    
    // Return limited information for tracking
    res.json({
      success: true,
      order: {
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        estimatedDelivery: order.estimatedDelivery,
        createdAt: order.metadata.createdAt,
        totalAmount: order.priceBreakdown.total,
        daysUntilDelivery: order.estimatedDelivery 
          ? Math.ceil((order.estimatedDelivery.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null
      }
    });
  })
];

/**
 * @route   GET /api/orders
 * @desc    Get all orders (admin only)
 * @access  Admin
 */
export const getAllOrders = [
  // Validation middleware
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
    .isIn(VALID_STATUSES)
    .withMessage('Invalid status filter'),
  query('paymentStatus')
    .optional()
    .isIn(VALID_PAYMENT_STATUSES)
    .withMessage('Invalid payment status filter'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'totalAmount', 'orderNumber'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
  
  // Handler
  asyncHandler(async (req: Request, res: Response) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation error', errors.array());
    }
    
    // Check if user is admin
    if (!req.user || !isUserAdmin(req)) {
      throw new AuthenticationError('Access denied. Admin privileges required.');
    }
    
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const { status, paymentStatus, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    // Build filter
    const filter: any = {
      'metadata.isDeleted': { $ne: true }
    };
    
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    
    // Build sort
    const sort: any = {};
    if (sortBy === 'totalAmount') {
      sort['priceBreakdown.total'] = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'createdAt') {
      sort['metadata.createdAt'] = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'updatedAt') {
      sort['metadata.updatedAt'] = sortOrder === 'asc' ? 1 : -1;
    } else {
      sort[sortBy as string] = sortOrder === 'asc' ? 1 : -1;
    }
    
    const skip = (page - 1) * limit;
    
    // Get orders with pagination
    const [orders, totalCount] = await Promise.all([
      Order.find(filter)
        .populate('designId', 'name thumbnail')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .exec(),
      Order.countDocuments(filter)
    ]);
    
    const totalPages = Math.ceil(totalCount / limit);
    
    res.json({
      success: true,
      orders,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  })
];

/**
 * @route   PUT /api/orders/:id/status
 * @desc    Update order status
 * @access  Admin
 */
export const updateOrderStatus = [
  // Validation middleware
  param('id').isMongoId().withMessage('Invalid order ID format'),
  body('status')
    .isIn(VALID_STATUSES)
    .withMessage('Invalid status value'),
  body('statusNote')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Status note must not exceed 200 characters'),
  body('trackingNumber')
    .optional()
    .isLength({ min: 5, max: 50 })
    .withMessage('Tracking number must be 5-50 characters if provided'),
  
  // Handler
  asyncHandler(async (req: Request, res: Response) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation error', errors.array());
    }
    
    // Check if user is admin
    if (!req.user || !isUserAdmin(req)) {
      throw new AuthenticationError('Access denied. Admin privileges required.');
    }
    
    const { id } = req.params;
    const { status, statusNote, trackingNumber } = req.body;
    
    // Find order by ID
    const order = await Order.findById(id);
    
    if (!order) {
      throw new NotFoundError('Order not found');
    }
    
    // Update status and related fields
    const updateData: any = {
      status,
      'metadata.updatedAt': new Date()
    };
    
    if (statusNote) updateData.statusNote = statusNote;
    if (trackingNumber) updateData.trackingNumber = trackingNumber;
    
    // Update order
    await Order.findByIdAndUpdate(id, updateData);
    
    res.json({
      success: true,
      orderNumber: order.orderNumber,
      status,
      message: 'Order status updated successfully'
    });
  })
];

/**
 * @route   PUT /api/orders/:id/payment
 * @desc    Update payment status
 * @access  Admin
 */
export const updatePaymentStatus = [
  // Validation middleware
  param('id').isMongoId().withMessage('Invalid order ID format'),
  body('paymentStatus')
    .isIn(VALID_PAYMENT_STATUSES)
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
    .withMessage('Payment note must not exceed 200 characters'),
  
  // Handler
  asyncHandler(async (req: Request, res: Response) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation error', errors.array());
    }
    
    // Check if user is admin
    if (!req.user || !isUserAdmin(req)) {
      throw new AuthenticationError('Access denied. Admin privileges required.');
    }
    
    const { id } = req.params;
    const { paymentStatus, paymentMethod, transactionId, paymentNote } = req.body;
    
    // Find order by ID
    const order = await Order.findById(id);
    
    if (!order) {
      throw new NotFoundError('Order not found');
    }
    
    // Update payment status and related fields
    const updateData: any = {
      paymentStatus,
      'metadata.updatedAt': new Date()
    };
    
    if (paymentMethod) updateData.paymentMethod = paymentMethod;
    if (transactionId) updateData.transactionId = transactionId;
    if (paymentNote) updateData.paymentNote = paymentNote;
    
    // Update order
    await Order.findByIdAndUpdate(id, updateData);
    
    res.json({
      success: true,
      orderNumber: order.orderNumber,
      paymentStatus,
      message: 'Payment status updated successfully'
    });
  })
];

/**
 * @route   POST /api/orders/:id/refund
 * @desc    Process order refund
 * @access  Admin
 */
export const processRefund = [
  // Validation middleware
  param('id').isMongoId().withMessage('Invalid order ID format'),
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
    .withMessage('Invalid refund method'),
  
  // Handler
  asyncHandler(async (req: Request, res: Response) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation error', errors.array());
    }
    
    // Check if user is admin
    if (!req.user || !isUserAdmin(req)) {
      throw new AuthenticationError('Access denied. Admin privileges required.');
    }
    
    const { id } = req.params;
    const { refundAmount, refundReason, refundMethod = 'original_payment' } = req.body;
    
    // Find order by ID
    const order = await Order.findById(id);
    
    if (!order) {
      throw new NotFoundError('Order not found');
    }
    
    // Validate refund amount doesn't exceed order total
    if (refundAmount > order.priceBreakdown.total) {
      throw new ValidationError('Refund amount cannot exceed order total');
    }
    
    // Check if order can be refunded
    if (order.paymentStatus !== 'paid') {
      throw new ValidationError('Order must be paid to process refund');
    }
    
    // Process refund
    const refundId = uuidv4();
    const updateData = {
      paymentStatus: 'refunded',
      refund: {
        refundId,
        amount: refundAmount,
        reason: refundReason,
        method: refundMethod,
        processedAt: new Date(),
        processedBy: getUserId(req)
      },
      'metadata.updatedAt': new Date()
    };
    
    await Order.findByIdAndUpdate(id, updateData);
    
    res.json({
      success: true,
      orderNumber: order.orderNumber,
      refundId,
      refundAmount,
      message: 'Refund processed successfully'
    });
  })
];

/**
 * @route   DELETE /api/orders/:id
 * @desc    Cancel an order (soft delete)
 * @access  Admin or Order Owner
 */
export const cancelOrder = [
  // Validation middleware
  param('id').isMongoId().withMessage('Invalid order ID format'),
  body('cancellationReason')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Cancellation reason must not exceed 200 characters'),
  
  // Handler
  asyncHandler(async (req: Request, res: Response) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation error', errors.array());
    }
    
    // Check if user is authenticated
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { id } = req.params;
    const { cancellationReason } = req.body;
    
    // Find order by ID
    const order = await Order.findById(id);
    
    if (!order) {
      throw new NotFoundError('Order not found');
    }
    
    // Check if order can be cancelled
    if (order.status === 'shipped' || order.status === 'delivered') {
      throw new ValidationError('Cannot cancel shipped or delivered orders');
    }
    
    if (order.status === 'cancelled') {
      throw new ValidationError('Order is already cancelled');
    }
    
    // Check if user can cancel this order (admin or order owner)
    const isAdmin = isUserAdmin(req);
    // For now, we'll allow any authenticated user to cancel (in production, you'd check order ownership)
    
    // Cancel order
    const updateData = {
      status: 'cancelled',
      cancellationReason,
      cancelledAt: new Date(),
      cancelledBy: getUserId(req),
      'metadata.updatedAt': new Date()
    };
    
    await Order.findByIdAndUpdate(id, updateData);
    
    res.json({
      success: true,
      orderNumber: order.orderNumber,
      message: 'Order cancelled successfully'
    });
  })
];

export default {
  createOrder,
  getOrderById,
  getOrderByNumber,
  getAllOrders,
  updateOrderStatus,
  updatePaymentStatus,
  processRefund,
  cancelOrder
};