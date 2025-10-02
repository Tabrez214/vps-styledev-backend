// controllers/design-studio/tshirtStyle.ts
import { Request, Response } from 'express';
import { query } from 'express-validator';
import { body, param, validationResult } from 'express-validator';
import TShirtStyle from '../../models/design-studio/tshirtStyle';
import { asyncHandler } from '../../middleware/errorMiddleware';
import { ValidationError, NotFoundError } from '../../middleware/errorMiddleware';
import { ITShirtStyle } from '../../interfaces';

/**
 * Custom validator for color array
 */
const validateColors = body('availableColors').custom((colors) => {
  if (!Array.isArray(colors)) {
    throw new Error('Available colors must be an array');
  }
  
  colors.forEach((color: any, index: number) => {
    if (!color.name || typeof color.name !== 'string') {
      throw new Error(`Color at index ${index} must have a valid name`);
    }
    if (!color.hex || typeof color.hex !== 'string' || !/^#[0-9A-F]{6}$/i.test(color.hex)) {
      throw new Error(`Color at index ${index} must have a valid hex color (e.g., #FF0000)`);
    }
    if (typeof color.isAvailable !== 'boolean') {
      throw new Error(`Color at index ${index} must have a valid isAvailable boolean`);
    }
  });
  
  return true;
});

/**
 * Custom validator for size array
 */
const validateSizes = body('availableSizes').custom((sizes) => {
  if (!Array.isArray(sizes)) {
    throw new Error('Available sizes must be an array');
  }
  
  const validSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  
  sizes.forEach((size: any, index: number) => {
    if (!size.size || !validSizes.includes(size.size)) {
      throw new Error(`Size at index ${index} must be one of: ${validSizes.join(', ')}`);
    }
    if (typeof size.isAvailable !== 'boolean') {
      throw new Error(`Size at index ${index} must have a valid isAvailable boolean`);
    }
    if (size.additionalCost !== undefined && (typeof size.additionalCost !== 'number' || size.additionalCost < 0)) {
      throw new Error(`Size at index ${index} must have a valid additionalCost (non-negative number)`);
    }
  });
  
  return true;
});

/**
 * Custom validator for images object
 */
const validateImages = body('images').custom((images) => {
  if (!images || typeof images !== 'object' || Array.isArray(images)) {
    throw new Error('Images must be an object');
  }
  
  const requiredViews = ['front', 'back', 'left', 'right'];
  
  // Check if at least one image is provided
  const hasValidImage = requiredViews.some(view => {
    return images[view] && typeof images[view] === 'string' && images[view].trim() !== '';
  });
  
  if (!hasValidImage) {
    throw new Error('At least one image must be provided');
  }
  
  // Validate each provided image URL
  requiredViews.forEach(view => {
    if (images[view]) {
      if (typeof images[view] !== 'string') {
        throw new Error(`${view} image must be a valid URL string`);
      }
      // Basic URL validation
      try {
        new URL(images[view]);
      } catch {
        throw new Error(`${view} image must have a valid URL format`);
      }
    }
  });
  
  return true;
});

/**
 * Custom validator for printable areas
 */

const validatePrintableAreas = body('printableAreas').custom((areas) => {
  if (!areas || typeof areas !== 'object') {
    throw new Error('Printable areas must be an object');
  }
  
  const requiredViews = ['front', 'back'];
  requiredViews.forEach(view => {
    if (!areas[view]) {
      throw new Error(`Printable area for ${view} is required`);
    }
    
    const area = areas[view];
    
    // Support both coordinate systems: (x,y) or (left,top)
    const xCoord = area.x !== undefined ? area.x : area.left;
    const yCoord = area.y !== undefined ? area.y : area.top;
    
    if (typeof xCoord !== 'number' || typeof yCoord !== 'number' || 
        typeof area.width !== 'number' || typeof area.height !== 'number') {
      throw new Error(`Printable area for ${view} must have valid numeric coordinates (x,y or left,top), width, and height`);
    }
    
    if (xCoord < 0 || yCoord < 0 || area.width <= 0 || area.height <= 0) {
      throw new Error(`Printable area for ${view} must have positive dimensions and non-negative position`);
    }
  });
  
  return true;
});

/**
 * @route   GET /api/tshirt-styles
 * @desc    Get all active t-shirt styles with filtering
 * @access  Public
 */
