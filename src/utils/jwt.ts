// import jwt from 'jsonwebtoken';

// const generateToken = (userId: string) => {
//   return jwt.sign({ userId }, process.env.JWT_SECRET as string, {expiresIn: '7d' });
// };

// const verifyToken = (token: string) => {
//   return jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string };
// };

// export { generateToken, verifyToken };
import jwt from "jsonwebtoken";
import { IUser } from "../models/user";

interface TokenPayload {
  userId: string;
  role: string;
  consent: boolean;
}

export const generateToken = (user: IUser) => {
  return jwt.sign({ userId: user._id, role: user.role, consent: user.consent }, process.env.JWT_SECRET as string, {
    expiresIn: "24h",
  });
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, process.env.JWT_SECRET as string) as TokenPayload;
};
