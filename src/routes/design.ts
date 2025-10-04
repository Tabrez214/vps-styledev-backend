// design.ts (TypeScript version)
import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import Design from '../models/design';
import { generatePreviewImages } from '../services/design-studio/image';
import { sendDesignEmail } from '../utils/email';
import { calculateDesignDimensions } from '../utils/design';

const router = express.Router();

/**
 * @route   POST /api/designs
 * @desc    Save a new design
 * @access  Public
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { design, email } = req.body;

    if (!design || !email) {
      res.status(400).json({
        success: false,
        message: 'Design data and email are required'
      });
      return;
    }

    const shareableId = uuidv4();
    const accessToken = jwt.sign(
      { designId: shareableId, email },
      process.env.JWT_SECRET as string,
      { expiresIn: '30d' }
    );

    const dimensions = calculateDesignDimensions(design);

    const newDesign = new Design({
      name: design.name || 'Untitled Design',
      shareableId,
      accessToken,
      tshirt: design.tshirt,
      elements: design.elements,
      dimensions,
      isPublic: design.isPublic || false,
      metadata: {
        email,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    await newDesign.save();
    const previewImages = await generatePreviewImages(newDesign);
    newDesign.previewImages = previewImages;
    await newDesign.save();

    await sendDesignEmail(newDesign._id as string, email);

    const privateLink = `${process.env.FRONTEND_URL}/design/${shareableId}?token=${accessToken}`;
    const publicLink = newDesign.isPublic
      ? `${process.env.FRONTEND_URL}/share/${shareableId}`
      : null;

    res.status(201).json({
      success: true,
      designId: shareableId,
      shareableLink: privateLink,
      publicLink,
      message: 'Design saved successfully'
    });
  } catch (error) {
    console.error('Error saving design:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while saving design'
    });
  }
});

/**
 * @route   GET /api/designs/:id
 * @desc    Get design by ID
 * @access  Public/Private
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { token } = req.query;
    const design = await Design.findOne({ shareableId: id });

    if (!design) {
      res.status(404).json({ success: false, message: 'Design not found' });
      return;
    }

    if (!design.isPublic) {
      if (!token || typeof token !== 'string') {
        res.status(401).json({ success: false, message: 'Authentication token is required' });
        return;
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
        if (decoded.designId !== id) {
          res.status(401).json({ success: false, message: 'Invalid token for this design' });
          return;
        }
      } catch (err) {
        res.status(401).json({ success: false, message: 'Invalid or expired token' });
        return;
      }
    }

    res.json({
      success: true,
      design: {
        id: design.shareableId,
        name: design.name,
        tshirt: design.tshirt,
        elements: design.elements,
        currentView: 'front',
        previewImages: design.previewImages,
        isPublic: design.isPublic
      }
    });
  } catch (error) {
    console.error('Error retrieving design:', error);
    res.status(500).json({ success: false, message: 'Server error while retrieving design' });
  }
});

/**
 * @route   PUT /api/designs/:id
 * @desc    Update design by ID
 * @access  Private
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { token } = req.query;
    const { design } = req.body;

    if (!token || typeof token !== 'string') {
      res.status(401).json({ success: false, message: 'Authentication token is required' });
      return;
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
      if (decoded.designId !== id) {
        res.status(401).json({ success: false, message: 'Invalid token for this design' });
        return;
      }
    } catch (err) {
      res.status(401).json({ success: false, message: 'Invalid or expired token' });
      return;
    }

    const existingDesign = await Design.findOne({ shareableId: id });

    if (!existingDesign) {
      res.status(404).json({ success: false, message: 'Design not found' });
      return;
    }

    const dimensions = calculateDesignDimensions(design);
    existingDesign.name = design.name || existingDesign.name;
    existingDesign.tshirt = design.tshirt || existingDesign.tshirt;
    existingDesign.elements = design.elements || existingDesign.elements;
    existingDesign.dimensions = dimensions;
    existingDesign.isPublic =
      design.isPublic !== undefined ? design.isPublic : existingDesign.isPublic;
    existingDesign.metadata.updatedAt = new Date();

    await existingDesign.save();

    if (design.elements) {
      const previewImages = await generatePreviewImages(existingDesign);
      existingDesign.previewImages = previewImages;
      await existingDesign.save();
    }

    res.json({
      success: true,
      message: 'Design updated successfully',
      design: {
        id: existingDesign.shareableId,
        name: existingDesign.name,
        tshirt: existingDesign.tshirt,
        elements: existingDesign.elements,
        previewImages: existingDesign.previewImages,
        isPublic: existingDesign.isPublic
      }
    });
  } catch (error) {
    console.error('Error updating design:', error);
    res.status(500).json({ success: false, message: 'Server error while updating design' });
  }
});

/**
 * @route   POST /api/designs/:id/email
 * @desc    Send design email
 * @access  Public
 */
router.post('/:id/email', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { email, message } = req.body;

    if (!email) {
      res.status(400).json({ success: false, message: 'Email is required' });
      return;
    }

    const design = await Design.findOne({ shareableId: id });

    if (!design) {
      res.status(404).json({ success: false, message: 'Design not found' });
      return;
    }

    await sendDesignEmail(design._id as string, email, message);

    res.json({ success: true, message: 'Design email sent successfully' });
  } catch (error) {
    console.error('Error sending design email:', error);
    res.status(500).json({ success: false, message: 'Server error while sending design email' });
  }
});

export default router;