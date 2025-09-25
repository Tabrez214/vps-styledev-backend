import { z } from "zod";

const addressSchema = z.object({
  user: z.string().nonempty("User ID is required"),
  fullName: z.string().nonempty("Full name is required"),
  phoneNumber: z.string().nonempty("Phone number is required"),
  streetAddress: z.string().nonempty("Street address is required"),
  city: z.string().nonempty("City is required"),
  state: z.string().nonempty("State is required"),
  country: z.string().nonempty("Country is required"),
  postalCode: z.string().nonempty("Postal code is required"),
  gstNumber: z.string().optional(),
  isDefault: z.boolean().optional(),
  createdAt: z.date().optional(),
});

export default addressSchema;