export const getAllTShirtStyles = asyncHandler(async (req: Request, res: Response) => {
  const { color, size, priceRange, page = '1', limit = '10' } = req.query;
  
  let filter: any = { isActive: true };
  
  // Filter by available colors
  if (color) {
    filter['availableColors.name'] = { $regex: color, $options: 'i' };
    filter['availableColors.isAvailable'] = true;
  }
  
  // Filter by available sizes
  if (size) {
    filter['availableSizes.size'] = size;
    filter['availableSizes.isAvailable'] = true;
  }
  
  // Filter by price range
  if (priceRange) {
    const [min, max] = (priceRange as string).split('-').map(Number);
    if (min && !isNaN(min)) filter.basePrice = { $gte: min };
    if (max && !isNaN(max)) filter.basePrice = { ...filter.basePrice, $lte: max };
  }
  
  // Pagination
  const pageNum = parseInt(page as string) || 1;
  const limitNum = parseInt(limit as string) || 10;
  const skip = (pageNum - 1) * limitNum;
  
  const [tshirtStyles, totalCount] = await Promise.all([
    TShirtStyle.find(filter)
      .select('name description basePrice availableColors availableSizes images printableAreas')
      .sort({ basePrice: 1 })
      .skip(skip)
      .limit(limitNum),
    TShirtStyle.countDocuments(filter)
  ]);
  
  res.json({
    success: true,
    count: tshirtStyles.length,
    totalCount,
    currentPage: pageNum,
    totalPages: Math.ceil(totalCount / limitNum),
    hasNext: pageNum < Math.ceil(totalCount / limitNum),
    hasPrev: pageNum > 1,
    tshirtStyles
  });
});

/**
 * @route   GET /api/tshirt-styles/:id
 * @desc    Get a single t-shirt style by ID
 * @access  Public
 */
export const getTShirtStyleById = [
  param('id').isMongoId().withMessage('Invalid T-shirt style ID format'),
  
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation error', errors.array());
    }
    
    const { id } = req.params;
    
    const tshirtStyle = await TShirtStyle.findById(id);
    
    if (!tshirtStyle || !tshirtStyle.isActive) {
      throw new NotFoundError('T-shirt style not found');
    }
    
    res.json({
      success: true,
      tshirtStyle
    });
  })
];

/**
 * @route   GET /api/tshirt-styles/:id/colors
 * @desc    Get available colors for a specific t-shirt style
 * @access  Public
 */
export const getTShirtStyleColors = [
  param('id').isMongoId().withMessage('Invalid T-shirt style ID format'),
  
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation error', errors.array());
    }
    
    const { id } = req.params;
    
    const tshirtStyle = await TShirtStyle.findById(id)
      .select('availableColors name isActive');
    
    if (!tshirtStyle || !tshirtStyle.isActive) {
      throw new NotFoundError('T-shirt style not found');
    }
    
    const availableColors = tshirtStyle.availableColors.filter((color: { isAvailable: any; }) => color.isAvailable);
    
    res.json({
      success: true,
      styleName: tshirtStyle.name,
      colors: availableColors
    });
  })
];

/**
 * @route   GET /api/tshirt-styles/:id/sizes
 * @desc    Get available sizes for a specific t-shirt style
 * @access  Public
 */
export const getTShirtStyleSizes = [
  param('id').isMongoId().withMessage('Invalid T-shirt style ID format'),
  
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation error', errors.array());
    }
    
    const { id } = req.params;
    
    const tshirtStyle = await TShirtStyle.findById(id)
      .select('availableSizes name basePrice isActive');
    
    if (!tshirtStyle || !tshirtStyle.isActive) {
      throw new NotFoundError('T-shirt style not found');
    }
    
    const availableSizes = tshirtStyle.availableSizes
      .filter((size: { isAvailable: any; }) => size.isAvailable)
      .map((size: { toObject: () => any; additionalCost: any; }) => ({
        ...size.toObject(),
        totalPrice: tshirtStyle.basePrice + (size.additionalCost || 0)
      }));
    
    res.json({
      success: true,
      styleName: tshirtStyle.name,
      basePrice: tshirtStyle.basePrice,
      sizes: availableSizes
    });
  })
];

/**
 * @route   POST /api/tshirt-styles
 * @desc    Create a new t-shirt style
 * @access  Admin (requires authentication middleware)
 */
