// asset.ts (TypeScript version)
import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import Asset from '../models/asset';

const router = express.Router();

// Configure multer storage for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadDir: string;

    if (req.body.type === 'clipart') {
      uploadDir = path.join(__dirname, '../../uploads/clipart');
      if (req.body.category) {
        uploadDir = path.join(uploadDir, req.body.category);
      }
    } else {
      uploadDir = path.join(__dirname, '../../uploads/user-uploads');
    }

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${req.body.type || 'user'}-image-${uniqueId}${ext}`;
    cb(null, filename);
  }
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedExtensions = ['.jpeg', '.jpg', '.png', '.gif', '.svg', '.webp', '.pdf', '.psd', '.ai', '.eps'];
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/svg+xml',
    'image/webp',
    'application/pdf',
    'application/postscript', // For AI and EPS
    'image/vnd.adobe.photoshop' // For PSD
  ];

  const fileExt = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.includes(fileExt) || allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only image, PDF, and design files are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

router.post('/images', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded' });
      return;
    }

    const filePath = req.file.path.split('uploads')[1].replace(/\\/g, '/');
    const url = `/uploads${filePath}`;

    const newAsset = new Asset({
      type: req.body.type || 'uploaded',
      category: req.body.category,
      tags: req.body.tags ? req.body.tags.split(',') : [],
      url,
      thumbnailUrl: url, // Placeholder, might need actual thumbnail generation later
      dimensions: {
        width: req.body.width || 0, // Will be updated later if possible
        height: req.body.height || 0,
      },
      metadata: {
        uploadedBy: req.body.uploadedBy || 'user',
        originalFilename: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      }
    });

    await newAsset.save();

    res.status(201).json({
      success: true,
      data: {
        ...newAsset.toObject(),
        id: newAsset._id,
        url,
        thumbnailUrl: url,
      },
      message: 'File uploaded successfully'
    });

  } catch (error: any) {
    console.error('Error uploading file:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

router.get('/clipart/categories', async (req: Request, res: Response) => {
  try {
    const categories = await Asset.distinct('category', {
      type: 'clipart',
      isActive: true
    });

    res.json({ success: true, categories });
  } catch (error) {
    console.error('Error fetching clipart categories:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/clipart/category/:categoryId', async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params;

    const clipart = await Asset.find({
      type: 'clipart',
      category: categoryId,
      isActive: true
    }).select('url thumbnailUrl dimensions tags');

    res.json({ success: true, category: categoryId, clipart });
  } catch (error) {
    console.error('Error fetching clipart by category:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/clipart/search', async (req: Request, res: Response) => {
  try {
    const { query } = req.query;

    if (!query || typeof query !== 'string') {
      res.status(400).json({ success: false, message: 'Search query is required' });
      return;
    }

    const clipart = await Asset.find({
      type: 'clipart',
      isActive: true,
      tags: { $regex: query, $options: 'i' }
    }).select('url thumbnailUrl dimensions tags category');

    res.json({ success: true, query, results: clipart });
  } catch (error) {
    console.error('Error searching clipart:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;