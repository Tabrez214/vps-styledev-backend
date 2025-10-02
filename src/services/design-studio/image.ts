import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage, CanvasRenderingContext2D, CanvasTextAlign } from 'canvas';
import { v4 as uuidv4 } from 'uuid';
import config from '../../config/config';
import { DesignDocument } from '../../models/design-studio/design';
import { PreviewImages, DesignElement } from '../../interfaces';

/**
 * Generate preview images for all views of a t-shirt design
 * @param design The design document
 * @returns Object with URLs to the generated preview images
 */
export const generatePreviewImages = async (design: DesignDocument): Promise<PreviewImages> => {
  // Ensure the previews directory exists
  if (!fs.existsSync(config.DESIGNS_PREVIEWS_DIR)) {
    fs.mkdirSync(config.DESIGNS_PREVIEWS_DIR, { recursive: true });
  }
  
  // Generate unique ID for this set of previews
  const previewId = uuidv4();
  
  // Define the views to generate
  const views = ['front', 'back', 'left', 'right'] as const;
  
  // Create a result object to store the preview image paths
  const previewImages: Partial<PreviewImages> = {};
  
  // Generate preview for each view
  for (const view of views) {
    // Get the base t-shirt image path
    const baseTshirtPath = path.join(process.cwd(), 'public', 'images', `tshirt-${view}.jpg`);
    
    // Create a unique filename for this preview
    const previewFilename = `${design.shareableId}-${view}-${previewId}.png`;
    const previewPath = path.join(config.DESIGNS_PREVIEWS_DIR, previewFilename);
    
    // Generate the preview image
    await generatePreviewForView(design, view, baseTshirtPath, previewPath);
    
    // Store the relative URL path
    previewImages[view] = `/uploads/designs/previews/${previewFilename}`;
  }
  
  return previewImages as PreviewImages;
};

/**
 * Generate a preview image for a specific view of the t-shirt
 * @param design The design document
 * @param view The view to generate (front, back, left, right)
 * @param baseTshirtPath Path to the base t-shirt image
 * @param outputPath Path where the preview should be saved
 */
const generatePreviewForView = async (
  design: DesignDocument,
  view: 'front' | 'back' | 'left' | 'right',
  baseTshirtPath: string,
  outputPath: string
): Promise<void> => {
  try {
    // Load the base t-shirt image
    const baseImage = await loadImage(baseTshirtPath);
    
    // Create a canvas with the same dimensions as the base image
    const canvas = createCanvas(baseImage.width, baseImage.height);
    const ctx = canvas.getContext('2d');
    
    // Draw the base t-shirt image
    ctx.drawImage(baseImage, 0, 0);
    
    // Apply the t-shirt color
    applyTshirtColor(ctx, design.tshirt.color, baseImage.width, baseImage.height);
    
    // Get elements for this view
    const viewElements = design.elements.filter(el => el.view === view);
    
    // Sort elements by layer (lowest to highest)
    viewElements.sort((a, b) => a.layer - b.layer);
    
    // Draw each element
    for (const element of viewElements) {
      await drawElement(ctx, element);
    }
    
    // Save the canvas to a file
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
  } catch (error) {
    console.error(`Error generating preview for ${view} view:`, error);
    throw new Error(`Failed to generate preview for ${view} view`);
  }
};

/**
 * Apply t-shirt color to the base image
 * @param ctx Canvas context
 * @param color Hex color code
 * @param width Canvas width
 * @param height Canvas height
 */
const applyTshirtColor = (
  ctx: CanvasRenderingContext2D,
  color: string,
  width: number,
  height: number
): void => {
  // Save the current state
  ctx.save();
  
  // Set the composite operation to multiply (blends the color with the image)
  ctx.globalCompositeOperation = 'multiply';
  
  // Fill with the t-shirt color
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  
  // Restore the previous state
  ctx.restore();
};

/**
 * Draw a design element on the canvas
 * @param ctx Canvas context
 * @param element Design element to draw
 */
