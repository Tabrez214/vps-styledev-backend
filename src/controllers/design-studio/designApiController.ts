import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import Design from '../../models/design-studio/design';
import { asyncHandler } from '../../middleware/errorMiddleware';
import { ValidationError } from '../../middleware/errorMiddleware';
// Remove the problematic import - we'll handle transformations inline
// import { frontendToBackendElement } from '../../../project/types/design';

/**
 * @route   POST /api/designs
 * @desc    Create a new design from frontend
 * @access  Public
 */
export const createDesignFromFrontend = [
  // Validation middleware - matching frontend save-design-modal.tsx payload
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Design name must be 1-100 characters'),
  body('shareableId').optional().isString(),
  body('tshirt').notEmpty().withMessage('T-shirt information is required'),
  body('tshirt.style').notEmpty().withMessage('T-shirt style is required'),
  body('tshirt.color').notEmpty().withMessage('T-shirt color is required'),
  body('elements').isArray().withMessage('Elements must be an array'),
  body('dimensions').optional().isObject(),
  body('isPublic').optional().isBoolean(),
  body('metadata').notEmpty().withMessage('Metadata is required'),
  body('metadata.email').isEmail().withMessage('Valid metadata email is required'),
  body('metadata.customerName').optional().isString(),

  // Handler
  asyncHandler(async (req: Request, res: Response) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation error', errors.array());
    }

    const { name, shareableId, tshirt, elements, dimensions, isPublic, metadata } = req.body;
    
    // Ensure we have required metadata email
    if (!metadata || !metadata.email) {
      throw new ValidationError('Metadata with email is required');
    }
    
    // Generate shareable ID if not provided
    const finalShareableId = shareableId || `design_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Transform frontend elements to backend format
    const transformedElements = elements.map((element: any) => {
      if (element.type === 'text') {
        return {
          id: element.id,
          type: element.type,
          position: { x: element.x, y: element.y },
          size: { width: element.width, height: element.height },
          rotation: element.rotation || 0,
          layer: element.layer || 0,
          view: element.view || 'front',
          properties: {
            text: element.text,
            fontFamily: element.fontFamily,
            fontSize: element.fontSize,
            fontColor: element.color, // Frontend uses 'color', backend uses 'fontColor'
            letterSpacing: element.letterSpacing,
            textPath: element.textPath
          }
        };
      } else {
        return {
          id: element.id,
          type: element.type,
          position: { x: element.x, y: element.y },
          size: { width: element.width, height: element.height },
          rotation: element.rotation || 0,
          layer: element.layer || 0,
          view: element.view || 'front',
          properties: {
            src: element.src,
            opacity: element.opacity
          }
        };
      }
    });

    // Create new design
    const newDesign = new Design({
      name,
      shareableId: finalShareableId,
      tshirt,
      elements: transformedElements,
      dimensions,
      isPublic: isPublic || false,
      metadata: {
        email: metadata.email,
        customerName: metadata.customerName,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown'
      }
    });

    await newDesign.save();

    res.status(201).json({
      success: true,
      data: {
        _id: newDesign._id,
        shareableId: newDesign.shareableId,
        name: newDesign.name
      },
      message: 'Design saved successfully'
    });
  })
];

/**
 * @route   GET /api/designs/:shareableId
 * @desc    Get design by shareable ID
 * @access  Public
 */
export const getDesignByShareableId = [
  asyncHandler(async (req: Request, res: Response) => {
    const { shareableId } = req.params;
    
    const design = await Design.findOne({ 
      shareableId,
      'metadata.isDeleted': { $ne: true }
    });

    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found'
      });
    }

    // Transform backend elements to frontend format
    const transformedElements = design.elements.map((element: any) => {
      if (element.type === 'text') {
        return {
          id: element.id,
          type: element.type,
          x: element.position.x,
          y: element.position.y,
          width: element.size.width,
          height: element.size.height,
          rotation: element.rotation,
          layer: element.layer,
          view: element.view,
          text: element.properties.text,
          fontFamily: element.properties.fontFamily,
          fontSize: element.properties.fontSize,
          color: element.properties.fontColor, // Backend uses 'fontColor', frontend uses 'color'
          letterSpacing: element.properties.letterSpacing,
          textPath: element.properties.textPath
        };
      } else {
        return {
          id: element.id,
          type: element.type,
          x: element.position.x,
          y: element.position.y,
          width: element.size.width,
          height: element.size.height,
          rotation: element.rotation,
          layer: element.layer,
          view: element.view,
          src: element.properties.src,
          opacity: element.properties.opacity
        };
      }
    });

    res.json({
      success: true,
      data: {
        _id: design._id,
        name: design.name,
        shareableId: design.shareableId,
        tshirt: design.tshirt,
        elements: transformedElements,
        dimensions: design.dimensions,
        isPublic: design.isPublic,
        metadata: design.metadata
      }
    });
  })
];

export default {
  createDesignFromFrontend,
  getDesignByShareableId
};
