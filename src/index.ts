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
dotenv.config();

export const app = express();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Define allowed origins
const allowedOrigins = [
  'http://82.29.160.117:3000',  // Current frontend URL
  'https://styledev.in',         // Future domain
  'http://styledev.in',          // Future domain (non-HTTPS)
  'http://localhost:3000',       // Local development
  'http://localhost:3001',       // Local backend
];

// Middleware setup
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(uploadsDir, {
  maxAge: '1d', // Cache for 1 day
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    // Set proper content type for images
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (path.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (path.endsWith('.gif')) {
      res.setHeader('Content-Type', 'image/gif');
    } else if (path.endsWith('.webp')) {
      res.setHeader('Content-Type', 'image/webp');
    }
    
    // Enable CORS for images
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  }
}));

app.use('/uploads', (req, res, next) => {
  res.status(404).json({ 
    error: 'File not found',
    message: `The requested file ${req.path} was not found on the server.`
  });
});

// Health check endpoint
app.get('/uploads/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    uploadsDir: uploadsDir,
    exists: fs.existsSync(uploadsDir)
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
// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
