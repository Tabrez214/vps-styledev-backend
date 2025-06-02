import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import TShirtOrder, { ITShirtOrder } from '../models/tshirtOrdersForm';

const router = express.Router();

// Get absolute path to uploads directory
const uploadsDir = path.resolve(process.cwd(), 'uploads');

// Ensure uploads directory exists with proper error handling
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Uploads directory created at:', uploadsDir);
  } else {
    console.log('Uploads directory exists at:', uploadsDir);
  }
} catch (error) {
  console.error('Error creating uploads directory:', error);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use absolute path and ensure directory exists
    try {
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      console.log('Saving file to:', uploadsDir);
      cb(null, uploadsDir);
    } catch (error) {
      console.error('Error in destination function:', error);
      cb(error as Error, '');
    }
  },
  filename: (req, file, cb) => {
    try {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const filename = file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname);
      console.log('Generated filename:', filename);
      cb(null, filename);
    } catch (error) {
      console.error('Error in filename function:', error);
      cb(error as Error, '');
    }
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  // Allow only image files and PDFs
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and PDF files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter
});

// Interface for request body
interface OrderRequestBody {
  name: string;
  email: string;
  phone: string;
  tShirtType: string;
  quantity: string;
  sizes: { size: string; quantity: number }[];
  colorPreference: string;
  customText?: string;
  deliveryLocation: string;
  deliveryDate: string;
}

// POST /api/submit-order
router.post('/submit-order', upload.single('fileUpload'), async (req: Request, res: Response) => {
  try {
    console.log('Request received for order submission');
    console.log('File info:', req.file ? {
      originalname: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size
    } : 'No file uploaded');

    const {
      name,
      email,
      phone,
      tShirtType,
      quantity,
      sizes,
      colorPreference,
      customText,
      deliveryLocation,
      deliveryDate
    }: OrderRequestBody = req.body;

    // Validate required fields
    if (!name || !email || !tShirtType || !quantity || !sizes || !Array.isArray(sizes) || sizes.length === 0 || !colorPreference || !deliveryLocation || !deliveryDate) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields',
        required: ['name', 'email', 'tShirtType', 'quantity', 'sizes', 'colorPreference', 'deliveryLocation', 'deliveryDate']
      }); 
      return;
    }

    // Convert quantity to number
    const quantityNum = parseInt(quantity);
    if (isNaN(quantityNum) || quantityNum < 1) {
      res.status(400).json({
        success: false,
        message: 'Quantity must be a valid number greater than 0'
      });
      return;
    }

    // Validate sizes array
    for (const s of sizes) {
      if (!s.size || typeof s.size !== 'string' || typeof s.quantity !== 'number' || s.quantity < 1) {
        res.status(400).json({
          success: false,
          message: 'Each size entry must have a valid size and quantity > 0.'
        });
        return;
      }
    }

    // Convert delivery date to Date object
    const deliveryDateObj = new Date(deliveryDate);
    if (isNaN(deliveryDateObj.getTime())) {
      res.status(400).json({
        success: false,
        message: 'Invalid delivery date format'
      });
      return;
    }

    // Check if delivery date is in the future
    if (deliveryDateObj <= new Date()) {
      res.status(400).json({
        success: false,
        message: 'Delivery date must be in the future'
      });
      return;
    }

    // Verify file exists if uploaded
    let fileUploadPath = undefined;
    if (req.file) {
      const fullFilePath = req.file.path;
      if (fs.existsSync(fullFilePath)) {
        fileUploadPath = fullFilePath;
        console.log('File successfully saved at:', fullFilePath);
      } else {
        console.error('File was not saved properly:', fullFilePath);
        // Continue without file rather than failing the entire request
      }
    }

    // Prepare order data
    const orderData: Partial<ITShirtOrder> = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim(),
      tShirtType,
      quantity: quantityNum,
      sizes,
      colorPreference: colorPreference.trim(),
      customText: customText?.trim(),
      deliveryLocation: deliveryLocation.trim(),
      deliveryDate: deliveryDateObj,
      fileUpload: fileUploadPath
    };

    // Create new order
    const newOrder = new TShirtOrder(orderData);
    const savedOrder = await newOrder.save();

    // Success response
    res.status(201).json({
      success: true,
      message: 'Order submitted successfully! We\'ll get in touch with you soon.',
      orderId: savedOrder._id,
      data: {
        name: savedOrder.name,
        email: savedOrder.email,
        quantity: savedOrder.quantity,
        tShirtType: savedOrder.tShirtType,
        deliveryDate: savedOrder.deliveryDate,
        hasFileUpload: !!savedOrder.fileUpload
      }
    });

  } catch (error: any) {
    console.error('Order submission error:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map((err: any) => err.message);
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
      return;
    }

    // Handle multer errors
    if (error instanceof multer.MulterError) {
      let message = 'File upload error';
      if (error.code === 'LIMIT_FILE_SIZE') {
        message = 'File too large. Maximum size is 5MB.';
      } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        message = 'Unexpected file field.';
      }
      res.status(400).json({
        success: false,
        message,
        error: error.code
      });
      return;
    }

    // Handle file system errors
    if (error.code === 'ENOENT') {
      res.status(500).json({
        success: false,
        message: 'File system error. Please try again.',
        error: 'Directory access issue'
      });
      return;
    }

    // Handle duplicate email (if you add unique index)
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        message: 'An order with this email already exists'
      });
      return;
    }

    // Generic server error
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
    return;
  }
});

// GET /api/orders (Optional - for admin to view orders)
router.get('/orders', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const orders = await TShirtOrder.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v');

    const totalOrders = await TShirtOrder.countDocuments();

    res.json({
      success: true,
      data: orders,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalOrders / limit),
        totalOrders,
        hasNextPage: page < Math.ceil(totalOrders / limit),
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders'
    });
  }
});

export default router;