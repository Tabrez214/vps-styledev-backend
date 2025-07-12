import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import userRouter from './routes/user'; 
import productRouter from './routes/product'; 
import uploadRouter from './routes/upload'; 
import orderRouter from './routes/order'; 
import wishlistRouter from './routes/wishlist'
import cartRouter from './routes/cart'
import categoryRouter from './routes/category'
import addressRouter from './routes/address'
import authRouter from './routes/auth'
import paymentRouter from './routes/payment'
import discountRouter from './routes/discount-codes'
import path from 'path';
import fs from 'fs';
import subscribeRouter from './routes/subscribe';
import tshirtOrdersFormRouter from './routes/tshirtOrdersForm';
import contactFormRouter from './routes/contactForm';
import profileRouter from './routes/profile/profile';
import chooseShirtRouter from './routes/design-studio/choose-shirt';
import clipartLibraryRouter from './routes/design-studio/clipart-library';
import designRoutes from './routes/design-studio/designRoutes';
import assetRoutes from './routes/design-studio/asset';
import designStudioUploadRouter from './routes/design-studio/upload';
import emailRouter from './routes/email';
import invoiceRouter from './routes/invoiceGenerator';
import reviewRouter from './routes/review';
dotenv.config();

export const app = express();

// Create uploads directory with proper path resolution
const uploadsDir = path.resolve(process.cwd(), 'uploads');
console.log('Uploads directory:', uploadsDir);
console.log('Directory exists:', fs.existsSync(uploadsDir));

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory');
}

// Define allowed origins
const allowedOrigins = [
  'http://82.29.160.117:3000',
  'https://styledev.in',
  'http://styledev.in',
  'http://localhost:3000',
  'http://localhost:3001',
];

// Middleware setup
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

// Increase body size limits for design studio uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Debug middleware to log all requests to /uploads
app.use('/uploads', (req, res, next) => {
  console.log('Request to uploads:', req.path);
  const fullPath = path.join(uploadsDir, req.path);
  console.log('Full file path:', fullPath);
  console.log('File exists:', fs.existsSync(fullPath));
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    console.log('File stats:', {
      size: stats.size,
      isFile: stats.isFile(),
      permissions: stats.mode.toString(8)
    });
  }
  next();
});

// Static file serving for uploads - MOVED BEFORE OTHER ROUTES
app.use('/uploads', express.static(uploadsDir, {
  maxAge: '1d',
  etag: true,
  lastModified: true,
  dotfiles: 'deny',
  index: false,
  setHeaders: (res, filePath) => {
    console.log('Serving file:', filePath);
    
    // Set proper content type for images
    const ext = path.extname(filePath).toLowerCase();
    switch(ext) {
      case '.jpg':
      case '.jpeg':
        res.setHeader('Content-Type', 'image/jpeg');
        break;
      case '.png':
        res.setHeader('Content-Type', 'image/png');
        break;
      case '.gif':
        res.setHeader('Content-Type', 'image/gif');
        break;
      case '.webp':
        res.setHeader('Content-Type', 'image/webp');
        break;
    }
    
    // Enable CORS for images
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  }
}));

// Serve t-shirt images from src/tshirt-images
const tshirtImagesDir = path.resolve(process.cwd(), 'src/tshirt-images');
app.use('/tshirt-images', express.static(tshirtImagesDir, {
  maxAge: '1d',
  etag: true,
  lastModified: true,
  dotfiles: 'deny',
  index: false,
  setHeaders: (res, filePath) => {
    console.log('Serving t-shirt image:', filePath);
    
    // Set proper content type for images
    const ext = path.extname(filePath).toLowerCase();
    switch(ext) {
      case '.jpg':
      case '.jpeg':
        res.setHeader('Content-Type', 'image/jpeg');
        break;
      case '.png':
        res.setHeader('Content-Type', 'image/png');
        break;
    }
    
    // Enable CORS for images
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  }
}));

// Health check endpoint
app.get('/uploads/health', (req, res) => {
  const testFile = 'category-1749047438829.jpg';
  const testPath = path.join(uploadsDir, testFile);
  
  res.json({ 
    status: 'ok', 
    uploadsDir: uploadsDir,
    exists: fs.existsSync(uploadsDir),
    testFile: {
      name: testFile,
      path: testPath,
      exists: fs.existsSync(testPath),
      stats: fs.existsSync(testPath) ? fs.statSync(testPath) : null
    },
    files: fs.readdirSync(uploadsDir).slice(0, 10) // Show first 10 files
  });
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || "")
.then(() => console.log("Connected to MongoDB"))
.catch((err) => console.error("MongoDB connection error:", err));

// Define the root route
app.get('/', (req, res) => {
  res.send('Welcome to Styldev');
});

// Use the auth router for '/auth' routes
app.use('/auth', authRouter);

// Use the user router for '/user' routes
app.use('/user', userRouter);

app.use('/', productRouter)

app.use('/api', uploadRouter)

app.use('/orders', orderRouter)

app.use('/wishlist', wishlistRouter);
app.use('/cart', cartRouter);
app.use('/category', categoryRouter)
app.use('/address', addressRouter)

// Use the payment router for payment-related routes
app.use('/api/v1/payment', paymentRouter);
app.use('/discount-codes', discountRouter);

app.use('/', subscribeRouter);
app.use('/form-order', tshirtOrdersFormRouter);
app.use('/contact', contactFormRouter);
app.use('/profile', profileRouter);
// Design Studio routes - all under /design-studio prefix
app.use('/design-studio/choose-shirt', chooseShirtRouter);
app.use('/design-studio/clipart-library', clipartLibraryRouter);
app.use('/design-studio', designStudioUploadRouter); // Design studio file uploads
app.use('/designs', designRoutes);
app.use('/assets', assetRoutes);
app.use('/email', emailRouter);
app.use('/invoices', invoiceRouter);
app.use('/api', reviewRouter);

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Static files served from: ${uploadsDir}`);
});