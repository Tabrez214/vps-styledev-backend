// Image Health Check Service - Monitor and fix broken images in orders
import Order from '../models/order';
import { enrichOrderItemWithImages } from './imageEnrichmentService';
import { verifyImageHealth } from './imageEnrichmentService';

interface HealthCheckResult {
  orderId: string;
  itemIndex: number;
  status: 'healthy' | 'fixed' | 'failed';
  originalUrl?: string;
  newUrl?: string;
  error?: string;
}

interface HealthStats {
  totalOrdersChecked: number;
  totalItemsChecked: number;
  healthyItems: number;
  fixedItems: number;
  failedItems: number;
  results: HealthCheckResult[];
}

/**
 * Check and fix broken images in recent orders
 */
export async function runImageHealthCheck(
  daysBack: number = 7,
  batchSize: number = 100
): Promise<HealthStats> {
  const stats: HealthStats = {
    totalOrdersChecked: 0,
    totalItemsChecked: 0,
    healthyItems: 0,
    fixedItems: 0,
    failedItems: 0,
    results: [],
  };

  try {
    // Get recent orders
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const orders = await Order.find({
      createdAt: { $gte: cutoffDate },
      'items.0': { $exists: true }
    })
      .select('_id items')
      .limit(batchSize)
      .lean();

    console.log(`🔍 Checking image health for ${orders.length} recent orders...`);

    for (const order of orders) {
      stats.totalOrdersChecked++;
      let orderUpdated = false;
      const updatedItems = [];

      for (let itemIndex = 0; itemIndex < order.items.length; itemIndex++) {
        const item = order.items[itemIndex];
        stats.totalItemsChecked++;

        try {
          // Check primary image health
          const primaryImageHealthy = item.primaryImage?.url
            ? await verifyImageHealth(item.primaryImage.url)
            : false;

          if (primaryImageHealthy) {
            // Image is healthy
            stats.healthyItems++;
            updatedItems.push(item);
            stats.results.push({
              orderId: (order._id as any).toString(),
              itemIndex,
              status: 'healthy',
              originalUrl: item.primaryImage?.url,
            });
            continue;
          }

          // Try fallback images
          let fallbackWorking = false;
          if (item.fallbackImages && item.fallbackImages.length > 0) {
            for (const fallback of item.fallbackImages) {
              if (await verifyImageHealth(fallback.url)) {
                // Promote fallback to primary
                const updatedItem = {
                  ...item,
                  primaryImage: fallback,
                  fallbackImages: item.fallbackImages.filter((f: { url: any; }) => f.url !== fallback.url),
                  imageMetadata: {
                    ...item.imageMetadata,
                    lastUpdated: new Date(),
                  }
                };

                updatedItems.push(updatedItem);
                orderUpdated = true;
                fallbackWorking = true;
                stats.fixedItems++;

                stats.results.push({
                  orderId: (order._id as any).toString(),
                  itemIndex,
                  status: 'fixed',
                  originalUrl: item.primaryImage?.url,
                  newUrl: fallback.url,
                });
                break;
              }
            }
          }

          // If no fallback worked, try to re-enrich
          if (!fallbackWorking) {
            console.log(`🔄 Re-enriching images for order ${(order._id as any).toString()}, item ${itemIndex}`);

            const imageData = await enrichOrderItemWithImages(
              item.productId?.toString() || '',
              item.color || 'default',
              item.productName || 'Unknown Product'
            );

            const updatedItem = {
              ...item,
              primaryImage: imageData.primaryImage,
              fallbackImages: imageData.fallbackImages,
              imageMetadata: imageData.imageMetadata,
              image: imageData.primaryImage.url, // Update legacy field
            };

            updatedItems.push(updatedItem);
            orderUpdated = true;
            stats.fixedItems++;

            stats.results.push({
              orderId: (order._id as any).toString(),
              itemIndex,
              status: 'fixed',
              originalUrl: item.primaryImage?.url || item.image,
              newUrl: imageData.primaryImage.url,
            });
          }

        } catch (error) {
          // Health check failed
          stats.failedItems++;
          updatedItems.push(item); // Keep original item

          const errorMessage = error instanceof Error ? error.message : String(error);

          stats.results.push({
            orderId: (order._id as any).toString(),
            itemIndex,
            status: 'failed',
            originalUrl: item.primaryImage?.url || item.image,
            error: errorMessage,
          });

          console.error(`❌ Health check failed for order ${(order._id as any).toString()}, item ${itemIndex}:`, error);
        }
      }

      // Update order if any items were modified
      if (orderUpdated) {
        await Order.findByIdAndUpdate(order._id as any, {
          items: updatedItems,
          'healthCheck.lastRun': new Date(),
        });
      }
    }

    console.log('✅ Image health check completed');
    console.log(`📊 Stats:`, {
      totalOrders: stats.totalOrdersChecked,
      totalItems: stats.totalItemsChecked,
      healthy: stats.healthyItems,
      fixed: stats.fixedItems,
      failed: stats.failedItems,
    });

    return stats;

  } catch (error) {
    console.error('💥 Image health check failed:', error);
    throw error;
  }
}

/**
 * Schedule automatic health checks
 */
export function scheduleHealthChecks() {
  // Run health check every 6 hours
  setInterval(async () => {
    try {
      console.log('🔄 Running scheduled image health check...');
      await runImageHealthCheck(1, 50); // Check last day, 50 orders
    } catch (error) {
      console.error('Scheduled health check failed:', error);
    }
  }, 6 * 60 * 60 * 1000); // 6 hours

  console.log('⏰ Image health checks scheduled every 6 hours');
}

/**
 * Get health statistics for monitoring dashboard
 */
export async function getImageHealthStats(): Promise<{
  recentIssues: number;
  totalHealthyOrders: number;
  lastCheckTime: Date | null;
}> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    const [recentOrdersWithIssues, totalOrdersChecked, lastCheckedOrder] = await Promise.all([
      Order.countDocuments({
        createdAt: { $gte: cutoffDate },
        $or: [
          { 'items.primaryImage.url': { $exists: false } },
          { 'items.primaryImage.url': '' },
          { 'items.fallbackImages': { $size: 0 } }
        ]
      }),
      Order.countDocuments({
        createdAt: { $gte: cutoffDate },
        'items.primaryImage.url': { $exists: true, $ne: '' }
      }),
      Order.findOne(
        { 'healthCheck.lastRun': { $exists: true } },
        {},
        { sort: { 'healthCheck.lastRun': -1 } }
      )
    ]);

    return {
      recentIssues: recentOrdersWithIssues,
      totalHealthyOrders: totalOrdersChecked,
      lastCheckTime: lastCheckedOrder?.healthCheck?.lastRun || null,
    };

  } catch (error) {
    console.error('Failed to get health stats:', error);
    return {
      recentIssues: 0,
      totalHealthyOrders: 0,
      lastCheckTime: null,
    };
  }
}

export default {
  runImageHealthCheck,
  scheduleHealthChecks,
  getImageHealthStats,
};