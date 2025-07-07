import express, { Request, Response } from 'express';
import { Invoice, } from '../models/invoiceGenerator';
import Order from '../models/order';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const invoiceItemSchema = z.object({
  description: z.string().min(1).trim(),
  size: z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']),
  color: z.string().min(1),
  customColor: z.string().optional(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  total: z.number().min(0),
  image: z.string().optional()
});

const invoiceSchema = z.object({
  invoiceNumber: z.string().min(1).trim(),
  invoiceType: z.enum(['tax', 'proforma']).default('proforma'),
  date: z.coerce.date(),
  dueDate: z.coerce.date(),
  customerName: z.string().min(1).trim(),
  customerEmail: z.string().email().optional().or(z.literal('')),
  customerAddress: z.string().optional(),
  customerPhone: z.string().optional(),
  customerGstNumber: z.string().optional(), // Added customer GST number
  billingAddress: z.string().min(1).trim(), // Added required billing address
  shippingAddress: z.string().optional(), // Added optional shipping address
  items: z.array(invoiceItemSchema).min(1),
  subtotal: z.number().min(0),
  discountType: z.enum(['percentage', 'amount']),
  discountValue: z.number().min(0),
  discountAmount: z.number().min(0),
  cgst: z.number().min(0).max(100),
  sgst: z.number().min(0).max(100),
  igst: z.number().min(0).max(100),
  cgstAmount: z.number().min(0),
  sgstAmount: z.number().min(0),
  igstAmount: z.number().min(0),
  total: z.number().min(0),
  notes: z.string().optional(),
  // Company information
  companyName: z.string().min(1),
  companyAddress: z.string().min(1),
  companyPhone: z.string().min(1),
  companyEmail: z.string().email(),
  gstNumber: z.string().optional(), // Company GST number
  // Order reference fields
  orderId: z.string().optional(),
  order: z.string().optional(), // MongoDB ObjectId as string
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).optional(),
  // Conversion tracking
  convertedFrom: z.string().optional(), // MongoDB ObjectId as string
  convertedTo: z.string().optional() // MongoDB ObjectId as string
});

const updateInvoiceSchema = invoiceSchema.partial();

// GET /api/invoices - Get all invoices with pagination and filtering
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter: any = {};
    
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    if (req.query.invoiceType) {
      filter.invoiceType = req.query.invoiceType;
    }
    
    if (req.query.customerName) {
      filter.customerName = { $regex: req.query.customerName, $options: 'i' };
    }
    
    if (req.query.invoiceNumber) {
      filter.invoiceNumber = { $regex: req.query.invoiceNumber, $options: 'i' };
    }
    
    if (req.query.fromDate || req.query.toDate) {
      filter.date = {};
      if (req.query.fromDate) {
        filter.date.$gte = new Date(req.query.fromDate as string);
      }
      if (req.query.toDate) {
        filter.date.$lte = new Date(req.query.toDate as string);
      }
    }

    const invoices = await Invoice.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v');

    const total = await Invoice.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        invoices,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount: total,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
    return;
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching invoices',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return;
  }
});

// GET /api/invoices/:id - Get invoice by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const invoice = await Invoice.findById(req.params.id).select('-__v');
    
    if (!invoice) {
      res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
      return;
    }

    res.json({
      success: true,
      data: invoice
    });
    return;
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching invoice',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return;
  }
});

// GET /api/invoices/number/:invoiceNumber - Get invoice by invoice number
router.get('/number/:invoiceNumber', async (req: Request, res: Response) => {
  try {
    const invoice = await Invoice.findOne({ 
      invoiceNumber: req.params.invoiceNumber 
    }).select('-__v');
    
    if (!invoice) {
      res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
      return;
    }

    res.json({
      success: true,
      data: invoice
    });
    return;
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching invoice',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return;
  }
});

// POST /api/invoices - Create new invoice
router.post('/', async (req: Request, res: Response) => {
  try {
    const validationResult = invoiceSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validationResult.error.errors.map(error => ({
          field: error.path.join('.'),
          message: error.message
        }))
      });
      return;
    }

    const value = validationResult.data;

    // Check if invoice number already exists
    const existingInvoice = await Invoice.findOne({ 
      invoiceNumber: value.invoiceNumber 
    });
    
    if (existingInvoice) {
      res.status(409).json({
        success: false,
        message: 'Invoice number already exists'
      });
      return;
    }

    const invoice = new Invoice(value);
    await invoice.save();

    // If order reference is provided, update the order with the invoice reference
    if (value.order || value.orderId) {
      try {
        let orderQuery: any = {};
        
        if (value.order) {
          orderQuery._id = value.order;
        } else if (value.orderId) {
          orderQuery.order_id = value.orderId;
        }

        const updatedOrder = await Order.findOneAndUpdate(
          orderQuery,
          { invoice: invoice._id },
          { new: true }
        );

        if (updatedOrder) {
          console.log(`Invoice ${invoice.invoiceNumber} linked to order ${updatedOrder.order_id}`);
        } else {
          console.warn(`Order not found for linking with invoice ${invoice.invoiceNumber}`);
        }
      } catch (orderUpdateError) {
        console.error('Error linking invoice to order:', orderUpdateError);
        // Don't fail the invoice creation if order linking fails
      }
    }

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: invoice
    });
    return;
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating invoice',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return;
  }
});

