import { z } from 'zod'

// Define color schema
export const ColorSchema = z.object({
  name: z.string(),
  hexCode: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/), // Hex color validation
});

export type Color = z.infer<typeof ColorSchema>