import { z } from "zod";

// Review creation schema
export const CreateReviewSchema = z.object({
  rating: z.number()
    .min(1, "Rating must be at least 1")
    .max(5, "Rating must be at most 5"),
  title: z.string()
    .min(1, "Title is required")
    .max(100, "Title must be less than 100 characters")
    .trim(),
  comment: z.string()
    .min(10, "Comment must be at least 10 characters")
    .max(1000, "Comment must be less than 1000 characters")
    .trim(),
  images: z.array(z.string().url("Invalid image URL")).optional().default([])
});

// Review query schema for filtering
export const ReviewQuerySchema = z.object({
  sortBy: z.enum(['newest', 'oldest', 'highest', 'lowest', 'helpful']).default('newest'),
  rating: z.string().transform(val => parseInt(val)).pipe(z.number().min(1).max(5)).optional(),
  verified: z.string().transform(val => val === 'true').optional(),
  page: z.string().transform(val => parseInt(val)).pipe(z.number().min(1)).default('1'),
  limit: z.string().transform(val => parseInt(val)).pipe(z.number().min(1).max(50)).default('10')
});

export type CreateReview = z.infer<typeof CreateReviewSchema>;
export type ReviewQuery = z.infer<typeof ReviewQuerySchema>;