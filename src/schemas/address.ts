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
  gstNumber: z.string().optional().refine(
    (val) => {
      // If empty or undefined, it's valid (optional field)
      if (!val || val.trim() === '') return true;
      
      // GSTIN Format: 2 digits + 5 letters + 4 digits + 1 letter + 2 alphanumeric + 1 alphanumeric (15 total)
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]{2}[A-Z0-9]$/;
      return gstRegex.test(val.toUpperCase());
    },
    {
      message: "Invalid GSTIN format. Must be 15 characters (e.g., 27AABCU9603R1ZX)"
    }
  ),
  isDefault: z.boolean().optional(),
  createdAt: z.date().optional(),
});

export default addressSchema;