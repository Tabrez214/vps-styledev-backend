import { Request, Response } from 'express';
import Design from '../../models/design-studio/design';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { calculateDesignDimensions } from '../../utils/design';
import { sendDesignSuccessEmail } from '../../lib/emailService';

// Create a new design
export const createDesign = async (req: Request, res: Response) => {
  try {
    // Log the incoming request for debugging
    console.log('=== CREATE DESIGN REQUEST ===');
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Full request body:', JSON.stringify(req.body, null, 2));
    console.log('Has metadata field:', !!req.body.metadata);
    console.log('Metadata email:', req.body.metadata?.email);
    console.log('Request source:', req.headers['user-agent']);
    console.log('================================');
    
    // Handle both old format (design, email, name) and new frontend format (direct payload)
    let design, email, name;
    
    if (req.body.design && req.body.email) {
      // Old format: { design: {...}, email: "...", name: "..." }
      console.log('Using old format (design, email, name)');
      design = req.body.design;
      email = req.body.email;
      name = req.body.name;
    } else if (req.body.metadata && req.body.metadata.email) {
      // New frontend format: { name: "...", elements: [...], metadata: { email: "..." }, ... }
      console.log('Using new frontend format (direct payload)');
      design = req.body;
      email = req.body.metadata.email;
      name = req.body.name;
    } else {
      console.log('ERROR: Neither format matched');
      console.log('req.body.design exists:', !!req.body.design);
      console.log('req.body.email exists:', !!req.body.email);
      console.log('req.body.metadata exists:', !!req.body.metadata);
      console.log('req.body.metadata.email exists:', !!req.body.metadata?.email);
      
      res.status(400).json({
        success: false,
        message: 'Design data and email are required'
      });
      return;
    }

    console.log('Final values after parsing:');
    console.log('design exists:', !!design);
    console.log('email:', email);
    console.log('name:', name);
    
    if (!design || !email) {
      console.log('ERROR: Missing design or email after parsing');
      res.status(400).json({
        success: false,
        message: 'Design data and email are required'
      });
      return;
    }

    // Validate design structure
    if (!design.tshirt || !design.elements || !Array.isArray(design.elements)) {
      res.status(400).json({
        success: false,
        message: 'Invalid design structure. Missing tshirt or elements.'
      });
      return;
    }

    const shareableId = `design_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const accessToken = jwt.sign(
      { designId: shareableId, email },
      process.env.JWT_SECRET as string,
      { expiresIn: '30d' }
    );

    // Transform frontend elements to backend format
    const transformedElements = design.elements.map((element: any) => {
      // Validate required element fields
      if (!element.id || !element.type) {
        throw new Error(`Invalid element: missing id or type`);
      }

      const baseElement = {
        id: element.id,
        type: element.type,
        position: { 
          x: element.position?.x ?? element.x ?? 0, 
          y: element.position?.y ?? element.y ?? 0 
        },
        size: { 
          width: element.size?.width ?? element.width ?? 100, 
          height: element.size?.height ?? element.height ?? 100 
        },
        rotation: element.rotation || 0,
        layer: element.layer || 0,
        view: element.view || 'front',
        properties: {} as any
      };

      // Handle text elements
      if (element.type === 'text') {
        const textProps = element.properties || element;
        baseElement.properties = {
          text: textProps.text || '',
          fontFamily: textProps.fontFamily || 'Arial',
          fontSize: textProps.fontSize || 16,
          fontColor: textProps.fontColor || textProps.color || '#000000',
          fontWeight: textProps.fontWeight || 'normal',
          fontStyle: textProps.fontStyle || 'normal',
          textAlign: textProps.textAlign || 'left',
          lineHeight: textProps.lineHeight || 1.2,
          letterSpacing: textProps.letterSpacing || 0,
          textPath: textProps.textPath || null
        };
      } 
      // Handle image/clipart elements
      else if (element.type === 'image' || element.type === 'clipart') {
        const imageProps = element.properties || element;
        baseElement.properties = {
          src: imageProps.src || '',
          opacity: imageProps.opacity || 1,
          originalWidth: imageProps.originalWidth || baseElement.size.width,
          originalHeight: imageProps.originalHeight || baseElement.size.height,
          filter: imageProps.filter || null,
          // File metadata if available
          fileId: imageProps.fileId || null,
          originalFilename: imageProps.originalFilename || null,
          fileSize: imageProps.fileSize || null,
          mimeType: imageProps.mimeType || null,
          uploadedAt: imageProps.uploadedAt || null
        };
      }

      return baseElement;
    });

    const dimensions = calculateDesignDimensions(design);

    const newDesign = new Design({
      name: design.name || name || 'Untitled Design',
      shareableId,
      accessToken,
      tshirt: design.tshirt,
      elements: transformedElements,
      dimensions,
      isPublic: design.isPublic || false,
      metadata: {
        email,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    await newDesign.save();

    const privateLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/design-studio/${shareableId}`;
    const publicLink = newDesign.isPublic
      ? `${process.env.FRONTEND_URL || 'http://localhost:3000'}/share/${shareableId}`
      : null;

    // Send congratulatory email asynchronously
    const designData = {
      designName: newDesign.name,
      designId: shareableId,
      designLink: privateLink,
      tshirtStyle: design.tshirt.style,
      tshirtColor: design.tshirt.color,
      elementCount: transformedElements.length,
      createdDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    // Send email without blocking the response
    console.log(`ATTEMPTING to send design success email to: ${email}`);
    console.log(`Email data:`, designData);
    
    sendDesignSuccessEmail(email, designData)
      .then((success) => {
        if (success) {
          console.log(`SUCCESS: Design success email sent to ${email} for design ${shareableId}`);
        } else {
          console.log(`FAILED: Design success email failed to send to ${email} for design ${shareableId}`);
        }
      })
      .catch((emailError) => {
        console.error(`ERROR: Failed to send design success email to ${email}:`, emailError);
        console.error(`ERROR details:`, emailError.message);
      });

    res.status(201).json({
      success: true,
      designId: shareableId,
      shareableLink: privateLink,
      publicLink,
      data: newDesign,
      message: 'Design saved successfully! A confirmation email has been sent.'
    });
  } catch (error) {
    console.error('Error creating design:', error);
    res.status(500).json({ success: false, message: 'Error creating design', error });
  }
};

// Get a design by its ID or shareableId
export const getDesign = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { token } = req.query;
    
    // Try to find by shareableId first, then by _id
    let design = await Design.findOne({ shareableId: id });
    if (!design) {
      design = await Design.findById(id);
    }

    if (!design) {
      res.status(404).json({ success: false, message: 'Design not found' });
      return;
    }

    // Check access permissions
    if (!design.isPublic) {
      if (!token) {
        res.status(401).json({ success: false, message: 'Access token required for private design' });
        return;
      }

      try {
        jwt.verify(token as string, process.env.JWT_SECRET as string);
      } catch (jwtError) {
        res.status(401).json({ success: false, message: 'Invalid or expired access token' });
        return;
      }
    }

    // Transform backend elements to frontend format and resolve file URLs
    const frontendElements = design.elements.map((element: any) => {
      const baseElement = {
        id: element.id,
        type: element.type,
        x: element.position.x,
        y: element.position.y,
        width: element.size.width,
        height: element.size.height,
        rotation: element.rotation,
        layer: element.layer,
        view: element.view
      };

      if (element.type === 'text') {
        return {
          ...baseElement,
          text: element.properties?.text || '',
          fontFamily: element.properties?.fontFamily || 'Arial',
          fontSize: element.properties?.fontSize || 16,
          color: element.properties?.fontColor || '#000000',
          fontWeight: element.properties?.fontWeight || 'normal',
          fontStyle: element.properties?.fontStyle || 'normal',
          textAlign: element.properties?.textAlign || 'left',
          lineHeight: element.properties?.lineHeight || 1.2,
          letterSpacing: element.properties?.letterSpacing || 0,
          textPath: element.properties?.textPath
        };
      } else if (element.type === 'image' || element.type === 'clipart') {
        const baseUrl = process.env.NODE_ENV === 'production' 
          ? process.env.BASE_URL 
          : `http://localhost:${process.env.PORT || 3001}`;
        
        let resolvedSrc = element.properties?.src || '';
        
        // If src is a relative path, make it absolute
        if (resolvedSrc && !resolvedSrc.startsWith('http') && !resolvedSrc.startsWith('data:')) {
          resolvedSrc = `${baseUrl}${resolvedSrc}`;
        }

        return {
          ...baseElement,
          src: resolvedSrc,
          opacity: element.properties?.opacity || 1,
          filter: element.properties?.filter,
          // Include file metadata for reference
          fileInfo: element.properties?.fileId ? {
            fileId: element.properties.fileId,
            originalFilename: element.properties.originalFilename,
            fileSize: element.properties.fileSize,
            mimeType: element.properties.mimeType,
            uploadedAt: element.properties.uploadedAt
          } : null
        };
      }

      return baseElement;
    });

    const responseData = {
      ...design.toObject(),
      elements: frontendElements
    };

    res.json({
      success: true,
      data: responseData,
      message: 'Design retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching design:', error);
    res.status(500).json({ success: false, message: 'Error fetching design', error });
  }
};

