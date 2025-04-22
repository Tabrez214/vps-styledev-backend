// In production, use Redis or similar for OTP storage
const otpStore = new Map<string, { otp: string; expires: number }>();

export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const storeOTP = (email: string, otp: string): void => {
  const expires = Date.now() + 10 * 60 * 1000; // 10 minutes
  otpStore.set(email, { otp, expires });
};

export const verifyOTP = (email: string, otp: string): boolean => {
  const stored = otpStore.get(email);
  if (!stored) return false;
  
  if (stored.expires < Date.now()) {
    otpStore.delete(email);
    return false;
  }
  
  const isValid = stored.otp === otp;
  if (isValid) {
    otpStore.delete(email);
  }
  return isValid;
};

export const clearExpiredOTPs = (): void => {
  const now = Date.now();
  for (const [email, { expires }] of otpStore.entries()) {
    if (expires < now) {
      otpStore.delete(email);
    }
  }
}; 