import { z } from 'zod'

// Define color image schema
export const ColorImageSchema = z.object({
  url: z.string().min(1, "Image URL is required"),
  caption: z.string().optional(),
  isDefault: z.boolean().optional().default(false),
  imageAlt: z.string().optional(),
});

// Define color schema
export const ColorSchema = z.object({
  name: z.string().min(1, "Color name is required"),
  hexCode: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color format"), // Hex color validation
  images: z.array(ColorImageSchema).optional().default([]),
});

export type ColorImage = z.infer<typeof ColorImageSchema>
export type Color = z.infer<typeof ColorSchema>