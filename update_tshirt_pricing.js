const mongoose = require('mongoose');
require('dotenv').config();

// Import the actual TShirtStyle model
const TShirtStyleSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true,
    unique: true,
    index: true
  },
  description: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  basePrice: { 
    type: Number, 
    required: true,
    min: [1, 'Base price must be at least 1']
  },
  availableColors: [{
    name: { 
      type: String, 
      required: true,
      trim: true
    },
    hex: { 
      type: String, 
      required: true,
      match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Color must be a valid hex color code']
    },
    isAvailable: { 
      type: Boolean, 
      default: true 
    }
  }],
  availableSizes: [{
    size: { 
      type: String, 
      required: true,
      enum: ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']
    },
    isAvailable: { 
      type: Boolean, 
      default: true 
    },
    additionalCost: { 
      type: Number, 
      default: 0,
      min: [0, 'Additional cost cannot be negative']
    }
  }],
  images: {
    front: {
      type: String,
      required: [true, 'Front image URL is required']
    },
    back: {
      type: String,
      required: [true, 'Back image URL is required']
    },
    left: {
      type: String,
      required: [true, 'Left image URL is required']
    },
    right: {
      type: String,
      required: [true, 'Right image URL is required']
    }
  },
  printableAreas: {
    front: { 
      width: Number,
      height: Number,
      x: Number,
      y: Number
    },
    back: { 
      width: Number,
      height: Number,
      x: Number,
      y: Number
    },
    left: { 
      width: Number,
      height: Number,
      x: Number,
      y: Number
    },
    right: { 
      width: Number,
      height: Number,
      x: Number,
      y: Number
    }
  },
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, {
  timestamps: true
});

const TShirtStyle = mongoose.model('TShirtStyle', TShirtStyleSchema);

// Default colors for t-shirts
const defaultColors = [
  { name: "White", hex: "#FFFFFF", isAvailable: true },
  { name: "Black", hex: "#000000", isAvailable: true },
  { name: "Navy", hex: "#000080", isAvailable: true },
  { name: "Royal Blue", hex: "#4169E1", isAvailable: true },
  { name: "Red", hex: "#FF0000", isAvailable: true },
  { name: "Forest Green", hex: "#228B22", isAvailable: true },
  { name: "Purple", hex: "#800080", isAvailable: true },
  { name: "Orange", hex: "#FFA500", isAvailable: true },
  { name: "Yellow", hex: "#FFFF00", isAvailable: true },
  { name: "Pink", hex: "#FFC0CB", isAvailable: true },
  { name: "Gray", hex: "#808080", isAvailable: true },
  { name: "Light Blue", hex: "#ADD8E6", isAvailable: true }
];

// Default sizes for t-shirts
const defaultSizes = [
  { size: "S", isAvailable: true, additionalCost: 0 },
  { size: "M", isAvailable: true, additionalCost: 0 },
  { size: "L", isAvailable: true, additionalCost: 0 },
  { size: "XL", isAvailable: true, additionalCost: 0 },
  { size: "2XL", isAvailable: true, additionalCost: 50 },
  { size: "3XL", isAvailable: true, additionalCost: 100 }
];

// Default printable areas
const defaultPrintableAreas = {
  front: { width: 300, height: 400, x: 150, y: 100 },
  back: { width: 300, height: 400, x: 150, y: 100 },
  left: { width: 100, height: 150, x: 50, y: 200 },
  right: { width: 100, height: 150, x: 50, y: 200 }
};

async function updateTShirtPricing() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/design-studio');
    console.log('Connected to MongoDB');
    
    // Check if any t-shirt styles exist
    const existingStyles = await TShirtStyle.find({});
    console.log(`Found ${existingStyles.length} existing t-shirt styles`);
    
    if (existingStyles.length > 0) {
      console.log('Current styles:');
      existingStyles.forEach(s => console.log(`- ${s.name}: ₹${s.basePrice}`));
      
      // Update existing styles
      const updates = [
        { name: /Gildan Cotton/i, basePrice: 200 },
        { name: /Premium Cotton/i, basePrice: 250 },
        { name: /Vintage/i, basePrice: 300 }
      ];
      
      for (const update of updates) {
        const result = await TShirtStyle.updateMany(
          { name: update.name },
          { $set: { basePrice: update.basePrice } }
        );
        console.log(`Updated ${result.modifiedCount} styles matching ${update.name} to ₹${update.basePrice}`);
      }
    } else {
      console.log('No existing styles found. Creating new ones...');
      
      // Create new t-shirt styles with updated pricing
      const newStyles = [
        {
          name: "Gildan Cotton T-Shirt",
          description: "Seamless collar, taped neck and shoulders. Double-needle sleeve and bottom hems. Quarter-turned to eliminate center crease. Made from 100% cotton for comfort and durability.",
          basePrice: 200,
          availableColors: defaultColors,
          availableSizes: defaultSizes,
          images: {
            front: "https://via.placeholder.com/400x500/ffffff/000000?text=Front",
            back: "https://via.placeholder.com/400x500/ffffff/000000?text=Back",
            left: "https://via.placeholder.com/400x500/ffffff/000000?text=Left",
            right: "https://via.placeholder.com/400x500/ffffff/000000?text=Right"
          },
          printableAreas: defaultPrintableAreas,
          isActive: true
        },
        {
          name: "Premium Cotton T-Shirt",
          description: "Premium quality 100% cotton t-shirt with superior comfort and durability. Pre-shrunk fabric ensures consistent fit after washing.",
          basePrice: 250,
          availableColors: defaultColors,
          availableSizes: defaultSizes,
          images: {
            front: "https://via.placeholder.com/400x500/ffffff/000000?text=Premium+Front",
            back: "https://via.placeholder.com/400x500/ffffff/000000?text=Premium+Back",
            left: "https://via.placeholder.com/400x500/ffffff/000000?text=Premium+Left",
            right: "https://via.placeholder.com/400x500/ffffff/000000?text=Premium+Right"
          },
          printableAreas: defaultPrintableAreas,
          isActive: true
        },
        {
          name: "Vintage Wash T-Shirt",
          description: "Vintage-style t-shirt with a lived-in feel. Soft, comfortable fabric with a unique vintage wash finish that gets better with age.",
          basePrice: 300,
          availableColors: defaultColors.filter(c => ['White', 'Black', 'Gray', 'Navy'].includes(c.name)),
          availableSizes: defaultSizes,
          images: {
            front: "https://via.placeholder.com/400x500/ffffff/000000?text=Vintage+Front",
            back: "https://via.placeholder.com/400x500/ffffff/000000?text=Vintage+Back",
            left: "https://via.placeholder.com/400x500/ffffff/000000?text=Vintage+Left",
            right: "https://via.placeholder.com/400x500/ffffff/000000?text=Vintage+Right"
          },
          printableAreas: defaultPrintableAreas,
          isActive: true
        }
      ];
      
      await TShirtStyle.insertMany(newStyles);
      console.log('Created new t-shirt styles with updated pricing');
    }
    
    // Show final results
    const finalStyles = await TShirtStyle.find({});
    console.log('\nFinal t-shirt styles:');
    finalStyles.forEach(s => console.log(`- ${s.name}: ₹${s.basePrice}`));
    
  } catch (error) {
    console.error('Error updating t-shirt pricing:', error);
  } finally {
    mongoose.connection.close();
    console.log('Database connection closed');
  }
}

updateTShirtPricing();