import { z } from 'zod';

export const WishlistSchema = z.object({
  user: z.string(),
  Products: z.string(),
  createdAt: z.date().optional(),
})

export type Wishlist = z.infer<typeof WishlistSchema>