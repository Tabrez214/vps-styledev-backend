import mongoose, {Document, Schema} from "mongoose";
import bcrypt from 'bcrypt';

// The IUser Interface
export interface IUser extends Document {
  _id: string; 
  username: string;
  email: string;
  password: string;
  role: 'user' | 'admin';
  name: string;
  isVerified: boolean;
  provider?: 'local' | 'google' | 'facebook';
  comparePassword(candidatePassword: string): Promise<Boolean>;
}

//The Mongoose Schema
const UserSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true},
  password: { type: String, required: true},
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  name: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  provider: { type: String, enum: ['local', 'google', 'facebook'], default: 'local' }
});

//Hashing password before save
UserSchema.pre<IUser>('save', async function (next) {
  if(!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(this.password, salt);
    this.password = hash;
    next();
  } catch (error) {
    next(error as Error);
  }
});

//Comparing password
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<Boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
};

export default mongoose.model<IUser>('User', UserSchema);
