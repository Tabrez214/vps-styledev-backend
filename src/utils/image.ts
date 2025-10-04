// Image utility functions for order processing
export interface ProductImageData {
  url: string;
  alt: string;
  imageId: string;
}

export interface EnrichedImageData {
  primaryImage: ProductImageData;
  fallbackImages: ProductImageData[];
  imageMetadata: {
    colorId: string;
    totalImagesAvailable: number;
    lastUpdated: Date;
  };
}

/**
 * Returns a reliable fallback placeholder image data
 */
export const getPlaceholderImageData = (productName: string = 'Product'): EnrichedImageData => {
  const placeholderUrl = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDE1MCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIiBmaWxsPSIjZTVlN2ViIi8+CjxwYXRoIGQ9Ik02MCA2MEw5MCA5ME02MCA5MEw5MCA2MCIgc3Ryb2tlPSIjNmI3MjgwIiBzdHJva2Utd2lkdGg9IjIiLz4KPHR5cGUgeD0iNzUiIHk9IjEyMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzZiNzI4MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIj5ObyBJbWFnZTwvdGV4dD4KPC9zdmc+";
  
  return {
    primaryImage: {
      url: placeholderUrl,
      alt: `${productName} - Image not available`,
      imageId: 'placeholder',
    },
    fallbackImages: [],
    imageMetadata: {
      colorId: '',
      totalImagesAvailable: 0,
      lastUpdated: new Date(),
    },
  };
};

/**
 * Normalizes image URLs to ensure they are properly formatted
 */
export const normalizeImageUrl = (url: string): string => {
  if (!url) return "";
  
  // If it's already a full URL, return as is
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  
  // If it starts with a slash, prepend the API URL
  if (url.startsWith("/")) {
    return `${process.env.API_URL || "https://api.styledev.in"}${url}`;
  }
  
  // If it's a relative path, prepend API URL with slash
  return `${process.env.API_URL || "https://api.styledev.in"}/${url}`;
};