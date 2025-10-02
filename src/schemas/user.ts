import {z} from 'zod';
import { PasswordSchema } from '../utils/passwordValidation';

export const UserSchema = z.object({
  username: z.string().min(3, { message: "Username must be at least 3 characters long." })
  .max(20, { message: "Username cannot exceed 20 characters." })
  .regex(/^[a-zA-Z0-9_]+$/, { message: "Username can only contain letters, numbers, and underscores." }),

  email: z.string().email({ message: "Invalid email address." }),

  password: PasswordSchema,

  role: z.enum(["user", "admin"]).default("user"),
  consent: z.boolean().default(false),
})

export type UserInput = z.infer<typeof UserSchema>