import { z } from 'zod';

export const CategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  featured: z.boolean().default(false),
  parent: z.string().optional(),
  description: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  imageUrl: z.string().url("Invalid image URL format").optional(), // Add imageUrl field
})

export type Category = z.infer<typeof CategorySchema>;