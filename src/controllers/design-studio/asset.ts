import { Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import rateLimit from 'express-rate-limit';
import Asset from '../../models/design-studio/asset';
import { asyncHandler } from '../../middleware/errorMiddleware';
import { ValidationError, NotFoundError, AuthenticationError } from '../../middleware/errorMiddleware';
import { requireAuth, getUserId, isUserAdmin } from '../../middleware/requireAuthAdapter';
import config from '../../config/config';
import { IAsset } from '../../interfaces';
import { logger } from '../../utils/logger';

// Rate limiting for file uploads
export const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 uploads per windowMs
  message: {
    success: false,
    message: 'Too many upload attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Enhanced file filter with better security
const fileFilter = (req: Request, file: Express.Multer.File, cb: Function) => {
  const allowedTypes = /^image\/(jpeg|jpg|png|gif|svg\+xml|webp)$/;
  const allowedExtensions = /\.(jpeg|jpg|png|gif|svg|webp)$/i;
  
  const mimetypeValid = allowedTypes.test(file.mimetype);
  const extensionValid = allowedExtensions.test(file.originalname);
  
  if (mimetypeValid && extensionValid) {
    return cb(null, true);
  }
  
  logger.warn(`Invalid file upload attempt: ${file.originalname}, mimetype: ${file.mimetype}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
  
  cb(new ValidationError(`Invalid file type. Only image files (JPEG, PNG, GIF, SVG, WebP) are allowed`));
};

// Configure multer storage for file uploads
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: Function) => {
    let uploadDir: string;
    
    // Sanitize category input
    const sanitizedCategory = req.body.category ? 
      req.body.category.replace(/[^a-zA-Z0-9-_]/g, '') : '';
    
    if (req.body.type === 'clipart') {
      uploadDir = path.join(config.CLIPART_DIR);
      
      // Create category directory if it doesn't exist
      if (sanitizedCategory) {
        uploadDir = path.join(uploadDir, sanitizedCategory);
      }
    } else {
      uploadDir = path.join(config.USER_UPLOADS_DIR);
    }
    
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb: Function) => {
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname).toLowerCase();
    const sanitizedType = (req.body.type || 'user').replace(/[^a-zA-Z0-9-_]/g, '');
    const filename = `${sanitizedType}-image-${uniqueId}${ext}`;
    cb(null, filename);
  }
});

// Configure multer upload with enhanced security
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1 // Only allow 1 file at a time
  }
});

/**
 * Generate thumbnail using Sharp
 */
const generateThumbnail = async (inputPath: string, outputPath: string): Promise<void> => {
  try {
    await sharp(inputPath)
      .resize(200, 200, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .jpeg({ quality: 80 })
      .toFile(outputPath);
    
    logger.info(`Thumbnail generated successfully: ${outputPath}`);
  } catch (error) {
    logger.error('Error generating thumbnail:', error);
    throw new Error('Failed to generate thumbnail');
  }
};

/**
 * Get image dimensions using Sharp
 */
const getImageDimensions = async (imagePath: string): Promise<{ width: number; height: number }> => {
  try {
    const metadata = await sharp(imagePath).metadata();
    return {
      width: metadata.width || 500,
      height: metadata.height || 500
    };
  } catch (error) {
    logger.error('Error getting image dimensions:', error);
    return { width: 500, height: 500 };
  }
};

/**
 * Clean up uploaded files
 */
const cleanupFiles = (filePaths: string[]): void => {
  filePaths.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        logger.info(`Cleaned up file: ${filePath}`);
      } catch (error) {
        logger.error(`Failed to cleanup file: ${filePath}`, error);
      }
    }
  });
};

/**
 * @route   POST /api/assets/images
 * @desc    Upload an image
 * @access  Public (with rate limiting)
 */
export const uploadImage = [
  uploadRateLimit,
  
  // Validation middleware
  body('type')
    .optional()
    .isIn(['clipart', 'uploaded'])
    .withMessage('Type must be either clipart or uploaded'),
  body('category')
    .if(body('type').equals('clipart'))
    .notEmpty()
    .withMessage('Category is required for clipart')
    .isLength({ min: 1, max: 50 })
    .withMessage('Category must be between 1 and 50 characters'),
  body('tags')
    .optional()
    .isString()
    .withMessage('Tags must be a string')
    .customSanitizer(value => {
      if (typeof value === 'string') {
        return value.split(',').map(tag => tag.trim().toLowerCase()).join(',');
      }
      return value;
    }),
  body('uploadedBy')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('UploadedBy must be between 1 and 100 characters')
    .escape(),
  
  // Multer middleware for file upload
  upload.single('image'),
  
  // Handler
  asyncHandler(async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Clean up uploaded file if validation fails
      if (req.file) {
        cleanupFiles([req.file.path]);
      }
      logger.warn('Upload validation failed', { errors: errors.array(), ip: req.ip });
      throw new ValidationError('Validation error', errors.array());
    }

    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }
    
    const filesToCleanup: string[] = [req.file.path];
    
    try {
      // Get actual image dimensions
      const dimensions = await getImageDimensions(req.file.path);
      
      // Generate thumbnail
      const thumbnailPath = req.file.path.replace(
        path.extname(req.file.path), 
        '_thumb.jpg'
      );
      filesToCleanup.push(thumbnailPath);
      
      await generateThumbnail(req.file.path, thumbnailPath);
      
      // Get file paths relative to uploads directory
      const filePath = req.file.path.split('uploads')[1];
      const thumbnailFilePath = thumbnailPath.split('uploads')[1];
      const url = `/uploads${filePath}`;
      const thumbnailUrl = `/uploads${thumbnailFilePath}`;
      
      // Process tags
      const tags = req.body.tags ? 
        req.body.tags.split(',').map((tag: string) => tag.trim().toLowerCase()) : [];
      
      // Get user ID from auth context if available
      const uploadedBy = (req as any).user?.id || req.body.uploadedBy || 'anonymous';
      
      // Generate asset name from filename
      const name = req.body.name || req.file.originalname.replace(/\.[^/.]+$/, ""); // Remove extension
      
      // Create new asset document
      const newAsset = new Asset({
        type: req.body.type || 'uploaded',
        category: req.body.category,
        name,
        tags,
        url,
        thumbnailUrl,
        dimensions,
        metadata: {
          uploadedBy,
          originalFilename: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          uploadedAt: new Date(),
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        },
        isActive: true
      });
      
      // Save asset to database
      await newAsset.save();
      
      const processingTime = Date.now() - startTime;
      
      logger.info('Asset uploaded successfully', {
        assetId: newAsset._id,
        type: newAsset.type,
        category: newAsset.category,
        fileSize: req.file.size,
        processingTime,
        uploadedBy
      });
      
      res.status(201).json({
        success: true,
        data: {
          id: newAsset._id,
          url,
          thumbnailUrl,
          dimensions,
          type: newAsset.type,
          category: newAsset.category,
          tags: newAsset.tags
        },
        message: 'Image uploaded successfully'
      });
      
    } catch (error) {
      // Clean up files if anything fails
      cleanupFiles(filesToCleanup);
      
      if (error instanceof Error) {
        logger.error('Asset upload failed', {
          error: error.message,
          stack: error.stack,
          fileName: req.file.originalname,
          fileSize: req.file.size
        });
      } else {
        logger.error('Asset upload failed with a non-error value', {
          error: String(error),
          fileName: req.file.originalname,
          fileSize: req.file.size
        });
      }                            
      
      throw error;
    }
  })
];

/**
 * @route   GET /api/assets/:assetId
 * @desc    Get asset by ID
 * @access  Public
 */
export const getAssetById = [
  param('assetId')
    .isMongoId()
    .withMessage('Invalid asset ID'),
  
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation error', errors.array());
    }
    
    const { assetId } = req.params;
    
    const asset = await Asset.findById(assetId);
    
    if (!asset || !asset.isActive) {
      throw new NotFoundError('Asset not found');
    }
    
    res.json({
      success: true,
      data: asset
    });
  })
];

/**
 * @route   PATCH /api/assets/:assetId
 * @desc    Update asset metadata
 * @access  Private
 */
export const updateAsset = [
  requireAuth,
  
  param('assetId')
    .isMongoId()
    .withMessage('Invalid asset ID'),
  body('category')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Category must be between 1 and 50 characters'),
  body('tags')
    .optional()
    .isString()
    .withMessage('Tags must be a string'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation error', errors.array());
    }
    
    const { assetId } = req.params;
    const { category, tags, isActive } = req.body;
    
    const asset = await Asset.findById(assetId);
    
    if (!asset) {
      throw new NotFoundError('Asset not found');
    }
    
    // Check if user has permission to update this asset
    const userId = (req as any).user.id;
    if (asset.metadata.uploadedBy !== userId && !(req as any).user.isAdmin) {
      throw new AuthenticationError('You do not have permission to update this asset');
    }
    
    // Update fields
    if (category !== undefined) asset.category = category;
    if (tags !== undefined) {
      asset.tags = tags.split(',').map((tag: string) => tag.trim().toLowerCase());
    }
    if (isActive !== undefined) asset.isActive = isActive;
    
    await asset.save();
    
    logger.info('Asset updated successfully', {
      assetId,
      updatedBy: userId,
      updates: { category, tags, isActive }
    });
    
    res.json({
      success: true,
      data: asset,
      message: 'Asset updated successfully'
    });
  })
];

/**
 * @route   GET /api/assets/clipart/categories
 * @desc    Get all clipart categories with counts
 * @access  Public
 */
export const getClipartCategories = asyncHandler(async (req: Request, res: Response) => {
  try {
    // Get categories with asset counts
    const categoriesWithCounts = await Asset.aggregate([
      {
        $match: {
          type: 'clipart',
          isActive: true
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    const categories = categoriesWithCounts.map(item => ({
      name: item._id,
      count: item.count
    }));
    
    logger.info('Clipart categories retrieved', { totalCategories: categories.length });
    
    res.json({
      success: true,
      data: {
        categories,
        total: categories.length
      }
    });
  } catch (error) {
    logger.error('Error retrieving clipart categories', error);
    throw error;
  }
});

/**
 * @route   GET /api/assets/clipart/category/:categoryId
 * @desc    Get clipart by category with pagination
 * @access  Public
 */
export const getClipartByCategory = [
  // Validation middleware
  param('categoryId')
    .notEmpty()
    .isLength({ min: 1, max: 50 })
    .withMessage('Category ID must be between 1 and 50 characters')
    .escape(),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  // Handler
  asyncHandler(async (req: Request, res: Response) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation error', errors.array());
    }
    
    const { categoryId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    
    try {
      // Find all clipart in the category with pagination
      const [clipart, total] = await Promise.all([
        Asset.find({
          type: 'clipart',
          category: categoryId,
          isActive: true
        })
        .select('url thumbnailUrl dimensions tags createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
        
        Asset.countDocuments({
          type: 'clipart',
          category: categoryId,
          isActive: true
        })
      ]);
      
      logger.info('Clipart retrieved by category', {
        category: categoryId,
        page,
        limit,
        total,
        returned: clipart.length
      });
      
      res.json({
        success: true,
        data: {
          category: categoryId,
          clipart,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNextPage: page < Math.ceil(total / limit),
            hasPrevPage: page > 1
          }
        }
      });
    } catch (error) {
      logger.error('Error retrieving clipart by category', { category: categoryId, error });
      throw error;
    }
  })
];

/**
 * @route   GET /api/assets/clipart/search
 * @desc    Search clipart by tags with pagination
 * @access  Public
 */
export const searchClipart = [
  // Validation middleware
  query('query')
    .notEmpty()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters')
    .escape(),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('category')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Category must be between 1 and 50 characters')
    .escape(),
  
  // Handler
  asyncHandler(async (req: Request, res: Response) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation error', errors.array());
    }
    
    const { query: searchQuery, category } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    
    try {
      // Build search filter
      const filter: any = {
        type: 'clipart',
        isActive: true,
        $or: [
          { tags: { $regex: searchQuery, $options: 'i' } },
          { category: { $regex: searchQuery, $options: 'i' } }
        ]
      };
      
      // Add category filter if specified
      if (category) {
        filter.category = category;
      }
      
      // Search clipart with pagination
      const [clipart, total] = await Promise.all([
        Asset.find(filter)
          .select('url thumbnailUrl dimensions tags category createdAt')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        
        Asset.countDocuments(filter)
      ]);
      
      logger.info('Clipart search performed', {
        query: searchQuery,
        category,
        page,
        limit,
        total,
        returned: clipart.length
      });
      
      res.json({
        success: true,
        data: {
          query: searchQuery,
          category: category || null,
          results: clipart,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNextPage: page < Math.ceil(total / limit),
            hasPrevPage: page > 1
          }
        }
      });
    } catch (error) {
      logger.error('Error searching clipart', { query: searchQuery, category, error });
      throw error;
    }
  })
];

/**
 * @route   DELETE /api/assets/:assetId
 * @desc    Delete an asset (soft delete)
 * @access  Private
 */
export const deleteAsset = [
  requireAuth,
  
  // Validation middleware
  param('assetId')
    .isMongoId()
    .withMessage('Invalid asset ID'),
  
  // Handler
  asyncHandler(async (req: Request, res: Response) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation error', errors.array());
    }
    
    const { assetId } = req.params;
    const userId = (req as any).user.id;
    const isAdmin = (req as any).user.isAdmin;
    
    // Find the asset first to check permissions
    const asset = await Asset.findById(assetId);
    
    if (!asset) {
      throw new NotFoundError('Asset not found');
    }
    
    // Check if user has permission to delete this asset
    if (asset.metadata.uploadedBy !== userId && !isAdmin) {
      throw new AuthenticationError('You do not have permission to delete this asset');
    }
    
    // Soft delete the asset
    asset.isActive = false;
    await asset.save();
    
    logger.info('Asset deleted successfully', {
      assetId,
      deletedBy: userId,
      isAdmin
    });
    
    res.json({
      success: true,
      message: 'Asset deleted successfully'
    });
  })
];


/**
 * @route   GET /api/assets/popular-tags
 * @desc    Get popular tags with counts
 * @access  Public
 */
export const getPopularTags = [
  // Validation middleware
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  
  // Handler
  asyncHandler(async (req: Request, res: Response) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation error', errors.array());
    }
    
    const limit = parseInt(req.query.limit as string) || 20;
    
    try {
      // Get popular tags using aggregation
      const popularTags = await Asset.aggregate([
        {
          $match: {
            isActive: true,
            tags: { $exists: true, $ne: [] }
          }
        },
        {
          $unwind: '$tags'
        },
        {
          $group: {
            _id: '$tags',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: limit
        },
        {
          $project: {
            _id: 0,
            tag: '$_id',
            count: 1
          }
        }
      ]);
      
      logger.info('Popular tags retrieved', { 
        totalTags: popularTags.length,
        limit 
      });
      
      res.json({
        success: true,
        data: {
          tags: popularTags,
          total: popularTags.length
        }
      });
    } catch (error) {
      logger.error('Error retrieving popular tags', error);
      throw error;
    }
  })
];

export default {
  uploadImage,
  getAssetById,
  updateAsset,
  getClipartCategories,
  getClipartByCategory,
  searchClipart,
  getPopularTags,
  deleteAsset
};