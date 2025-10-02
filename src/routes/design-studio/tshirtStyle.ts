import express from 'express';
import { param, body, query, validationResult } from 'express-validator';
import * as tshirtStyleController from '../../controllers/design-studio/tshirtStyle';

const router = express.Router();

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
 * @route   GET /design-studio/tshirt-styles
 * @desc    Get all active t-shirt styles
 * @access  Public
 */
router.get(
  '/',
  [
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
      .isIn(['men', 'women', 'kids', 'unisex'])
      .withMessage('Invalid category'),
    query('sortBy')
      .optional()
      .isIn(['name', 'price', 'createdAt', 'updatedAt'])
      .withMessage('Invalid sort field'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be asc or desc'),
    query('color')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Color filter must be between 1 and 50 characters'),
    query('size')
      .optional()
      .isIn(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'])
      .withMessage('Invalid size filter'),
    query('priceRange')
      .optional()
      .matches(/^\d+(-\d+)?$/)
      .withMessage('Price range must be in format "min-max" or "min"')
  ],
  handleValidationErrors,
  tshirtStyleController.getAllTShirtStyles
);

/**
 * @route   GET /api/tshirt-styles/search
 * @desc    Search t-shirt styles
 * @access  Public
 */
router.get(
  '/search',
  tshirtStyleController.searchTShirtStyles
);

/**
 * @route   GET /api/tshirt-styles/categories
 * @desc    Get all available categories
 * @access  Public
 */
router.get(
  '/categories',
  tshirtStyleController.getTShirtStyleCategories
);

/**
 * @route   GET /api/tshirt-styles/featured
 * @desc    Get featured t-shirt styles
 * @access  Public
 */
router.get(
  '/featured',
  tshirtStyleController.getFeaturedTShirtStyles
);

/**
 * @route   GET /api/tshirt-styles/:id
 * @desc    Get t-shirt style by ID
 * @access  Public
 */
router.get(
  '/:id',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid t-shirt style ID format')
  ],
  handleValidationErrors,
  tshirtStyleController.getTShirtStyleById
);

/**
 * @route   GET /api/tshirt-styles/:id/colors
 * @desc    Get available colors for a t-shirt style
 * @access  Public
 */
router.get(
  '/:id/colors',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid t-shirt style ID format'),
    query('availableOnly')
      .optional()
      .isBoolean()
      .withMessage('availableOnly must be a boolean')
  ],
  handleValidationErrors,
  tshirtStyleController.getTShirtStyleColors
);

/**
 * @route   GET /api/tshirt-styles/:id/sizes
 * @desc    Get available sizes for a t-shirt style
 * @access  Public
 */
router.get(
  '/:id/sizes',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid t-shirt style ID format'),
    query('availableOnly')
      .optional()
      .isBoolean()
      .withMessage('availableOnly must be a boolean')
  ],
  handleValidationErrors,
  tshirtStyleController.getTShirtStyleSizes
);

/**
 * @route   GET /api/tshirt-styles/:id/pricing
 * @desc    Get pricing details for a t-shirt style
 * @access  Public
 */
router.get(
  '/:id/pricing',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid t-shirt style ID format')
  ],
  handleValidationErrors,
  tshirtStyleController.getTShirtStylePricing
);

/**
 * @route   POST /api/tshirt-styles
 * @desc    Create a new t-shirt style
 * @access  Admin (requires authentication middleware)
 */
