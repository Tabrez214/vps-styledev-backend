import { z } from 'zod';

export const CartSchema = z.object({
  user: z.string(),
  products: z.array(
    z.object({
      product: z.string(),
      size: z.enum(["XS", "S", "M", "L", "XL", "2XL", "3XL"]),
      quantity: z.number().min(1, "Quantity must be at least 1"),
      pricePerItem: z.number().positive("Price per item must be positive"),
      totalPrice: z.number().positive("Total price must be positive")
    })
  ),
  totalAmount: z.number().min(0).default(0),
})

export type Cart = z.infer<typeof CartSchema>