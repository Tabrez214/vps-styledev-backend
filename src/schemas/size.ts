import { z } from 'zod'
// Define size schema
export const SizeSchema = z.object({
  XS: z.number().min(0).default(0),
  S: z.number().min(0).default(0),
  M: z.number().min(0).default(0),
  L: z.number().min(0).default(0),
  XL: z.number().min(0).default(0),
  "2XL": z.number().min(0).default(0),
  "3XL": z.number().min(0).default(0),
});

export type Size = z.infer<typeof SizeSchema>;