// Update an existing design
export const updateDesign = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, elements, tshirt, dimensions } = req.body;

    // Try to find by shareableId first, then by _id
    let design = await Design.findOne({ shareableId: id });
    if (!design) {
      design = await Design.findById(id);
    }

    if (!design) {
      res.status(404).json({ success: false, message: 'Design not found' });
      return;
    }

    // Update fields if provided
    if (name) design.name = name;
    if (tshirt) design.tshirt = tshirt;
    if (dimensions) design.dimensions = dimensions;
    
    if (elements) {
      // Transform elements similar to create
      const transformedElements = elements.map((element: any) => {
        const baseElement = {
          id: element.id,
          type: element.type,
          position: { 
            x: element.position?.x ?? element.x ?? 0, 
            y: element.position?.y ?? element.y ?? 0 
          },
          size: { 
            width: element.size?.width ?? element.width ?? 100, 
            height: element.size?.height ?? element.height ?? 100 
          },
          rotation: element.rotation || 0,
          layer: element.layer || 0,
          view: element.view || 'front',
          properties: {} as any
        };

        if (element.type === 'text') {
          const textProps = element.properties || element;
          baseElement.properties = {
            text: textProps.text || '',
            fontFamily: textProps.fontFamily || 'Arial',
            fontSize: textProps.fontSize || 16,
            fontColor: textProps.fontColor || textProps.color || '#000000',
            fontWeight: textProps.fontWeight || 'normal',
            fontStyle: textProps.fontStyle || 'normal',
            textAlign: textProps.textAlign || 'left',
            lineHeight: textProps.lineHeight || 1.2,
            letterSpacing: textProps.letterSpacing || 0,
            textPath: textProps.textPath || null
          };
        } else if (element.type === 'image' || element.type === 'clipart') {
          const imageProps = element.properties || element;
          baseElement.properties = {
            src: imageProps.src || '',
            opacity: imageProps.opacity || 1,
            originalWidth: imageProps.originalWidth || baseElement.size.width,
            originalHeight: imageProps.originalHeight || baseElement.size.height,
            filter: imageProps.filter || null,
            fileId: imageProps.fileId || null,
            originalFilename: imageProps.originalFilename || null,
            fileSize: imageProps.fileSize || null,
            mimeType: imageProps.mimeType || null,
            uploadedAt: imageProps.uploadedAt || null
          };
        }

        return baseElement;
      });
      
      design.elements = transformedElements;
    }

    design.metadata.updatedAt = new Date();
    await design.save();

    res.json({ success: true, data: design, message: 'Design updated successfully' });
  } catch (error) {
    console.error('Error updating design:', error);
    res.status(500).json({ success: false, message: 'Error updating design', error });
  }
};