// PUT /api/invoices/:id - Update invoice
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const validationResult = updateInvoiceSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validationResult.error.errors.map(error => ({
          field: error.path.join('.'),
          message: error.message
        }))
      });
      return;
    }

    const value = validationResult.data;

    // If updating invoice number, check for duplicates
    if (value.invoiceNumber) {
      const existingInvoice = await Invoice.findOne({ 
        invoiceNumber: value.invoiceNumber,
        _id: { $ne: req.params.id }
      });
      
      if (existingInvoice) {
        res.status(409).json({
          success: false,
          message: 'Invoice number already exists'
        });
        return;
      }
    }

    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      value,
      { new: true, runValidators: true }
    ).select('-__v');

    if (!invoice) {
      res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
      return;
    }

    // If order reference is being updated, handle the linking
    if (value.order || value.orderId) {
      try {
        let orderQuery: any = {};
        
        if (value.order) {
          orderQuery._id = value.order;
        } else if (value.orderId) {
          orderQuery.order_id = value.orderId;
        }

        const updatedOrder = await Order.findOneAndUpdate(
          orderQuery,
          { invoice: invoice._id },
          { new: true }
        );

        if (updatedOrder) {
          console.log(`Invoice ${invoice.invoiceNumber} linked to order ${updatedOrder.order_id}`);
        } else {
          console.warn(`Order not found for linking with invoice ${invoice.invoiceNumber}`);
        }
      } catch (orderUpdateError) {
        console.error('Error linking invoice to order during update:', orderUpdateError);
        // Don't fail the invoice update if order linking fails
      }
    }

    res.json({
      success: true,
      message: 'Invoice updated successfully',
      data: invoice
    });
    return;
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating invoice',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return;
  }
});

// PATCH /api/invoices/:id/status - Update invoice status
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    
    if (!status || !['draft', 'sent', 'paid', 'overdue', 'cancelled'].includes(status)) {
      res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: draft, sent, paid, overdue, cancelled'
      });
      return;
    }

    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    ).select('-__v');

    if (!invoice) {
      res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Invoice status updated successfully',
      data: invoice
    });
    return;
  } catch (error) {
    console.error('Error updating invoice status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating invoice status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return;
  }
});

// DELETE /api/invoices/:id - Delete invoice
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);

    if (!invoice) {
      res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Invoice deleted successfully'
    });
    return;
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting invoice',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return;
  }
});

// GET /api/invoices/search-orders - Search orders for invoice creation
router.get('/search-orders', async (req: Request, res: Response) => {
  try {
    const { query, page = 1, limit = 10 } = req.query;
    
    if (!query || typeof query !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
      return;
    }

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Build search filter
    const searchFilter: any = {
      $or: [
        { order_id: { $regex: query, $options: 'i' } },
        { name: { $regex: query, $options: 'i' } }
      ]
    };

    // Find orders without invoices or with specific order IDs
    const orders = await Order.find(searchFilter)
      .populate('user', 'name email')
      .populate('address', 'fullName phoneNumber streetAddress city state country postalCode')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .select('order_id name totalAmount status createdAt user address invoice');

    const totalCount = await Order.countDocuments(searchFilter);

    const formattedOrders = orders.map(order => ({
      _id: order._id,
      orderId: order.order_id,
      name: order.name,
      totalAmount: order.totalAmount,
      status: order.status,
      date: order.createdAt,
      hasInvoice: !!order.invoice,
      customer: {
        name: (order.user as any)?.name || 'Unknown',
        email: (order.user as any)?.email || 'Unknown'
      },
      address: order.address ? {
        fullName: (order.address as any).fullName,
        phoneNumber: (order.address as any).phoneNumber,
        streetAddress: (order.address as any).streetAddress,
        city: (order.address as any).city,
        state: (order.address as any).state,
        country: (order.address as any).country,
        postalCode: (order.address as any).postalCode
      } : null
    }));

    res.json({
      success: true,
      data: {
        orders: formattedOrders,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalCount / limitNum),
          totalCount,
          hasNext: pageNum < Math.ceil(totalCount / limitNum),
          hasPrev: pageNum > 1
        }
      }
    });
    return;
  } catch (error) {
    console.error('Error searching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching orders',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return;
  }
});

