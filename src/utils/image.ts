const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

/**
 * Ensures that a directory exists, creating it if necessary
 * @param {string} dirPath - The directory path to check/create
 * @returns {Promise<void>}
 */
const ensureDirectoryExists = async (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * Generates a file path for a design preview image
 * @param {string} designId - The design's shareable ID
 * @param {string} view - The view (front, back, left, right)
 * @returns {string} The file path
 */
const getPreviewImagePath = (designId: string, view: string) => {
  const uploadsDir = path.join(__dirname, '../../uploads');
  const previewsDir = path.join(uploadsDir, 'designs/previews');
  return path.join(previewsDir, `design-${designId}-${view}.jpg`);
};

/**
 * Generates preview images for all views of a design
 * @param {Object} design - The design document
 * @returns {Promise<Object>} Object with URLs to preview images
 */
const generatePreviewImages = async (design: any) => {
  try {
    // Ensure previews directory exists
    const uploadsDir = path.join(__dirname, '../../uploads');
    const previewsDir = path.join(uploadsDir, 'designs/previews');
    await ensureDirectoryExists(previewsDir);
    
    // Get t-shirt base images (in a real app, these would come from the database)
    const baseImagePaths = {
      front: path.join(uploadsDir, '../public/images/tshirt-front.jpg'),
      back: path.join(uploadsDir, '../public/images/tshirt-back.jpg'),
      left: path.join(uploadsDir, '../public/images/tshirt-left.jpg'),
      right: path.join(uploadsDir, '../public/images/tshirt-right.jpg')
    };
    
    // Generate preview for each view
    const previewUrls: Record<'front' | 'back' | 'left' | 'right', string> = {
      front: '',
      back: '',
      left: '',
      right: ''
    };
    const views = ['front', 'back', 'left', 'right'];
    
    for (const view of views) {
      // Create canvas for preview
      const canvas = createCanvas(800, 800);
      const ctx = canvas.getContext('2d');
      
      // Load base t-shirt image
      let baseImage;
      try {
        baseImage = await loadImage(baseImagePaths[view as keyof typeof baseImagePaths]);
      } catch (error) {
        console.error(`Error loading base image for ${view} view:`, error);
        // Use a placeholder if base image not found
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 800, 800);
        ctx.fillStyle = '#cccccc';
        ctx.font = '30px Arial';
        ctx.fillText(`${view.toUpperCase()} VIEW`, 300, 400);
      }
      
      if (baseImage) {
        // Draw base t-shirt image
        ctx.drawImage(baseImage, 0, 0, 800, 800);
      }
      
      // Apply t-shirt color (simplified - in a real app, you'd use more sophisticated coloring)
      if (design.tshirt.color) {
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = design.tshirt.color;
        ctx.fillRect(0, 0, 800, 800);
        ctx.globalCompositeOperation = 'source-over';
      }
      
      // Draw design elements for this view
      const viewElements = design.elements.filter((el: any) => el.view === view);
      
      // Sort elements by layer (z-index)
      viewElements.sort((a: any, b: any) => a.layer - b.layer);
      
      for (const element of viewElements) {
        if (element.type === 'text') {
          // Draw text element
          ctx.save();
          ctx.translate(element.position.x, element.position.y);
          ctx.rotate(element.rotation * Math.PI / 180);
          
          ctx.font = `${element.properties.fontWeight || ''} ${element.properties.fontStyle || ''} ${element.properties.fontSize || 20}px ${element.properties.fontFamily || 'Arial'}`;
          ctx.fillStyle = element.properties.fontColor || '#000000';
          ctx.fillText(element.properties.text || '', 0, 0);
          
          ctx.restore();
        } else if (element.type === 'image' || element.type === 'clipart') {
          // In a real app, you'd load and draw the image
          // For this example, we'll just draw a placeholder
          ctx.save();
          ctx.translate(element.position.x, element.position.y);
          ctx.rotate(element.rotation * Math.PI / 180);
          
          ctx.fillStyle = '#888888';
          ctx.fillRect(0, 0, element.size.width, element.size.height);
          ctx.fillStyle = '#ffffff';
          ctx.font = '14px Arial';
          ctx.fillText(element.type.toUpperCase(), 10, element.size.height / 2);
          
          ctx.restore();
        }
      }
      
      // Save preview image
      const previewPath = getPreviewImagePath(design.shareableId, view);
      const out = fs.createWriteStream(previewPath);
      const stream = canvas.createJPEGStream({ quality: 0.9 });
      stream.pipe(out);
      
      await new Promise((resolve, reject) => {
        out.on('finish', resolve);
        out.on('error', reject);
      });
      // Generate URL for preview
      previewUrls[view as keyof typeof previewUrls] = `/uploads/designs/previews/design-${design.shareableId}-${view}.jpg`;
    }
    
    return previewUrls;
  } catch (error) {
    console.error('Error generating preview images:', error);
    throw error;
  }
};

export { ensureDirectoryExists, getPreviewImagePath, generatePreviewImages };
