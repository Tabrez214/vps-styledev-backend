import express from 'express';
import { param, query, body, validationResult } from 'express-validator';
import assetController from '../../controllers/design-studio/asset';
import { authMiddleware } from '../../middleware/authMiddleware'; // Add these imports

const router = express.Router();

// Rate limiting for upload endpoints
// const uploadRateLimit = rateLimitMiddleware({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 10, // limit each IP to 10 uploads per windowMs
//   message: 'Too many upload attempts, please try again later'
// });

// Global error handler for validation
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
 * @route   POST /design-studio/assets/images
 * @desc    Upload an image
 * @access  Public
 */
router.post(
  '/images',
  // uploadRateLimit, // Uncomment when rate limiting is implemented
  [
    body('type')
      .optional()
      .isIn(['clipart', 'uploaded'])
      .withMessage('Type must be either clipart or uploaded'),
    body('category')
      .optional()
      .isLength({ min: 1, max: 50 })
      .matches(/^[a-zA-Z0-9\s\-_]+$/)
      .withMessage('Category must be alphanumeric with spaces, hyphens, or underscores only'),
    body('tags')
      .optional()
      .custom((tags) => {
        // Accept both string (comma-separated) and array formats
        if (typeof tags === 'string') {
          const tagArray = tags.split(',').map(tag => tag.trim());
          if (tagArray.length > 20) {
            throw new Error('Maximum 20 tags allowed');
          }
          return tagArray.every(tag => 
            tag.length > 0 && 
            tag.length <= 30 &&
            /^[a-zA-Z0-9\s\-_]+$/.test(tag)
          );
        }
        if (Array.isArray(tags)) {
          if (tags.length > 20) {
            throw new Error('Maximum 20 tags allowed');
          }
          return tags.every((tag: string) => 
            typeof tag === 'string' && 
            tag.length > 0 && 
            tag.length <= 30 &&
            /^[a-zA-Z0-9\s\-_]+$/.test(tag)
          );
        }
        return true; // Allow undefined/null
      })
      .withMessage('Tags must be a string (comma-separated) or array of alphanumeric strings with maximum 30 characters each'),
    body('uploadedBy')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('UploadedBy must be between 1 and 100 characters')
  ],
  handleValidationErrors,
  assetController.uploadImage
);

/**
 * @route   GET /design-studio/assets/clipart/categories
 * @desc    Get all clipart categories with counts
 * @access  Public
 */
router.get(
  '/clipart/categories',
  assetController.getClipartCategories
);

/**
 * @route   GET /design-studio/assets/clipart/category/:categoryId
 * @desc    Get clipart by category with pagination
 * @access  Public
 */
router.get(
  '/clipart/category/:categoryId',
  [
    param('categoryId')
      .notEmpty()
      .isLength({ min: 1, max: 50 })
      .matches(/^[a-zA-Z0-9\s\-_]+$/)
      .withMessage('Category ID must be alphanumeric with spaces, hyphens, or underscores only'),
    query('page')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Page must be between 1 and 1000'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],
  handleValidationErrors,
  assetController.getClipartByCategory
);

/**
 * @route   GET /design-studio/assets/clipart/search
 * @desc    Search clipart by tags with pagination
 * @access  Public
 */
router.get(
  '/clipart/search',
  [
    query('query')
      .notEmpty()
      .isLength({ min: 1, max: 100 })
      .matches(/^[a-zA-Z0-9\s\-_]+$/)
      .withMessage('Search query must be alphanumeric with spaces, hyphens, or underscores only'),
    query('page')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Page must be between 1 and 1000'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('category')
      .optional()
      .isLength({ min: 1, max: 50 })
      .matches(/^[a-zA-Z0-9\s\-_]+$/)
      .withMessage('Category must be alphanumeric with spaces, hyphens, or underscores only')
  ],
  handleValidationErrors,
  assetController.searchClipart
);

/**
 * @route   GET /design-studio/assets/popular-tags
 * @desc    Get popular tags
 * @access  Public
 */
router.get(
  '/popular-tags',
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50')
  ],
  handleValidationErrors,
  assetController.getPopularTags
);

/**
 * @route   GET /design-studio/assets/:assetId
 * @desc    Get a specific asset by ID
 * @access  Public
 */
router.get(
  '/:assetId',
  [
    param('assetId')
      .isMongoId()
      .withMessage('Invalid asset ID format')
  ],
  handleValidationErrors,
  assetController.getAssetById
);

/**
 * @route   PATCH /design-studio/assets/:assetId
 * @desc    Update asset metadata
 * @access  Private (requires authentication)
 */
router.patch(
  '/:assetId',
  authMiddleware, // Add authentication middleware
  [
    param('assetId')
      .isMongoId()
      .withMessage('Invalid asset ID format'),
    body('category')
      .optional()
      .isLength({ min: 1, max: 50 })
      .matches(/^[a-zA-Z0-9\s\-_]+$/)
      .withMessage('Category must be alphanumeric with spaces, hyphens, or underscores only'),
    body('tags')
      .optional()
      .isArray()
      .custom((tags) => {
        if (tags && tags.length > 20) {
          throw new Error('Maximum 20 tags allowed');
        }
        return !tags || tags.every((tag: string) => 
          typeof tag === 'string' && 
          tag.length > 0 && 
          tag.length <= 30 &&
          /^[a-zA-Z0-9\s\-_]+$/.test(tag)
        );
      })
      .withMessage('Tags must be an array of alphanumeric strings with maximum 30 characters each'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean')
  ],
  handleValidationErrors,
  assetController.updateAsset
);

/**
 * @route   DELETE /design-studio/assets/:assetId
 * @desc    Delete an asset (soft delete)
 * @access  Private (requires authentication)
 */
router.delete(
  '/:assetId',
  authMiddleware, // Add authentication middleware
  [
    param('assetId')
      .isMongoId()
      .withMessage('Invalid asset ID format')
  ],
  handleValidationErrors,
  assetController.deleteAsset
);

export default router;