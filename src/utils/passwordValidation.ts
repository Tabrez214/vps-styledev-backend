import { z } from 'zod';

/**
 * Centralized password validation schema
 * Requirements: 8+ chars, uppercase, lowercase, number, special character
 */
export const PasswordSchema = z.string()
  .min(8, "Password must be at least 8 characters long")
  .refine(
    (password) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]+$/.test(password),
    {
      message: "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*#?&).",
    }
  );

/**
 * Validate password and return detailed results
 */
export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const result = PasswordSchema.safeParse(password);
  return {
    isValid: result.success,
    errors: result.success ? [] : result.error.errors.map(e => e.message)
  };
};

/**
 * Get password requirements for frontend display
 */
export const getPasswordRequirements = () => {
  return [
    "At least 8 characters long",
    "At least one uppercase letter (A-Z)",
    "At least one lowercase letter (a-z)", 
    "At least one number (0-9)",
    "At least one special character (@$!%*#?&)"
  ];
};

/**
 * Check individual password requirements for frontend feedback
 */
export const checkPasswordRequirements = (password: string) => {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[@$!%*#?&]/.test(password)
  };
};