export const createTShirtStyle = [
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
  validateColors,
  validateSizes,
  validateImages,
  validatePrintableAreas,
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation error', errors.array());
    }
    
    const {
      name,
      description,
      basePrice,
      availableColors,
      availableSizes,
      images,
      printableAreas,
      isActive = true
    } = req.body;
    
    // Check if t-shirt style with same name already exists
    const existingStyle = await TShirtStyle.findOne({ 
      name: new RegExp(`^${name}$`, 'i') // Case-insensitive check
    });
    if (existingStyle) {
      throw new ValidationError('T-shirt style with this name already exists');
    }
    
    const newTShirtStyle = new TShirtStyle({
      name: name.trim(),
      description: description.trim(),
      basePrice,
      availableColors,
      availableSizes,
      images,
      printableAreas,
      isActive
    });
    
    await newTShirtStyle.save();
    
    res.status(201).json({
      success: true,
      tshirtStyle: newTShirtStyle,
      message: 'T-shirt style created successfully'
    });
  })
];

/**
 * @route   PUT /api/tshirt-styles/:id
 * @desc    Update a t-shirt style
 * @access  Admin (requires authentication middleware)
 */
export const updateTShirtStyle = [
  param('id').isMongoId().withMessage('Invalid T-shirt style ID format'),
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
  body('availableColors')
    .optional()
    .custom((colors) => {
      if (!Array.isArray(colors)) {
        throw new Error('Available colors must be an array');
      }
      
      colors.forEach((color: any, index: number) => {
        if (!color.name || typeof color.name !== 'string') {
          throw new Error(`Color at index ${index} must have a valid name`);
        }
        if (!color.hex || typeof color.hex !== 'string' || !/^#[0-9A-F]{6}$/i.test(color.hex)) {
          throw new Error(`Color at index ${index} must have a valid hex color (e.g., #FF0000)`);
        }
        if (typeof color.isAvailable !== 'boolean') {
          throw new Error(`Color at index ${index} must have a valid isAvailable boolean`);
        }
      });
      
      return true;
    }),
  body('availableSizes')
    .optional()
    .custom((sizes) => {
      if (!Array.isArray(sizes)) {
        throw new Error('Available sizes must be an array');
      }
      
      const validSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
      
      sizes.forEach((size: any, index: number) => {
        if (!size.size || !validSizes.includes(size.size)) {
          throw new Error(`Size at index ${index} must be one of: ${validSizes.join(', ')}`);
        }
        if (typeof size.isAvailable !== 'boolean') {
          throw new Error(`Size at index ${index} must have a valid isAvailable boolean`);
        }
        if (size.additionalCost !== undefined && (typeof size.additionalCost !== 'number' || size.additionalCost < 0)) {
          throw new Error(`Size at index ${index} must have a valid additionalCost (non-negative number)`);
        }
      });
      
      return true;
    }),
  body('images')
    .optional()
    .custom((images) => {
      if (!images || typeof images !== 'object' || Array.isArray(images)) {
        throw new Error('Images must be an object');
      }
      
      const requiredViews = ['front', 'back', 'left', 'right'];
      
      // Check if at least one image is provided
      const hasValidImage = requiredViews.some(view => {
        return images[view] && typeof images[view] === 'string' && images[view].trim() !== '';
      });
      
      if (!hasValidImage) {
        throw new Error('At least one image must be provided');
      }
      
      // Validate each provided image URL
      requiredViews.forEach(view => {
        if (images[view]) {
          if (typeof images[view] !== 'string') {
            throw new Error(`${view} image must be a valid URL string`);
          }
          // Basic URL validation
          try {
            new URL(images[view]);
          } catch {
            throw new Error(`${view} image must have a valid URL format`);
          }
        }
      });
      
      return true;
    }),
  body('printableAreas')
    .optional()
    .custom((areas) => {
      if (!areas || typeof areas !== 'object') {
        throw new Error('Printable areas must be an object');
      }
      
      const requiredViews = ['front', 'back'];
      requiredViews.forEach(view => {
        if (!areas[view]) {
          throw new Error(`Printable area for ${view} is required`);
        }
        
        const area = areas[view];
        if (typeof area.x !== 'number' || typeof area.y !== 'number' || 
            typeof area.width !== 'number' || typeof area.height !== 'number') {
          throw new Error(`Printable area for ${view} must have valid numeric x, y, width, and height`);
        }
        
        if (area.x < 0 || area.y < 0 || area.width <= 0 || area.height <= 0) {
          throw new Error(`Printable area for ${view} must have positive dimensions and non-negative position`);
        }
      });
      
      return true;
    }),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation error', errors.array());
    }
    
    const { id } = req.params;
    const updateData = { ...req.body };
    
    const tshirtStyle = await TShirtStyle.findById(id);
    if (!tshirtStyle) {
      throw new NotFoundError('T-shirt style not found');
    }
    
    // Check if name is being updated and if it conflicts with existing style
    if (updateData.name && updateData.name.toLowerCase() !== tshirtStyle.name.toLowerCase()) {
      const existingStyle = await TShirtStyle.findOne({ 
        name: new RegExp(`^${updateData.name}$`, 'i'),
        _id: { $ne: id } // Exclude current document
      });
      if (existingStyle) {
        throw new ValidationError('T-shirt style with this name already exists');
      }
    }
    
    // Trim string fields
    if (updateData.name) updateData.name = updateData.name.trim();
    if (updateData.description) updateData.description = updateData.description.trim();
    
    const updatedTShirtStyle = await TShirtStyle.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    res.json({
      success: true,
      tshirtStyle: updatedTShirtStyle,
      message: 'T-shirt style updated successfully'
    });
  })
];

