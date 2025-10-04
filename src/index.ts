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
import serverTimeRoutes from './routes/serverTime';
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
// import emailRouter from './routes/email';
// import invoiceRouter from './routes/invoiceGenerator';
import reviewRouter from './routes/review';
// import designSubmissionRouter from './routes/designSubmission';
import feedRouter from './routes/feed';
import adminStatusManagementRouter from './routes/admin/statusManagement';
// import emailCampaignRoutes from './routes/emailCampaign'; // COMMENTED OUT DUE TO MISSING EXPORTS
// import CronService from './services/cronService';
import { errorHandler } from './middleware/errorMiddleware';
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
  'https://www.styledev.in',
  'http://www.styledev.in',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'https://api.razorpay.com',
  'https://checkout.razorpay.com',
  'https://lumberjack.razorpay.com',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
];

console.log('✅ 2. CORS origins defined');

// Middleware setup
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'x-csrf-token', 'x-session-id'],
  optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  preflightContinue: false // Pass control to next handler
}));

// Handle OPTIONS requests explicitly
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  if ((origin && allowedOrigins.includes(origin)) || !origin) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, x-csrf-token, x-session-id, x-razorpay-signature');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).send();
});

// Special handling for Razorpay webhooks (no CORS needed)
app.use('/api/payment/webhook', (req, res, next) => {
  // Razorpay webhooks don't need CORS as they're server-to-server
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

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
    switch (ext) {
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
    switch (ext) {
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

// MongoDB connection setup (completely non-blocking)
function connectToMongoDB() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set in environment variables');
    console.error('⚠️  Server will start without database connection');
    return;
  }

  console.log('🔄 Attempting to connect to MongoDB...');

  // Start connection attempt asynchronously
  setTimeout(() => {
    mongoose.connect(process.env.MONGODB_URI!, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      bufferCommands: false
    })
      .then(() => {
        console.log("✅ Connected to MongoDB");
        console.log("📊 Database:", mongoose.connection.db?.databaseName || 'Unknown');
      })
      .catch((err) => {
        console.error("❌ MongoDB connection failed:", err.message);
        if (err.name === 'MongoServerSelectionError') {
          console.error("💡 Possible solutions:");
          console.error("   - Check your internet connection");
          console.error("   - Verify MongoDB Atlas cluster is running");
          console.error("   - Check if IP address is whitelisted (0.0.0.0/0)");
          console.error("   - Verify username/password in connection string");
          console.error("   - Try running: node test_mongodb_connection.js");
        }
        console.error("⚠️  Server running without database connection");
      });
  }, 100); // Small delay to ensure server starts first
}

// Handle MongoDB connection events
mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB runtime error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB disconnected - attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});

process.on('SIGINT', async () => {
  console.log('\n🔄 Gracefully shutting down...');
  try {
    await mongoose.connection.close();
    console.log('🔐 MongoDB connection closed.');
  } catch (err) {
    console.log('⚠️  Error closing MongoDB connection');
  }
  process.exit(0);
});

// Define the root route
app.get('/', (req, res) => {
  res.send('Welcome to Styldev');
});

// Use the auth router for '/auth' routes
app.use('/auth', authRouter);
app.use('/auth', serverTimeRoutes);

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
app.use('/api/payment', paymentRouter);
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
// app.use('/email', emailRouter);
// app.use('/invoices', invoiceRouter);
app.use('/api', reviewRouter);
// app.use('/design-challenge', designSubmissionRouter);

// Google Shopping feed route
app.use('/', feedRouter);

// Admin routes
app.use('/api/admin/status-management', adminStatusManagementRouter);

// app.use('/email-campaigns', emailCampaignRoutes);

// Global error handler - MUST be last middleware
app.use(errorHandler);

// 404 handler for unmatched routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Initialize cron jobs for email campaigns
// CronService.initializeCronJobs();

// Start MongoDB connection (non-blocking)
connectToMongoDB();

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📁 Static files served from: ${uploadsDir}`);
  console.log(`🌐 Server URL: http://localhost:${PORT}`);
  console.log(`ℹ️  MongoDB connection will appear above once established`);
  console.log(`ℹ️  To test MongoDB: node test_mongodb_connection.js\n`);
});