import address from 'models/address';
import { z } from 'zod';

export const OrderSchema = z.object({
  user: z.string(),  // Expecting a string (userId)
  products: z.array(
    z.object({ 
      product: z.string(), 
      size: z.string(),
      quantity: z.number().min(1) 
    })
  ),
  totalAmount: z.number(),
  status: z.enum(["Pending", "Shipping", "Delivered"]).default("Pending"),
  paymentStatus: z.enum(["Pending", "Success", "Failed"]).default("Pending"),
  address: z.string(), // Expecting a string (addressId)
});


export type Order = z.infer<typeof OrderSchema>;
