/**
 * Week 1 Migration Script - Data Standardization
 * 
 * This script migrates existing data to use the new standardized types and field names.
 * Run this after deploying the Week 1 changes to ensure data consistency.
 * 
 * Usage: npm run migration:week1
 */

import mongoose from 'mongoose';
import Cart from '../models/cart';
import Order from '../models/order';
import { Invoice } from '../models/invoiceGenerator';
import Product from '../models/product';
import { STANDARD_SIZES } from '../types/standardTypes';

interface MigrationResult {
  success: boolean;
  message: string;
  count?: number;
  errors?: string[];
}

class Week1Migration {
  private errors: string[] = [];

  async run(): Promise<void> {
    console.log('🚀 Starting Week 1 Data Standardization Migration...\n');

    try {
      // Connect to MongoDB if not already connected
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-db');
        console.log('✅ Connected to MongoDB');
      }

      // Run migrations in order
      const migrations = [
        { name: 'Cart Items', fn: this.migrateCartItems.bind(this) },
        { name: 'Order Items', fn: this.migrateOrderItems.bind(this) },
        { name: 'Order Addresses', fn: this.migrateOrderAddresses.bind(this) },
        { name: 'Invoice Items', fn: this.migrateInvoiceItems.bind(this) },
        { name: 'Size Enums', fn: this.migrateSizeEnums.bind(this) }
      ];

      for (const migration of migrations) {
        console.log(`\n📦 Migrating ${migration.name}...`);
        const result = await migration.fn();
        this.logResult(migration.name, result);
      }

      // Summary
      console.log('\n📊 Migration Summary:');
      if (this.errors.length === 0) {
        console.log('✅ All migrations completed successfully!');
      } else {
        console.log(`❌ Migration completed with ${this.errors.length} errors:`);
        this.errors.forEach(error => console.log(`   - ${error}`));
      }

    } catch (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }
  }

  /**
   * Migrate cart items to include productName and imageUrl fields
   */
  private async migrateCartItems(): Promise<MigrationResult> {
    try {
      const carts = await Cart.find({}).populate('products.product');
      let updatedCount = 0;

      for (const cart of carts) {
        let needsUpdate = false;
        
        for (const item of cart.products) {
          // Add productName if missing
          if (!item.productName && item.product) {
            item.productName = (item.product as any).name || 'Unknown Product';
            needsUpdate = true;
          }

          // Add imageUrl if missing
          if (!item.imageUrl && item.product) {
            const product = item.product as any;
            if (product.images && product.images.length > 0) {
              item.imageUrl = product.images[0].url;
            } else if (product.colors && product.colors.length > 0 && product.colors[0].images) {
              item.imageUrl = product.colors[0].images[0]?.url || '';
            } else {
              item.imageUrl = '/tshirt-front.jpg'; // Default fallback
            }
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          await cart.save();
          updatedCount++;
        }
      }

      return {
        success: true,
        message: `Updated ${updatedCount} cart records`,
        count: updatedCount
      };

    } catch (error) {
      const errorMsg = `Cart migration failed: ${error}`;
      this.errors.push(errorMsg);
      return { success: false, message: errorMsg };
    }
  }

  /**
   * Migrate order items to use standardized field names
   */
  private async migrateOrderItems(): Promise<MigrationResult> {
    try {
      const orders = await Order.find({});
      let updatedCount = 0;

      for (const order of orders) {
        let needsUpdate = false;

        for (const item of order.items) {
          // Migrate 'price' field to 'pricePerItem'
          if ((item as any).price && !item.pricePerItem) {
            item.pricePerItem = (item as any).price;
            delete (item as any).price;
            needsUpdate = true;
          }

          // Add totalPrice if missing
          if (!item.totalPrice && item.pricePerItem && item.quantity) {
            item.totalPrice = item.pricePerItem * item.quantity;
            needsUpdate = true;
          }

          // Add default color if missing
          if (!item.color) {
            item.color = 'Default';
            needsUpdate = true;
          }

          // Add default size if missing
          if (!item.size) {
            item.size = 'M' as any; // Default to Medium
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          await order.save();
          updatedCount++;
        }
      }

      return {
        success: true,
        message: `Updated ${updatedCount} order records`,
        count: updatedCount
      };

    } catch (error) {
      const errorMsg = `Order items migration failed: ${error}`;
      this.errors.push(errorMsg);
      return { success: false, message: errorMsg };
    }
  }

  /**
   * Migrate order addresses to standardized format
   */
  private async migrateOrderAddresses(): Promise<MigrationResult> {
    try {
      const orders = await Order.find({});
      let updatedCount = 0;

      for (const order of orders) {
        let needsUpdate = false;

        // Standardize main address
        if (order.address && typeof order.address === 'object') {
          const addr = order.address as any;
          
          // Convert postalCode to zipCode
          if (addr.postalCode && !addr.zipCode) {
            addr.zipCode = addr.postalCode;
            delete addr.postalCode;
            needsUpdate = true;
          }

          // Convert streetAddress to street
          if (addr.streetAddress && !addr.street) {
            addr.street = addr.streetAddress;
            delete addr.streetAddress;
            needsUpdate = true;
          }

          // Ensure required fields have defaults
          if (!addr.name && (addr.firstName || addr.lastName)) {
            addr.name = `${addr.firstName || ''} ${addr.lastName || ''}`.trim();
            needsUpdate = true;
          }
        }

        // Standardize billing address
        if (order.billingAddress) {
          const billing = order.billingAddress as any;
          
          // Same standardization for billing address
          if (billing.postalCode && !billing.zipCode) {
            billing.zipCode = billing.postalCode;
            delete billing.postalCode;
            needsUpdate = true;
          }

          if (billing.streetAddress && !billing.street) {
            billing.street = billing.streetAddress;
            delete billing.streetAddress;
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          await order.save();
          updatedCount++;
        }
      }

      return {
        success: true,
        message: `Updated ${updatedCount} order address records`,
        count: updatedCount
      };

    } catch (error) {
      const errorMsg = `Order address migration failed: ${error}`;
      this.errors.push(errorMsg);
      return { success: false, message: errorMsg };
    }
  }

  /**
   * Migrate invoice items to include id field and standardize structure
   */
  private async migrateInvoiceItems(): Promise<MigrationResult> {
    try {
      const invoices = await Invoice.find({});
      let updatedCount = 0;

      for (const invoice of invoices) {
        let needsUpdate = false;

        for (const item of invoice.items) {
          // Add id field if missing
          if (!item.id) {
            item.id = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            needsUpdate = true;
          }

          // Add isDesignItem field if missing
          if (item.isDesignItem === undefined) {
            item.isDesignItem = !!item.designData;
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          await invoice.save();
          updatedCount++;
        }
      }

      return {
        success: true,
        message: `Updated ${updatedCount} invoice records`,
        count: updatedCount
      };

    } catch (error) {
      const errorMsg = `Invoice migration failed: ${error}`;
      this.errors.push(errorMsg);
      return { success: false, message: errorMsg };
    }
  }

  /**
   * Migrate size enums to standard format
   */
  private async migrateSizeEnums(): Promise<MigrationResult> {
    try {
      const sizeMapping: { [key: string]: string } = {
        'XXL': '2XL',
        'XXXL': '3XL'
      };

      let totalUpdated = 0;

      // Update cart items
      const carts = await Cart.find({});
      for (const cart of carts) {
        let needsUpdate = false;
        for (const item of cart.products) {
          if (sizeMapping[item.size]) {
            item.size = sizeMapping[item.size] as any;
            needsUpdate = true;
          }
        }
        if (needsUpdate) {
          await cart.save();
          totalUpdated++;
        }
      }

      // Update order items
      const orders = await Order.find({});
      for (const order of orders) {
        let needsUpdate = false;
        for (const item of order.items) {
          if (item.size && sizeMapping[item.size]) {
            item.size = sizeMapping[item.size] as any;
            needsUpdate = true;
          }
        }
        if (needsUpdate) {
          await order.save();
          totalUpdated++;
        }
      }

      // Update invoice items
      const invoices = await Invoice.find({});
      for (const invoice of invoices) {
        let needsUpdate = false;
        for (const item of invoice.items) {
          if (sizeMapping[item.size]) {
            item.size = sizeMapping[item.size] as any;
            needsUpdate = true;
          }
        }
        if (needsUpdate) {
          await invoice.save();
          totalUpdated++;
        }
      }

      return {
        success: true,
        message: `Updated size enums in ${totalUpdated} records`,
        count: totalUpdated
      };

    } catch (error) {
      const errorMsg = `Size enum migration failed: ${error}`;
      this.errors.push(errorMsg);
      return { success: false, message: errorMsg };
    }
  }

  private logResult(migrationName: string, result: MigrationResult): void {
    if (result.success) {
      console.log(`   ✅ ${result.message}`);
    } else {
      console.log(`   ❌ ${result.message}`);
    }
  }
}

// Script execution
async function runMigration() {
  const migration = new Week1Migration();
  await migration.run();
  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  runMigration().catch(error => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
}

export default Week1Migration;