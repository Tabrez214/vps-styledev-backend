import mongoose from 'mongoose';

const ContactFormSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    validate: {
      validator: function(name) {
        return !/\d/.test(name); // Check that name doesn't contain numbers
      },
      message: 'Name should not contain numbers'
    }
  },
  mobile: {
    type: String, // Changed from Number to String to handle formatting
    required: [true, 'Mobile number is required'],
    trim: true,
    validate: {
      validator: function(mobile) {
        // Remove formatting characters and check if it's numeric and at least 10 digits
        const cleanMobile = mobile.replace(/[\s\-\+\(\)]/g, '');
        return /^\d+$/.test(cleanMobile) && cleanMobile.length >= 10;
      },
      message: 'Mobile number should be at least 10 digits and contain only numbers'
    }
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address']
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  subscribedAt: {
    type: Date,
    default: Date.now
  },
  source: {
    type: String,
    default: 'popup'
  },
  isSubscribed: {
    type: Boolean,
    default: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
});

export default mongoose.models.ContactForm || mongoose.model('ContactForm', ContactFormSchema);