/**
 * @route   DELETE /api/tshirt-styles/:id
 * @desc    Delete (deactivate) a t-shirt style
 * @access  Admin (requires authentication middleware)
 */
export const deleteTShirtStyle = [
  param('id').isMongoId().withMessage('Invalid T-shirt style ID format'),
  
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation error', errors.array());
    }
    
    const { id } = req.params;
    
    const tshirtStyle = await TShirtStyle.findById(id);
    if (!tshirtStyle) {
      throw new NotFoundError('T-shirt style not found');
    }
    
    // Soft delete by setting isActive to false
    const updatedTShirtStyle = await TShirtStyle.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
    
    res.json({
      success: true,
      tshirtStyle: updatedTShirtStyle,
      message: 'T-shirt style deleted successfully'
    });
  })
];

/**
 * @route   PUT /api/tshirt-styles/:id/colors/:colorId
 * @desc    Update color availability for a t-shirt style
 * @access  Admin (requires authentication middleware)
 */
export const updateColorAvailability = [
  param('id').isMongoId().withMessage('Invalid T-shirt style ID format'),
  param('colorId').isMongoId().withMessage('Invalid color ID format'),
  body('isAvailable').isBoolean().withMessage('isAvailable must be a boolean'),
  
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation error', errors.array());
    }
    
    const { id, colorId } = req.params;
    const { isAvailable } = req.body;
    
    const tshirtStyle = await TShirtStyle.findById(id);
    if (!tshirtStyle) {
      throw new NotFoundError('T-shirt style not found');
    }
    
    const colorIndex = tshirtStyle.availableColors.findIndex(
      (      color: { _id: { toString: () => string; }; }) => color._id?.toString() === colorId
    );
    
    if (colorIndex === -1) {
      throw new NotFoundError('Color not found');
    }
    
    tshirtStyle.availableColors[colorIndex].isAvailable = isAvailable;
    
    await tshirtStyle.save();
    
    res.json({
      success: true,
      message: `Color availability updated to ${isAvailable}`,
      color: tshirtStyle.availableColors[colorIndex]
    });
  })
];

/**
 * @route   PUT /api/tshirt-styles/:id/sizes/:sizeId
 * @desc    Update size availability for a t-shirt style
 * @access  Admin (requires authentication middleware)
 */
export const updateSizeAvailability = [
  param('id').isMongoId().withMessage('Invalid T-shirt style ID format'),
  param('sizeId').isMongoId().withMessage('Invalid size ID format'),
  body('isAvailable').isBoolean().withMessage('isAvailable must be a boolean'),
  body('additionalCost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Additional cost must be a non-negative number'),
  
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation error', errors.array());
    }
    
    const { id, sizeId } = req.params;
    const { isAvailable, additionalCost } = req.body;
    
    const tshirtStyle = await TShirtStyle.findById(id);
    if (!tshirtStyle) {
      throw new NotFoundError('T-shirt style not found');
    }
    
    const sizeIndex = tshirtStyle.availableSizes.findIndex(
      (      size: { _id: { toString: () => string; }; }) => size._id?.toString() === sizeId
    );
    
    if (sizeIndex === -1) {
      throw new NotFoundError('Size not found');
    }
    
    tshirtStyle.availableSizes[sizeIndex].isAvailable = isAvailable;
    if (additionalCost !== undefined) {
      tshirtStyle.availableSizes[sizeIndex].additionalCost = additionalCost;
    }
    
    await tshirtStyle.save();
    
    res.json({
      success: true,
      message: 'Size availability updated successfully',
      size: tshirtStyle.availableSizes[sizeIndex]
    });
  })
];