const drawElement = async (
  ctx: CanvasRenderingContext2D,
  element: DesignElement
): Promise<void> => {
  // Save the current state
  ctx.save();
  
  // Apply transformations
  ctx.translate(element.position.x, element.position.y);
  
  if (element.rotation !== 0) {
    // Convert degrees to radians and rotate around the center of the element
    const centerX = element.size.width / 2;
    const centerY = element.size.height / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate((element.rotation * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);
  }
  
  // Draw based on element type
  switch (element.type) {
    case 'text':
      drawTextElement(ctx, element);
      break;
    case 'image':
    case 'clipart':
      await drawImageElement(ctx, element);
      break;
  }
  
  // Restore the previous state
  ctx.restore();
};

/**
 * Draw a text element on the canvas
 * @param ctx Canvas context
 * @param element Text element to draw
 */
const drawTextElement = (
  ctx: CanvasRenderingContext2D,
  element: DesignElement
): void => {
  if (element.type !== 'text') return;

  // Inline type for text properties to fix missing type error
  const {
    text,
    fontFamily,
    fontSize,
    fontColor,
    fontWeight,
    fontStyle,
    textAlign
  } = element.properties as {
    text: string;
    fontFamily: string;
    fontSize: number;
    fontColor: string;
    fontWeight?: string;
    fontStyle?: string;
    textAlign?: string;
  };

  // Set text properties
  ctx.fillStyle = fontColor;
  ctx.font = `${fontStyle ? fontStyle + ' ' : ''}${fontWeight ? fontWeight + ' ' : ''}${fontSize}px ${fontFamily}`;
  ctx.textAlign = textAlign as CanvasTextAlign || 'left';
  
  // Calculate vertical position (centered vertically in the element)
  const y = element.size.height / 2;
  
  // Calculate horizontal position based on text alignment
  let x = 0;
  if (textAlign === 'center') {
    x = element.size.width / 2;
  } else if (textAlign === 'right') {
    x = element.size.width;
  }
  
  // Draw the text
  ctx.fillText(text, x, y);
};

/**
 * Draw an image or clipart element on the canvas
 * @param ctx Canvas context
 * @param element Image or clipart element to draw
 */
const drawImageElement = async (
  ctx: CanvasRenderingContext2D,
  element: DesignElement
): Promise<void> => {
  if (element.type !== 'image' && element.type !== 'clipart') return;
  
  try {
    // Get the image source
    const { src, opacity } = element.properties as { src: string; opacity: number };
    
    // Set opacity if specified
    if (opacity !== undefined) {
      ctx.globalAlpha = opacity;
    }
    
    // Load and draw the image
    const image = await loadImage(path.join(process.cwd(), src));
    ctx.drawImage(image, 0, 0, element.size.width, element.size.height);
  } catch (error) {
    console.error('Error drawing image element:', error);
    // Draw a placeholder rectangle if image loading fails
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(0, 0, element.size.width, element.size.height);
  }
};

/**
 * Calculate design dimensions in inches for all views
 * @param design The design object
 * @returns Object with dimensions for each view
 */
export const calculateDesignDimensions = (design: any): any => {
  // Define the views to calculate
  const views = ['front', 'back', 'left', 'right'];
  
  // Create a result object to store the dimensions
  const dimensions: any = {};
  
  // Calculate dimensions for each view
  for (const view of views) {
    // Get elements for this view
    const viewElements = design.elements.filter((el: any) => el.view === view);
    
    if (viewElements.length === 0) {
      // No elements in this view
      dimensions[view] = {
        widthInches: 0,
        heightInches: 0
      };
      continue;
    }
    
    // Find the bounding box of all elements
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    viewElements.forEach((el: any) => {
      const left = el.position.x;
      const top = el.position.y;
      const right = left + el.size.width;
      const bottom = top + el.size.height;
      
      minX = Math.min(minX, left);
      minY = Math.min(minY, top);
      maxX = Math.max(maxX, right);
      maxY = Math.max(maxY, bottom);
    });
    
    // Convert to inches (assuming 72 pixels per inch)
    const pixelsPerInch = 72;
    dimensions[view] = {
      widthInches: (maxX - minX) / pixelsPerInch,
      heightInches: (maxY - minY) / pixelsPerInch
    };
  }
  
  return dimensions;
};