// GET /api/invoices/order/:orderId - Get order details for invoice creation
router.get('/order/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findOne({
      $or: [
        { _id: orderId },
        { order_id: orderId }
      ]
    })
      .populate('user', 'name email')
      .populate('address', 'fullName phoneNumber streetAddress city state country postalCode')
      .populate('items.productId', 'name')
      .populate('invoice', 'invoiceNumber status');

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found'
      });
      return;
    }

    // Format order data for invoice creation
    const orderData = {
      _id: order._id,
      orderId: order.order_id,
      name: order.name,
      totalAmount: order.totalAmount,
      subtotal: order.subtotal,
      discountAmount: order.discountAmount || 0,
      status: order.status,
      date: order.createdAt,
      hasInvoice: !!order.invoice,
      existingInvoice: order.invoice ? {
        invoiceNumber: (order.invoice as any).invoiceNumber,
        status: (order.invoice as any).status
      } : null,
      customer: {
        name: (order.user as any)?.name || 'Unknown',
        email: (order.user as any)?.email || 'Unknown'
      },
      address: order.address ? {
        fullName: (order.address as any).fullName,
        phoneNumber: (order.address as any).phoneNumber,
        streetAddress: (order.address as any).streetAddress,
        city: (order.address as any).city,
        state: (order.address as any).state,
        country: (order.address as any).country,
        postalCode: (order.address as any).postalCode
      } : null,
      items: order.items.map((item: any) => ({
        productId: item.productId?._id,
        productName: item.productId?.name || 'Product',
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity
      }))
    };

    res.json({
      success: true,
      data: orderData
    });
    return;
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching order details',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return;
  }
});

// POST /api/invoices/:id/convert - Convert proforma to tax invoice
router.post('/:id/convert', async (req: Request, res: Response) => {
  try {
    const proformaInvoice = await Invoice.findById(req.params.id);
    
    if (!proformaInvoice) {
      res.status(404).json({
        success: false,
        message: 'Proforma invoice not found'
      });
      return;
    }

    if (proformaInvoice.invoiceType !== 'proforma') {
      res.status(400).json({
        success: false,
        message: 'Only proforma invoices can be converted to tax invoices'
      });
      return;
    }

    if (proformaInvoice.convertedTo) {
      res.status(400).json({
        success: false,
        message: 'This proforma invoice has already been converted to a tax invoice'
      });
      return;
    }

    // Generate new invoice number for tax invoice
    const generateTaxInvoiceNumber = (): string => {
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const timestamp = Date.now().toString().slice(-4);
      
      return `TAX-${year}${month}${day}-${timestamp}`;
    };

    // Create tax invoice from proforma
    const taxInvoiceData = {
      ...proformaInvoice.toObject(),
      _id: undefined, // Remove the _id to create new document
      invoiceNumber: generateTaxInvoiceNumber(),
      invoiceType: 'tax' as const,
      convertedFrom: proformaInvoice._id,
      convertedTo: undefined,
      createdAt: undefined,
      updatedAt: undefined
    };

    const taxInvoice = new Invoice(taxInvoiceData);
    await taxInvoice.save();

    // Update proforma invoice to reference the tax invoice
    proformaInvoice.convertedTo = taxInvoice._id;
    await proformaInvoice.save();

    res.status(201).json({
      success: true,
      message: 'Proforma invoice converted to tax invoice successfully',
      data: {
        proformaInvoice,
        taxInvoice
      }
    });
    return;
  } catch (error) {
    console.error('Error converting invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Error converting invoice',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return;
  }
});

// GET /api/invoices/stats/dashboard - Get dashboard statistics
router.get('/stats/dashboard', async (req: Request, res: Response) => {
  try {
    const currentDate = new Date();
    const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);

    const [
      totalInvoices,
      totalRevenue,
      monthlyRevenue,
      statusCounts,
      recentInvoices
    ] = await Promise.all([
      Invoice.countDocuments(),
      Invoice.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]),
      Invoice.aggregate([
        { 
          $match: { 
            status: 'paid',
            date: { $gte: currentMonth }
          }
        },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]),
      Invoice.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      Invoice.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('invoiceNumber customerName total status date')
    ]);

    const stats = {
      totalInvoices,
      totalRevenue: totalRevenue[0]?.total || 0,
      monthlyRevenue: monthlyRevenue[0]?.total || 0,
      statusBreakdown: statusCounts.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {} as Record<string, number>),
      recentInvoices
    };

    res.json({
      success: true,
      data: stats
    });
    return;
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return;
  }
});

export default router;