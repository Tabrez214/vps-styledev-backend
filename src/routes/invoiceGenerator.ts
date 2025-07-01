import express, { Request, Response } from 'express';
import { Invoice, } from '../models/invoiceGenerator';
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
  companyName: z.string().min(1).default('Styledev'),
  companyAddress: z.string().min(1).default('123 Business Street, City, State - 123456'),
  companyPhone: z.string().min(1).default('+91 98765 43210'),
  companyEmail: z.string().email().default('info@styledev.com'),
  gstNumber: z.string().optional(), // Company GST number
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).optional()
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