// Test script to verify the complete order image solution
import mongoose from 'mongoose';
import Order from '../models/order';
import Product from '../models/product';
import { enrichOrderItemWithImages } from '../services/imageEnrichmentService';
import { runImageHealthCheck } from '../services/imageHealthService';
import config from '../config/config';

interface TestResult {
  testName: string;
  success: boolean;
  message: string;
  details?: any;
}

class OrderImageSolutionTester {
  private results: TestResult[] = [];

  private addResult(testName: string, success: boolean, message: string, details?: any) {
    this.results.push({ testName, success, message, details });
    const status = success ? '✅' : '❌';
    console.log(`${status} ${testName}: ${message}`);
    if (details) {
      console.log('   Details:', details);
    }
  }

  async connectToDatabase(): Promise<void> {
    try {
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(config.DB_URI);
        console.log('🔗 Connected to MongoDB for testing');
      }
    } catch (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  async testImageEnrichmentService(): Promise<void> {
    console.log('\n🧪 Testing Image Enrichment Service...');

    try {
      // Test 1: Get a sample product for testing
      const sampleProduct = await Product.findOne({
        colors: { $exists: true, $ne: [] }
      }).lean();

      if (!sampleProduct) {
        this.addResult(
          'Sample Product Test',
          false,
          'No products with colors found in database'
        );
        return;
      }

      this.addResult(
        'Sample Product Test',
        true,
        `Found test product: ${sampleProduct.name}`,
        { productId: sampleProduct._id, colorsCount: sampleProduct.colors?.length }
      );

      // Test 2: Test image enrichment with valid product
      const testColor = sampleProduct.colors?.[0]?.name || 'default';
      const enrichmentResult = await enrichOrderItemWithImages(
        sampleProduct._id.toString(),
        testColor,
        sampleProduct.name
      );

      this.addResult(
        'Image Enrichment Test',
        !!enrichmentResult.primaryImage.url,
        'Image enrichment completed',
        {
          primaryImageUrl: enrichmentResult.primaryImage.url,
          fallbackImagesCount: enrichmentResult.fallbackImages.length,
          metadata: enrichmentResult.imageMetadata
        }
      );

      // Test 3: Test with invalid product ID
      try {
        const invalidResult = await enrichOrderItemWithImages(
          '000000000000000000000000',
          'red',
          'Test Product'
        );

        this.addResult(
          'Invalid Product Test',
          invalidResult.primaryImage.url.includes('placeholder'),
          'Correctly handled invalid product ID with placeholder',
          { placeholderUrl: invalidResult.primaryImage.url }
        );
      } catch (error) {
        this.addResult(
          'Invalid Product Test',
          false,
          `Error handling invalid product: ${error.message}`
        );
      }

    } catch (error) {
      this.addResult(
        'Image Enrichment Service Test',
        false,
        `Test failed: ${error.message}`
      );
    }
  }

  async testOrderCreation(): Promise<void> {
    console.log('\n🧪 Testing Enhanced Order Creation...');

    try {
      // Get a sample product
      const sampleProduct = await Product.findOne().lean();
      if (!sampleProduct) {
        this.addResult(
          'Order Creation Test',
          false,
          'No products found for testing order creation'
        );
        return;
      }

      // Create a test order with enhanced image structure
      const testOrderData = {
        name: `Test-Order-${Date.now()}`,
        user: new mongoose.Types.ObjectId(),
        order_id: `test_${Date.now()}`,
        subtotal: 100,
        amount: 100,
        totalAmount: 100,
        address: new mongoose.Types.ObjectId(),
        items: [{
          productId: sampleProduct._id,
          productName: sampleProduct.name,
          quantity: 1,
          pricePerItem: 100,
          totalPrice: 100,
          size: 'M',
          color: 'red',
          primaryImage: {
            url: 'https://example.com/test-image.jpg',
            alt: 'Test image',
            imageId: 'test123'
          },
          fallbackImages: [{
            url: 'https://example.com/fallback-image.jpg',
            alt: 'Fallback image',
            imageId: 'fallback123'
          }],
          imageMetadata: {
            colorId: 'color123',
            totalImagesAvailable: 2,
            lastUpdated: new Date()
          },
          image: 'https://example.com/test-image.jpg'
        }],
        status: 'pending'
      };

      const testOrder = new Order(testOrderData);
      await testOrder.save();

      this.addResult(
        'Enhanced Order Creation',
        true,
        'Successfully created order with enhanced image structure',
        { orderId: testOrder._id, itemsCount: testOrder.items.length }
      );

      // Clean up test order
      await Order.findByIdAndDelete(testOrder._id);

    } catch (error) {
      this.addResult(
        'Order Creation Test',
        false,
        `Order creation failed: ${error.message}`
      );
    }
  }

  async testImageHealthCheck(): Promise<void> {
    console.log('\n🧪 Testing Image Health Check Service...');

    try {
      // Run a small health check
      const healthResult = await runImageHealthCheck(1, 5); // Check last day, 5 orders max

      this.addResult(
        'Image Health Check',
        true,
        'Health check completed successfully',
        {
          ordersChecked: healthResult.totalOrdersChecked,
          itemsChecked: healthResult.totalItemsChecked,
          healthyItems: healthResult.healthyItems,
          fixedItems: healthResult.fixedItems,
          failedItems: healthResult.failedItems
        }
      );

    } catch (error) {
      this.addResult(
        'Image Health Check',
        false,
        `Health check failed: ${error.message}`
      );
    }
  }

  async testBackwardCompatibility(): Promise<void> {
    console.log('\n🧪 Testing Backward Compatibility...');

    try {
      // Find orders with legacy structure
      const legacyOrder = await Order.findOne({
        'items.primaryImage': { $exists: false },
        'items.0': { $exists: true }
      }).lean();

      if (legacyOrder) {
        this.addResult(
          'Legacy Order Detection',
          true,
          'Found orders with legacy structure',
          { orderId: legacyOrder._id, itemsCount: legacyOrder.items.length }
        );

        // Test reading legacy order items
        const legacyItem = legacyOrder.items[0];
        const hasLegacyFields = legacyItem.productId && legacyItem.quantity;

        this.addResult(
          'Legacy Order Reading',
          hasLegacyFields,
          'Legacy order structure is readable',
          { hasProductId: !!legacyItem.productId, hasQuantity: !!legacyItem.quantity }
        );
      } else {
        this.addResult(
          'Legacy Order Detection',
          true,
          'No legacy orders found (all orders are enhanced)',
          { message: 'This is expected after migration' }
        );
      }

    } catch (error) {
      this.addResult(
        'Backward Compatibility Test',
        false,
        `Compatibility test failed: ${error.message}`
      );
    }
  }

  async testImageUrlResolution(): Promise<void> {
    console.log('\n🧪 Testing Image URL Resolution...');

    try {
      // Test different URL formats
      const testUrls = [
        'https://example.com/image.jpg',
        '/api/images/image.jpg',
        'images/image.jpg',
        '',
        null,
        undefined
      ];

      for (const url of testUrls) {
        try {
          // Import the normalize function (would need to adjust path in real implementation)
          const { normalizeImageUrl } = require('../utils/image');
          const normalized = normalizeImageUrl(url);
          
          this.addResult(
            `URL Normalization - ${url || 'empty'}`,
            typeof normalized === 'string',
            `Normalized to: ${normalized}`
          );
        } catch (error) {
          this.addResult(
            `URL Normalization - ${url || 'empty'}`,
            false,
            `Failed to normalize: ${error.message}`
          );
        }
      }

    } catch (error) {
      this.addResult(
        'Image URL Resolution Test',
        false,
        `URL resolution test failed: ${error.message}`
      );
    }
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Order Image Solution Tests...\n');

    try {
      await this.connectToDatabase();
      await this.testImageEnrichmentService();
      await this.testOrderCreation();
      await this.testImageHealthCheck();
      await this.testBackwardCompatibility();
      await this.testImageUrlResolution();

      // Summary
      console.log('\n📊 Test Summary:');
      const passedTests = this.results.filter(r => r.success).length;
      const totalTests = this.results.length;
      const passRate = ((passedTests / totalTests) * 100).toFixed(1);

      console.log(`✅ Passed: ${passedTests}/${totalTests} (${passRate}%)`);
      console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`);

      if (passedTests === totalTests) {
        console.log('\n🎉 All tests passed! The order image solution is working correctly.');
      } else {
        console.log('\n⚠️ Some tests failed. Please review the issues above.');
        
        // List failed tests
        console.log('\nFailed tests:');
        this.results.filter(r => !r.success).forEach(result => {
          console.log(`  - ${result.testName}: ${result.message}`);
        });
      }

    } catch (error) {
      console.error('💥 Test suite failed:', error);
    } finally {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
      }
    }
  }
}

// CLI execution
if (require.main === module) {
  const tester = new OrderImageSolutionTester();
  tester.runAllTests()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export default OrderImageSolutionTester;