router.post(
  '/',
  [
    body('name')
      .notEmpty()
      .withMessage('T-shirt style name is required')
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters')
      .trim(),
    body('description')
      .notEmpty()
      .withMessage('Description is required')
      .isLength({ min: 10, max: 500 })
      .withMessage('Description must be between 10 and 500 characters')
      .trim(),
    body('basePrice')
      .isFloat({ min: 0 })
      .withMessage('Base price must be a positive number'),
    body('availableColors')
      .isArray({ min: 1 })
      .withMessage('At least one color must be provided'),
    body('availableSizes')
      .isArray({ min: 1 })
      .withMessage('At least one size must be provided'),
    body('images')
      .isObject()
      .withMessage('Images must be an object'),
    body('printableAreas')
      .notEmpty()
      .withMessage('Printable areas are required'),
    body('category')
      .optional()
      .isIn(['men', 'women', 'kids', 'unisex'])
      .withMessage('Invalid category'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean'),
    body('isFeatured')
      .optional()
      .isBoolean()
      .withMessage('isFeatured must be a boolean')
  ],
  handleValidationErrors,
  tshirtStyleController.createTShirtStyle
);

/**
 * @route   POST /api/tshirt-styles/bulk-update
 * @desc    Bulk update t-shirt styles
 * @access  Admin
 */
router.post(
  '/bulk-update',
  tshirtStyleController.bulkUpdateTShirtStyles
);

/**
 * @route   PUT /api/tshirt-styles/:id
 * @desc    Update a t-shirt style
 * @access  Admin (requires authentication middleware)
 */
router.put(
  '/:id',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid t-shirt style ID format'),
    body('name')
      .optional()
      .notEmpty()
      .withMessage('Name cannot be empty')
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters')
      .trim(),
    body('description')
      .optional()
      .notEmpty()
      .withMessage('Description cannot be empty')
      .isLength({ min: 10, max: 500 })
      .withMessage('Description must be between 10 and 500 characters')
      .trim(),
    body('basePrice')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Base price must be a positive number'),
    body('category')
      .optional()
      .isIn(['men', 'women', 'kids', 'unisex'])
      .withMessage('Invalid category'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean'),
    body('isFeatured')
      .optional()
      .isBoolean()
      .withMessage('isFeatured must be a boolean')
  ],
  handleValidationErrors,
  tshirtStyleController.updateTShirtStyle
);

/**
 * @route   PUT /api/tshirt-styles/:id/restore
 * @desc    Restore a deleted (deactivated) t-shirt style
 * @access  Admin (requires authentication middleware)
 */
router.put(
  '/:id/restore',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid t-shirt style ID format')
  ],
  handleValidationErrors,
  tshirtStyleController.restoreTShirtStyle
);

/**
 * @route   PUT /api/tshirt-styles/:id/toggle-featured
 * @desc    Toggle featured status of a t-shirt style
 * @access  Admin
 */
router.put(
  '/:id/toggle-featured',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid t-shirt style ID format'),
    body('isFeatured')
      .isBoolean()
      .withMessage('isFeatured must be a boolean')
  ],
  handleValidationErrors,
  tshirtStyleController.toggleFeaturedStatus
);

/**
 * @route   PUT /api/tshirt-styles/:id/colors/:colorId
 * @desc    Update color availability for a t-shirt style
 * @access  Admin (requires authentication middleware)
 */
router.put(
  '/:id/colors/:colorId',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid t-shirt style ID format'),
    param('colorId')
      .isMongoId()
      .withMessage('Invalid color ID format'),
    body('isAvailable')
      .isBoolean()
      .withMessage('isAvailable must be a boolean')
  ],
  handleValidationErrors,
  tshirtStyleController.updateColorAvailability
);

/**
 * @route   PUT /api/tshirt-styles/:id/sizes/:sizeId
 * @desc    Update size availability for a t-shirt style
 * @access  Admin (requires authentication middleware)
 */
router.put(
  '/:id/sizes/:sizeId',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid t-shirt style ID format'),
    param('sizeId')
      .isMongoId()
      .withMessage('Invalid size ID format'),
    body('isAvailable')
      .isBoolean()
      .withMessage('isAvailable must be a boolean'),
    body('additionalCost')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Additional cost must be a non-negative number')
  ],
  handleValidationErrors,
  tshirtStyleController.updateSizeAvailability
);

/**
 * @route   DELETE /api/tshirt-styles/:id
 * @desc    Delete (deactivate) a t-shirt style
 * @access  Admin (requires authentication middleware)
 */
router.delete(
  '/:id',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid t-shirt style ID format')
  ],
  handleValidationErrors,
  tshirtStyleController.deleteTShirtStyle
);

export default router;