/**
 * @route   PUT /api/tshirt-styles/:id/restore
 * @desc    Restore a deleted (deactivated) t-shirt style
 * @access  Admin (requires authentication middleware)
 */
export const restoreTShirtStyle = [
  param('id').isMongoId().withMessage('Invalid T-shirt style ID format'),
  
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation error', errors.array());
    }
    
    const { id } = req.params;
    
    const tshirtStyle = await TShirtStyle.findById(id);
    if (!tshirtStyle) {
      throw new NotFoundError('T-shirt style not found');
    }
    
    if (tshirtStyle.isActive) {
      throw new ValidationError('T-shirt style is already active');
    }
    
    // Restore by setting isActive to true
    const updatedTShirtStyle = await TShirtStyle.findByIdAndUpdate(
      id,
      { isActive: true },
      { new: true }
    );
    
    res.json({
      success: true,
      tshirtStyle: updatedTShirtStyle,
      message: 'T-shirt style restored successfully'
    });
  })
];

// Add these functions to your existing tshirtStyle.ts controller file

/**
 * @route   GET /api/tshirt-styles/search
 * @desc    Search t-shirt styles
 * @access  Public
 */
export const searchTShirtStyles = [
  query('q')
    .trim()
    .notEmpty()
    .withMessage('Search query is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Search query must be between 2 and 100 characters'),
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
  
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation error', errors.array());
    }
    
    const { q, page = '1', limit = '10', category } = req.query;
    
    let filter: any = { 
      isActive: true,
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ]
    };
    
    if (category) {
      filter.category = category;
    }
    
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const skip = (pageNum - 1) * limitNum;
    
    const [tshirtStyles, totalCount] = await Promise.all([
      TShirtStyle.find(filter)
        .select('name description basePrice availableColors availableSizes images category')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNum),
      TShirtStyle.countDocuments(filter)
    ]);
    
    res.json({
      success: true,
      count: tshirtStyles.length,
      totalCount,
      currentPage: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      searchQuery: q,
      tshirtStyles
    });
  })
];

/**
 * @route   GET /api/tshirt-styles/:id/pricing
 * @desc    Get pricing details for a t-shirt style
 * @access  Public
 */
export const getTShirtStylePricing = [
  param('id').isMongoId().withMessage('Invalid T-shirt style ID format'),
  
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation error', errors.array());
    }
    
    const { id } = req.params;
    
    const tshirtStyle = await TShirtStyle.findById(id)
      .select('name basePrice availableSizes isActive');
    
    if (!tshirtStyle || !tshirtStyle.isActive) {
      throw new NotFoundError('T-shirt style not found');
    }
    
    const pricingDetails = {
      styleName: tshirtStyle.name,
      basePrice: tshirtStyle.basePrice,
      sizes: tshirtStyle.availableSizes
        .filter((size: { isAvailable: any; }) => size.isAvailable)
        .map((size: { size: any; additionalCost: any; }) => ({
          size: size.size,
          additionalCost: size.additionalCost || 0,
          totalPrice: tshirtStyle.basePrice + (size.additionalCost || 0)
        }))
        .sort((a: { totalPrice: number; }, b: { totalPrice: number; }) => a.totalPrice - b.totalPrice)
    };
    
    res.json({
      success: true,
      pricing: pricingDetails
    });
  })
];

/**
 * @route   GET /api/tshirt-styles/categories
 * @desc    Get all available categories
 * @access  Public
 */
export const getTShirtStyleCategories = asyncHandler(async (req: Request, res: Response) => {
  const categories = await TShirtStyle.distinct('category', { isActive: true });

  const categoryCounts = await Promise.all(
    (categories as string[]).map(async (category) => {
      const count = await TShirtStyle.countDocuments({ 
        category, 
        isActive: true 
      });
      return { category, count };
    })
  );
  
  res.json({
    success: true,
    categories: categoryCounts.sort((a, b) => a.category.localeCompare(b.category))
  });
});

