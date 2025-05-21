import {z} from 'zod';

export const UserSchema = z.object({
  username: z.string().min(3, { message: "Username must be at least 3 characters long." })
  .max(20, { message: "Username cannot exceed 20 characters." })
  .regex(/^[a-zA-Z0-9_]+$/, { message: "Username can only contain letters, numbers, and underscores." }),

  email: z.string().email({ message: "Invalid email address." }),

  password: z.string().min(8).refine((v) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]+$/.test(v),
  {
    message: "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.",
  }),

  role: z.enum(["user", "admin"]).default("user"),
  consent: z.boolean().default(false),
})

export type UserInput = z.infer<typeof UserSchema>