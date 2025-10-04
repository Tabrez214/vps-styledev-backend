// Migration script to update existing orders with proper image data
import mongoose from 'mongoose';
import Order from '../models/order';
import { enrichOrderItemWithImages } from '../services/imageEnrichmentService';
import config from '../config/config';

interface MigrationStats {
  totalOrders: number;
  processedOrders: number;
  failedOrders: number;
  updatedItems: number;
  errors: string[];
}

/**
 * Migrate existing orders to use the new image storage system
 */
export async function migrateOrderImages(batchSize: number = 50): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalOrders: 0,
    processedOrders: 0,
    failedOrders: 0,
    updatedItems: 0,
    errors: [],
  };

  try {
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(config.DB_URI);
      console.log('Connected to MongoDB for migration');
    }

    // Get total count
    stats.totalOrders = await Order.countDocuments({
      'items.primaryImage': { $exists: false }
    });

    console.log(`🔄 Starting migration of ${stats.totalOrders} orders...`);

    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      // Get batch of orders that need migration
      const orders = await Order.find({
        'items.primaryImage': { $exists: false }
      })
      .select('_id items')
      .limit(batchSize)
      .skip(skip)
      .lean();

      if (orders.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`📦 Processing batch ${Math.floor(skip / batchSize) + 1} (${orders.length} orders)`);

      // Process each order in the batch
      for (const order of orders) {
        try {
          const updatedItems = [];
          let itemsUpdated = 0;

          for (const item of order.items) {
            try {
              // Skip if already has new image structure
              if (item.primaryImage) {
                updatedItems.push(item);
                continue;
              }

              // Enrich with image data
              const imageData = await enrichOrderItemWithImages(
                item.productId?.toString() || '',
                item.color || 'default',
                item.productName || 'Unknown Product'
              );

              // Update item with new structure
              const updatedItem = {
                ...item,
                productName: item.productName || 'Unknown Product',
                primaryImage: imageData.primaryImage,
                fallbackImages: imageData.fallbackImages,
                imageMetadata: imageData.imageMetadata,
                // Update legacy image field if it's empty or placeholder
                image: (!item.image || item.image.includes('placeholder') || item.image.includes('t-shirt-template'))
                  ? imageData.primaryImage.url
                  : item.image,
              };

              updatedItems.push(updatedItem);
              itemsUpdated++;

            } catch (itemError) {
              console.warn(`⚠️ Failed to migrate item in order ${order._id}:`, itemError);
              // Keep original item if migration fails
              updatedItems.push(item);
            }
          }

          // Update the order if any items were processed
          if (itemsUpdated > 0) {
            await Order.findByIdAndUpdate(order._id, {
              items: updatedItems,
              'migration.imageEnrichment': {
                completedAt: new Date(),
                itemsUpdated,
                version: '1.0'
              }
            });

            stats.updatedItems += itemsUpdated;
          }

          stats.processedOrders++;

          // Log progress every 10 orders
          if (stats.processedOrders % 10 === 0) {
            console.log(`✅ Processed ${stats.processedOrders}/${stats.totalOrders} orders`);
          }

        } catch (orderError) {
          stats.failedOrders++;
          const errorMsg = `Failed to migrate order ${order._id}: ${orderError.message}`;
          stats.errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }

      skip += batchSize;
    }

    console.log('🎉 Migration completed!');
    console.log(`📊 Stats:`, {
      totalOrders: stats.totalOrders,
      processedOrders: stats.processedOrders,
      failedOrders: stats.failedOrders,
      updatedItems: stats.updatedItems,
      errorCount: stats.errors.length
    });

    return stats;

  } catch (error) {
    console.error('💥 Migration failed:', error);
    throw error;
  }
}

/**
 * Rollback migration (restore original state)
 */
export async function rollbackImageMigration(): Promise<void> {
  console.log('🔄 Rolling back image migration...');

  const result = await Order.updateMany(
    { 'migration.imageEnrichment': { $exists: true } },
    {
      $unset: {
        'items.$[].primaryImage': '',
        'items.$[].fallbackImages': '',
        'items.$[].imageMetadata': '',
        'migration.imageEnrichment': ''
      }
    }
  );

  console.log(`✅ Rollback completed. Modified ${result.modifiedCount} orders.`);
}

// CLI execution
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'migrate') {
    const batchSize = parseInt(process.argv[3]) || 50;
    migrateOrderImages(batchSize)
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('Migration failed:', error);
        process.exit(1);
      });
  } else if (command === 'rollback') {
    rollbackImageMigration()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('Rollback failed:', error);
        process.exit(1);
      });
  } else {
    console.log('Usage:');
    console.log('  npm run migrate:images migrate [batchSize]');
    console.log('  npm run migrate:images rollback');
    process.exit(1);
  }
}