/**
 * @route   GET /api/tshirt-styles/featured
 * @desc    Get featured t-shirt styles
 * @access  Public
 */
export const getFeaturedTShirtStyles = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('Limit must be between 1 and 20'),
  
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation error', errors.array());
    }
    
    const { limit = '6' } = req.query;
    const limitNum = parseInt(limit as string);
    
    // Get featured styles based on some criteria (e.g., recently created or lowest price)
    const featuredStyles = await TShirtStyle.find({ 
      isActive: true
    })
      .select('name description basePrice images')
      .sort({ createdAt: -1 }) // Sort by newest first
      .limit(limitNum);
    
    res.json({
      success: true,
      count: featuredStyles.length,
      tshirtStyles: featuredStyles
    });
  })
];

/**
 * @route   PUT /api/tshirt-styles/:id/toggle-featured
 * @desc    Toggle featured status of a t-shirt style (simplified version)
 * @access  Admin
 */
export const toggleFeaturedStatus = [
  param('id').isMongoId().withMessage('Invalid T-shirt style ID format'),
  body('isFeatured').isBoolean().withMessage('isFeatured must be a boolean'),
  
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation error', errors.array());
    }
    
    const { id } = req.params;
    const { isFeatured } = req.body;
    
    const tshirtStyle = await TShirtStyle.findById(id);
    if (!tshirtStyle) {
      throw new NotFoundError('T-shirt style not found');
    }
    
    const updatedStyle = await TShirtStyle.findByIdAndUpdate(
      id,
      { $set: { isFeatured } }, // Set the featured status explicitly
      { new: true }
    );
    
    res.json({
      success: true,
      message: `T-shirt style ${isFeatured ? 'featured' : 'unfeatured'} successfully`,
      tshirtStyle: updatedStyle
    });
  })
];

/**
 * @route   POST /api/tshirt-styles/bulk-update
 * @desc    Bulk update t-shirt styles
 * @access  Admin
 */
export const bulkUpdateTShirtStyles = [
  body('styleIds')
    .isArray({ min: 1 })
    .withMessage('Style IDs must be a non-empty array')
    .custom((ids: string[]) => {
      ids.forEach((id: string) => {
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
          throw new Error('All style IDs must be valid MongoDB ObjectIds');
        }
      });
      return true;
    }),
  body('updates')
    .isObject()
    .withMessage('Updates must be an object')
    .custom((updates: Record<string, any>) => {
      const allowedFields = ['isActive', 'basePrice'];
      const updateKeys = Object.keys(updates);
      
      if (updateKeys.length === 0) {
        throw new Error('At least one update field must be provided');
      }
      
      updateKeys.forEach(key => {
        if (!allowedFields.includes(key)) {
          throw new Error(`Field '${key}' is not allowed for bulk update`);
        }
      });
      
      return true;
    }),
  
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation error', errors.array());
    }
    
    const { styleIds, updates } = req.body;
    
    const result = await TShirtStyle.updateMany(
      { _id: { $in: styleIds } },
      { $set: updates }
    );
    
    res.json({
      success: true,
      message: `${result.modifiedCount} t-shirt styles updated successfully`,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount
    });
  })
];

// Update the controller object export to include new functions
const tshirtStyleController = {
  getAllTShirtStyles,
  getTShirtStyleById,
  getTShirtStyleColors,
  getTShirtStyleSizes,
  createTShirtStyle,
  updateTShirtStyle,
  deleteTShirtStyle,
  updateColorAvailability,
  updateSizeAvailability,
  restoreTShirtStyle,
  searchTShirtStyles,
  getTShirtStylePricing,
  getTShirtStyleCategories,
  getFeaturedTShirtStyles,
  toggleFeaturedStatus,
  bulkUpdateTShirtStyles
};

export default tshirtStyleController;

// Note: You'll need to add these imports at the top of your controller file:
// import { query } from 'express-validator';

// And if you want to use category and featured functionality, 
// add these fields to your ITShirtStyle interface:
/*
interface ITShirtStyle {
  // ... existing fields
  category?: 'men' | 'women' | 'kids' | 'unisex';
  isFeatured?: boolean;
}
*/