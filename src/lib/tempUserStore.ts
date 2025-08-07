// tempUserStore.ts
interface TempUser {
  username: string;
  email: string;
  password: string;
  role: string;
  name: string;
  timestamp: number;
}

export const tempUserStore = new Map<string, TempUser>();

// Clean up expired temp users (older than 15 minutes)
export const cleanupExpiredTempUsers = () => {
  const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
  for (const [email, userData] of tempUserStore.entries()) {
    if (userData.timestamp < fifteenMinutesAgo) {
      tempUserStore.delete(email);
    }
  }
};

// Auto cleanup every 5 minutes
setInterval(cleanupExpiredTempUsers, 5 * 60 * 1000);
