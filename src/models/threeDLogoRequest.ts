import mongoose, { Document, Schema } from 'mongoose';

export interface IThreeDLogoRequest extends Document {
    fullName: string;
    email: string;
    phone: string;
    companyName?: string;
    quantity?: string;
    notes?: string;
    logoFile: string;
    submissionDate: Date;
    status: 'pending' | 'reviewed' | 'quoted' | 'rejected';
}

const threeDLogoRequestSchema = new Schema({
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
            validator: function (v: string) {
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
            validator: function (v: string) {
                return /^\+?[\d\s\-\(\)]+$/.test(v);
            },
            message: 'Invalid phone number format'
        }
    },
    companyName: {
        type: String,
        trim: true,
        maxlength: 200
    },
    quantity: {
        type: String,
        trim: true,
        maxlength: 100
    },
    notes: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    logoFile: {
        type: String, // File path or URL
        required: true
    },
    submissionDate: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['pending', 'reviewed', 'quoted', 'rejected'],
        default: 'pending'
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
threeDLogoRequestSchema.index({ email: 1 });
threeDLogoRequestSchema.index({ status: 1 });
threeDLogoRequestSchema.index({ submissionDate: -1 });

export default mongoose.model<IThreeDLogoRequest>('ThreeDLogoRequest', threeDLogoRequestSchema);
