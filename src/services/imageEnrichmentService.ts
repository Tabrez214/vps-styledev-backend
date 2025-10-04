// Image Enrichment Service - Handles product image fetching and storage for orders
import Product from '../models/product';
import { getPlaceholderImageData, normalizeImageUrl, ProductImageData, EnrichedImageData } from '../utils/image';

// Use types from utils/image.ts

/**
 * Get the best image URL for a product with specific color
 */
export const getProductColorImage = (colors: any[], targetColor: string): ProductImageData | null => {
  if (!colors || !Array.isArray(colors) || !targetColor) {
    return null;
  }

  // Try exact match first
  const exactMatch = colors.find(
    (c: any) =>
      c.name &&
      c.name.toLowerCase().trim() === targetColor.toLowerCase().trim()
  );

  if (exactMatch && exactMatch.images && exactMatch.images.length > 0) {
    const defaultImage = exactMatch.images.find((img: any) => img.isDefault === true);
    const selectedImage = defaultImage || exactMatch.images[0];
    return {
      url: normalizeImageUrl(selectedImage.url),
      alt: `${exactMatch.name} ${targetColor}` || targetColor,
      imageId: (selectedImage as any)._id || (selectedImage as any).id || '',
    };
  }

  // Try partial match if exact match fails
  const partialMatch = colors.find((c: any) => {
    if (!c.name) return false;
    const colorWords = c.name.toLowerCase().split(/\s+/);
    const targetColorWords = targetColor.toLowerCase().split(/\s+/);
    return (
      colorWords.some((word: string) => targetColorWords.includes(word)) ||
      targetColorWords.some((word: string) => colorWords.includes(word))
    );
  });

  if (partialMatch && partialMatch.images && partialMatch.images.length > 0) {
    const defaultImage = partialMatch.images.find((img: any) => img.isDefault === true);
    const selectedImage = defaultImage || partialMatch.images[0];
    return {
      url: normalizeImageUrl(selectedImage.url),
      alt: `${partialMatch.name} ${targetColor}` || targetColor,
      imageId: (selectedImage as any)._id || (selectedImage as any).id || '',
    };
  }

  return null;
};

// normalizeImageUrl is imported from utils/image.ts

/**
 * Get fallback images from a product
 */
export const getProductFallbackImages = (
  product: any,
  targetColor: string,
  excludeImageId: string
): ProductImageData[] => {
  const fallbackImages: ProductImageData[] = [];

  // First, try to get other images from the same color
  if (product.colors && Array.isArray(product.colors)) {
    const matchingColor = product.colors.find(
      (c: any) => c.name && c.name.toLowerCase().trim() === targetColor.toLowerCase().trim()
    );

    if (matchingColor && matchingColor.images) {
      const otherImages = matchingColor.images
        .filter((img: any) => ((img as any)._id || (img as any).id) !== excludeImageId)
        .slice(0, 2); // Get up to 2 fallback images

      otherImages.forEach((img: any) => {
        fallbackImages.push({
          url: normalizeImageUrl(img.url),
          alt: `${matchingColor.name} ${targetColor}` || targetColor,
          imageId: (img as any)._id || (img as any).id || '',
        });
      });
    }
  }

  // If we need more fallback images, get from other colors
  if (fallbackImages.length < 2 && product.colors) {
    const otherColors = product.colors.filter(
      (c: any) => c.name && c.name.toLowerCase().trim() !== targetColor.toLowerCase().trim()
    );

    for (const color of otherColors) {
      if (fallbackImages.length >= 2) break;
      if (color.images && color.images.length > 0) {
        const defaultImage = color.images.find((img: any) => img.isDefault === true);
        const selectedImage = defaultImage || color.images[0];

        fallbackImages.push({
          url: normalizeImageUrl(selectedImage.url),
          alt: `${color.name} alternative`,
          imageId: (selectedImage as any)._id || (selectedImage as any).id || '',
        });
      }
    }
  }

  // If still no fallback images, try general product images
  if (fallbackImages.length < 2 && product.images && product.images.length > 0) {
    const remainingSlots = 2 - fallbackImages.length;
    const generalImages = product.images.slice(0, remainingSlots);

    generalImages.forEach((img: any) => {
      fallbackImages.push({
        url: normalizeImageUrl(img.url),
        alt: product.name || 'Product image',
        imageId: (img as any)._id || (img as any).id || '',
      });
    });
  }

  return fallbackImages;
};

/**
 * Enrich order item with comprehensive image data
 */
export const enrichOrderItemWithImages = async (
  productId: string,
  color?: string,
  productName?: string
): Promise<EnrichedImageData> => {
  try {
    // Fetch product data
    const product = await Product.findById(productId)
      .select('name images colors')
      .lean();

    if (!product) {
      console.warn(`Product ${productId} not found for image enrichment`);
      return getPlaceholderImageData(productName || 'Unknown Product');
    }

    let primaryImage: ProductImageData | undefined;
    let colorId = '';
    let totalImagesAvailable = 0;

    // Try to get color-specific image first
    if (color) {
      const colorImage = getProductColorImage(product.colors, color);
      if (colorImage) {
        primaryImage = colorImage;

        // Find color ID for metadata
        const matchingColor = product.colors?.find(
          (c: any) => c.name && c.name.toLowerCase().trim() === color.toLowerCase().trim()
        );
        colorId = (matchingColor as any)?._id || (matchingColor as any)?.id || '';
        totalImagesAvailable = matchingColor?.images?.length || 0;
      }
    }

    // Fallback to general product images if no color image found
    if (!primaryImage && product.images && product.images.length > 0) {
      const defaultImage = product.images.find((img: any) => img.isDefault === true);
      const selectedImage = defaultImage || product.images[0];

      primaryImage = {
        url: normalizeImageUrl(selectedImage.url),
        alt: product.name || productName || 'Product image',
        imageId: (selectedImage as any)._id || (selectedImage as any).id || '',
      };
      totalImagesAvailable = product.images.length;
    }

    // If still no primary image, use placeholder
    if (!primaryImage) {
      return getPlaceholderImageData(product.name || productName || 'Product');
    }

    // Get fallback images
    const fallbackImages = getProductFallbackImages(product, color || '', primaryImage.imageId);

    return {
      primaryImage,
      fallbackImages,
      imageMetadata: {
        colorId,
        totalImagesAvailable,
        lastUpdated: new Date(),
      },
    };

  } catch (error) {
    console.error(`Error enriching images for product ${productId}:`, error);
    return getPlaceholderImageData(productName || 'Product');
  }
};

/**
 * Batch enrich multiple order items
 */
export const batchEnrichOrderItems = async (
  items: Array<{
    productId: string;
    color?: string;
    productName?: string;
  }>
): Promise<EnrichedImageData[]> => {
  const enrichmentPromises = items.map(item =>
    enrichOrderItemWithImages(item.productId, item.color, item.productName)
  );

  return Promise.all(enrichmentPromises);
};

/**
 * Health check - verify images are accessible
 */
export const verifyImageHealth = async (imageUrl: string): Promise<boolean> => {
  try {
    // In a real implementation, you might want to make a HEAD request
    // For now, we'll do basic URL validation
    const normalizedUrl = normalizeImageUrl(imageUrl);
    return normalizedUrl.startsWith('http') && normalizedUrl.length > 10;
  } catch (error) {
    console.error(`Image health check failed for ${imageUrl}:`, error);
    return false;
  }
};

export default {
  enrichOrderItemWithImages,
  batchEnrichOrderItems,
  getProductColorImage,
  getProductFallbackImages,
  verifyImageHealth,
  normalizeImageUrl,
};