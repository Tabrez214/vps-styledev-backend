import { z } from "zod";
import { ColorSchema } from "./color";

// Define bulk pricing schema
export const BulkPricingSchema = z.object({
  quantity: z.number().positive("Quantity must be greater than 0"),
  pricePerItem: z.union([
    z.number().positive("Price per item must be greater than 0"),
    z.string().min(1, "Price per item is required").transform((val) => {
      const num = parseFloat(val);
      if (isNaN(num) || num <= 0) {
        throw new Error("Price per item must be a valid positive number");
      }
      return num;
    })
  ]),
});

// Define main product schema
export const ProductSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  shortDescription: z.string()
    .min(1, "Short description is required")
    .max(300, "Short description must be less than 300 characters")
    .transform((val) => {
      // Allow HTML content but sanitize it
      return val.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }),
  description: z.string()
    .min(1, "Product description is required")
    .transform((val) => {
      // Allow HTML content but sanitize it
      return val.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }),
  pricePerItem: z.number().positive("Price per item must be greater than 0"),
  minimumOrderQuantity: z.number().positive("Minimum order quantity must be greater than 0"),
  stock: z.number().nonnegative("Stock must be a non-negative number"),
  sizes: z.array(
    z.object({
      size: z.enum(["XS", "S", "M", "L", "XL", "2XL", "3XL"]),
      stock: z.number().nonnegative("Stock must be a non-negative number"),
    })
  ),
  colors: z.array(ColorSchema).nonempty("At least one color must be provided"),
  images: z.array(
    z.object({
      url: z.string().min(1, "Image URL is required"),
      caption: z.string().optional(),
      isDefault: z.boolean().optional().default(false),
      imageAlt: z.string().optional(),
    })
  ).optional().default([]),
  categories: z.array(z.string()).optional().default([]),
  isActive: z.boolean().default(true),
  bulkPricing: z.array(BulkPricingSchema).optional().default([]),
  rushOrderAvailable: z.boolean().default(false),
  superRushAvailable: z.boolean().default(false),
  rushOrderDays: z.number().positive("Rush order days must be greater than 0").default(10),
  superRushOrderDays: z.number().positive("Super rush order days must be greater than 0").default(3),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type BulkPricing = z.infer<typeof BulkPricingSchema>;
export type Product = z.infer<typeof ProductSchema>;