import mongoose, { Document, Schema } from 'mongoose';

export interface IDesignSubmission extends Document {
  fullName: string;
  email: string;
  phone: string;
  collegeName: string;
  instagram?: string;
  designFile: string;
  designTitle: string;
  inspiration?: string;
  internshipInterest: 'yes' | 'no';
  hearAbout: 'instagram' | 'whatsapp' | 'college' | 'friend' | 'poster' | 'other';
  submissionDate: Date;
  status: 'pending' | 'reviewed' | 'selected' | 'rejected';
}

const designSubmissionSchema = new Schema({
  fullName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v: string) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Invalid email format'
    }
  },
  phone: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v: string) {
        return /^\+?[\d\s\-\(\)]+$/.test(v);
      },
      message: 'Invalid phone number format'
    }
  },
  collegeName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  instagram: {
    type: String,
    trim: true,
    maxlength: 100
  },
  designFile: {
    type: String, // File path or URL
    required: true
  },
  designTitle: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  inspiration: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  internshipInterest: {
    type: String,
    enum: ['yes', 'no'],
    required: true
  },
  hearAbout: {
    type: String,
    enum: ['instagram', 'whatsapp', 'college', 'friend', 'poster', 'other'],
    required: true
  },
  submissionDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'selected', 'rejected'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
designSubmissionSchema.index({ email: 1 });
designSubmissionSchema.index({ status: 1 });
designSubmissionSchema.index({ submissionDate: -1 });
designSubmissionSchema.index({ collegeName: 1 });

export default mongoose.model<IDesignSubmission>('DesignSubmission', designSubmissionSchema);