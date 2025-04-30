import { z } from "zod";
import { ColorSchema } from "./color";

// Define main product schema
export const ProductSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().min(1, "Product description is required").transform((val) => {
    // Allow HTML content but sanitize it
    return val.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }),
  pricePerItem: z.number().positive("Price per item must be greater than 0"),
  minimumOrderQuantity: z.number().positive("Minimum order quantity must be greater than 0"),
  sizes: z.array(
    z.object({
      size: z.enum(["XS", "S", "M", "L", "XL", "2XL", "3XL"]),
      stock: z.number().nonnegative("Stock must be a non-negative number"),
    })
  ),
  colors: z.array(ColorSchema).nonempty("At least one color must be provided"),
  images: z.array(
    z.object({
      url: z.string().url("Invalid image URL format"),
      caption: z.string().optional(),
      isDefault: z.boolean().optional().default(false)
    })
  ).min(1, "At least one product image is required"),
  categories: z.array(z.string()).min(1, "At least one category is required"),
  isActive: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type Product = z.infer<typeof ProductSchema>;