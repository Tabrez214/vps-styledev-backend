import mongoose, { Document, Schema } from "mongoose";

export interface IWalletTransaction extends Document {
  _id: string;
  userId: mongoose.Types.ObjectId;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  reference?: string; // Order ID, refund ID, etc.
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export interface IWallet extends Document {
  _id: string;
  userId: mongoose.Types.ObjectId;
  balance: number;
  currency: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WalletTransactionSchema: Schema = new Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['credit', 'debit'], 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  description: { 
    type: String, 
    required: true,
    trim: true 
  },
  reference: { 
    type: String, 
    trim: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'completed', 'failed'], 
    default: 'completed' 
  }
}, {
  timestamps: true
});

const WalletSchema: Schema = new Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    unique: true 
  },
  balance: { 
    type: Number, 
    required: true,
    default: 0,
    min: 0 
  },
  currency: { 
    type: String, 
    required: true,
    default: 'INR',
    uppercase: true 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, {
  timestamps: true
});

// Indexes
WalletTransactionSchema.index({ userId: 1, createdAt: -1 });
WalletTransactionSchema.index({ status: 1 });
WalletSchema.index({ userId: 1 });

export const WalletTransaction = mongoose.model<IWalletTransaction>('WalletTransaction', WalletTransactionSchema);
export const Wallet = mongoose.model<IWallet>('Wallet', WalletSchema);