// Placeholder functions for other routes
export const getDesignForManufacturer = async (req: Request, res: Response) => {
  res.status(501).json({ success: false, message: 'Not implemented yet' });
};

export const getDesignFiles = async (req: Request, res: Response) => {
  res.status(501).json({ success: false, message: 'Not implemented yet' });
};

export const validateDesign = async (req: Request, res: Response) => {
  res.status(501).json({ success: false, message: 'Not implemented yet' });
};

export const sendDesignEmailManually = async (req: Request, res: Response) => {
  try {
    const { designId, email } = req.body;

    if (!designId || !email) {
      res.status(400).json({
        success: false,
        message: 'Design ID and email are required'
      });
      return;
    }

    const design = await Design.findOne({ shareableId: designId });

    if (!design) {
      res.status(404).json({
        success: false,
        message: 'Design not found'
      });
      return;
    }

    const designLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/design-studio/${designId}`;
    
    const designData = {
      designName: design.name,
      designId: designId,
      designLink: designLink,
      tshirtStyle: design.tshirt.style,
      tshirtColor: design.tshirt.color,
      elementCount: design.elements.length,
      createdDate: design.createdAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    const success = await sendDesignSuccessEmail(email, designData);
    
    if (success) {
      res.json({
        success: true,
        message: 'Design success email sent successfully!'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send email'
      });
    }
  } catch (error) {
    console.error('Error sending design email manually:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending email'
    });
  }
};