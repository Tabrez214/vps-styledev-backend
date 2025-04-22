import mongoose from 'mongoose';
import Product from '../src/models/product';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the root .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

interface ProductImage {
  url: string;
  caption?: string;
  isDefault?: boolean;
}

const updateProductImageUrls = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('Connected to MongoDB');

    // Find all products
    const products = await Product.find();
    console.log(`Found ${products.length} products to update`);

    // Update each product's image URLs
    for (const product of products) {
      const updatedImages = product.images.map((image: ProductImage) => ({
        url: image.url.replace('http://localhost:3001', process.env.BASE_URL as string),
        caption: image.caption,
        isDefault: image.isDefault
      }));

      await Product.findByIdAndUpdate(
        product._id,
        { $set: { images: updatedImages } }
      );
    }

    console.log('Successfully updated all product image URLs');
  } catch (error) {
    console.error('Error updating product image URLs:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

updateProductImageUrls(); 