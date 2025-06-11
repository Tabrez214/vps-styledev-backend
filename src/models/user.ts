import mongoose, {Document, Schema} from "mongoose";
import bcrypt from 'bcrypt';

interface ActivityLog {
  action: string;
  route: string;
  timestamp: Date;
}

// The IUser Interface - Updated with additional profile fields
export interface IUser extends Document {
  _id: string; 
  username: string;
  email: string;
  password: string;
  role: 'user' | 'admin';
  name: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  isVerified: boolean;
  provider?: 'local' | 'google' | 'facebook';
  comparePassword(candidatePassword: string): Promise<Boolean>;
  consent: boolean;
  activityLog: ActivityLog[];
  newsletterSubscribed: boolean;
  avatar?: string;
  dateOfBirth?: Date;
  preferences?: {
    notifications: {
      email: boolean;
      sms: boolean;
      push: boolean;
    };
    privacy: {
      profileVisible: boolean;
      showEmail: boolean;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

//The Mongoose Schema - Updated with additional fields
const UserSchema: Schema = new Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true
  },
  password: { 
    type: String, 
    required: true,
    minlength: 6
  },
  role: { 
    type: String, 
    enum: ['user', 'admin'], 
    default: 'user' 
  },
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  phone: {
    type: String,
    trim: true,
    validate: {
      validator: function(v: string) {
        return !v || /^\+?[\d\s\-\(\)]+$/.test(v);
      },
      message: 'Invalid phone number format'
    }
  },
  address: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    country: { type: String, trim: true, default: 'India' }
  },
  isVerified: { 
    type: Boolean, 
    default: false 
  },
  provider: { 
    type: String, 
    enum: ['local', 'google', 'facebook'], 
    default: 'local' 
  },
  consent: { 
    type: Boolean, 
    default: false 
  },
  newsletterSubscribed: { 
    type: Boolean, 
    default: false 
  },
  avatar: {
    type: String, // URL to profile picture
    default: null
  },
  dateOfBirth: {
    type: Date
  },
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true }
    },
    privacy: {
      profileVisible: { type: Boolean, default: true },
      showEmail: { type: Boolean, default: false }
    }
  },
  activityLog: [{
    action: { type: String, required: true },
    route: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// Indexes for efficient queries
UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ isVerified: 1 });

//Hashing password before save
UserSchema.pre<IUser>('save', async function (next) {
  if(!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(12);
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

// Virtual for full address
UserSchema.virtual('fullAddress').get(function(this: IUser) {
  if (!this.address) return '';
  const { street, city, state, zipCode, country } = this.address;
  return [street, city, state, zipCode, country].filter(Boolean).join(', ');
});

// Method to get safe user data (without password)
UserSchema.methods.toSafeObject = function() {
  const userObj = this.toObject();
  delete userObj.password;
  return userObj;
};

export default mongoose.model<IUser>('User', UserSchema);