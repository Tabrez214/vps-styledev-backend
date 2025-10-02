import express from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Simple validation middleware
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
 * @route   POST /api/orders
 * @desc    Create a new order (simplified for frontend)
 * @access  Public
 */
router.post(
  '/',
  [
    body('designId').notEmpty().withMessage('Design ID is required'),
    body('customer').notEmpty().withMessage('Customer information is required'),
    body('customer.name').notEmpty().withMessage('Customer name is required'),
    body('customer.email').isEmail().withMessage('Valid customer email is required'),
    body('customer.phone').notEmpty().withMessage('Customer phone is required'),
    body('customer.address').notEmpty().withMessage('Customer address is required'),
    body('sizes').isArray({ min: 1 }).withMessage('At least one size is required'),
    body('shippingMethod').isIn(['standard', 'rush']).withMessage('Valid shipping method required')
  ],
  handleValidationErrors,
  async (req: any, res: any) => {
    try {
      const { designId, customer, sizes, shippingMethod, specialInstructions } = req.body;
      
      // Temporarily disabled for testing
      // const design = await Design.findOne({ 
      //   $or: [
      //     { _id: designId },
      //     { shareableId: designId }
      //   ]
      // });
      
      // if (!design) {
      //   return res.status(404).json({
      //     success: false,
      //     message: 'Design not found'
      //   });
      // }
      
      // Mock design for testing
      const design = { elements: [] };
      
      // Convert sizes array to map
      const sizesMap: { [key: string]: number } = {};
      sizes.forEach((item: any) => {
        sizesMap[item.size] = item.quantity;
      });
      
      // Calculate total quantity
      const totalQuantity = Object.values(sizesMap).reduce((sum, qty) => sum + qty, 0);
      
      // Simple pricing calculation
      const basePrice = 15.99;
      const elementCosts = design.elements.length * 2.50; // $2.50 per element
      const subtotal = (basePrice + elementCosts) * totalQuantity;
      const tax = subtotal * 0.08; // 8% tax
      const shipping = shippingMethod === 'rush' ? 25 : 8;
      const total = subtotal + tax + shipping;
      
      // Generate order number
      const orderNumber = `ORD-${Date.now()}-${uuidv4().slice(0, 6).toUpperCase()}`;
      
      // Temporarily disabled for testing
      // const newOrder = new Order({...});
      // await newOrder.save();
      
      // Mock order creation
      
      res.status(201).json({
        success: true,
        orderNumber: orderNumber,
        total: total,
        message: 'Order created successfully (mock)'
      });
      
    } catch (error) {
      console.error('Order creation error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

/**
 * @route   GET /api/orders/:orderNumber
 * @desc    Get order by order number
 * @access  Public
 */
router.get('/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    
    // Mock response for testing
    res.json({
      success: true,
      order: {
        orderNumber: orderNumber,
        status: 'pending',
        paymentStatus: 'pending',
        totalAmount: 50.00,
        customer: { name: 'Test Customer' }
      }
    });
    
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;
