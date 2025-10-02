/**
 * Standardized Types for System-wide Consistency
 * This file defines the canonical data structures used across the entire application
 */

// Standard Size Enum - Single source of truth
export const STANDARD_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"] as const;
export type StandardSize = typeof STANDARD_SIZES[number];

// Standard Address Interface
export interface StandardAddress {
  name: string;
  email?: string;
  phone?: string;
  street: string;              // Standardized field name
  city: string;
  state: string;
  zipCode: string;             // Standardized field name (not postalCode)
  country: string;
  gstNumber?: string;
}

// Customer Information Interface
export interface CustomerInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gstNumber?: string;
  purchaseOrderNumber?: string;
  billingAddress: StandardAddress;
  shippingAddress: StandardAddress;
  sameAsBilling: boolean;
}

// Standard Cart Item Interface
export interface StandardCartItem {
  productId: string;           // String for frontend, converted to ObjectId in backend
  product?: {                  // Optional populated product data
    name: string;
    images: string[];
  };
  color: string;
  size: StandardSize;
  quantity: number;
  pricePerItem: number;        // Standardized field name
  totalPrice: number;
  imageUrl?: string;           // Optional field for frontend display
}

// Standard Order Item Interface
export interface StandardOrderItem {
  productId?: string;          // For product orders
  product?: {                  // Optional populated product data
    _id: string;
    name: string;
    images?: string[];
  };
  designId?: string;           // For design orders
  quantity: number;
  pricePerItem: number;        // Standardized field name
  totalPrice: number;          // Calculated field
  color: string;               // Explicit color field
  size: StandardSize;          // Explicit size field
  designData?: any;            // For design order specific data
}

// Standard Invoice Item Interface
export interface StandardInvoiceItem {
  id: string;                  // Unique identifier
  description: string;
  size: StandardSize;
  color: string;
  customColor?: string;
  quantity: number;
  unitPrice: number;           // Same as pricePerItem
  total: number;               // Same as totalPrice
  image?: string;
  isDesignItem?: boolean;
  designData?: any;
}

// Address Field Mapping Utilities
export const mapAddressFields = {
  // Frontend to Backend mapping - Enhanced for Express Checkout compatibility
  frontendToBackend: (frontendAddress: any): StandardAddress => ({
    // Support multiple name field formats
    name: frontendAddress.name || 
          frontendAddress.fullName || 
          `${frontendAddress.firstName || ''} ${frontendAddress.lastName || ''}`.trim() ||
          'Unknown Name',
          
    email: frontendAddress.email,
    
    // Support multiple phone field formats  
    phone: frontendAddress.phone || 
           frontendAddress.phoneNumber || 
           frontendAddress.mobile,
           
    // Support multiple street address field formats
    street: frontendAddress.street || 
            frontendAddress.streetAddress || 
            frontendAddress.address || 
            frontendAddress.billingAddress ||
            frontendAddress.addressLine1 ||
            'Address not provided',
            
    // Support multiple city field formats
    city: frontendAddress.city || 
          frontendAddress.billingCity ||
          'City not provided',
          
    // Support multiple state field formats  
    state: frontendAddress.state || 
           frontendAddress.billingState ||
           'State not provided',
           
    // Support multiple postal code field formats
    zipCode: frontendAddress.zipCode || 
             frontendAddress.postalCode || 
             frontendAddress.billingPostalCode ||
             frontendAddress.pinCode ||
             '000000',
             
    // Support multiple country field formats
    country: frontendAddress.country || 
             frontendAddress.billingCountry || 
             'India',
             
    // Support multiple GST field formats
    gstNumber: frontendAddress.gstNumber || 
               frontendAddress.customerGstNumber ||
               frontendAddress.gstin
  }),

  // Backend to Frontend mapping
  backendToFrontend: (backendAddress: StandardAddress) => ({
    name: backendAddress.name,
    email: backendAddress.email,
    phone: backendAddress.phone,
    street: backendAddress.street,
    city: backendAddress.city,
    state: backendAddress.state,
    zipCode: backendAddress.zipCode,
    country: backendAddress.country,
    gstNumber: backendAddress.gstNumber
  })
};

// Price Field Mapping Utilities
export const mapPriceFields = {
  // Ensure consistent price field naming
  standardizeCartItem: (item: any): StandardCartItem => ({
    productId: item.productId || item.product?._id || item.product,
    product: item.product,
    color: item.color,
    size: item.size as StandardSize,
    quantity: item.quantity,
    pricePerItem: item.pricePerItem || item.price || item.unitPrice,
    totalPrice: item.totalPrice || item.total || (item.quantity * (item.pricePerItem || item.price || item.unitPrice)),
    imageUrl: item.imageUrl || item.image
  }),

  // Standardize order item
  standardizeOrderItem: (item: any): StandardOrderItem => ({
    productId: item.productId,
    product: item.product,
    designId: item.designId,
    quantity: item.quantity,
    pricePerItem: item.pricePerItem || item.price || item.unitPrice,
    totalPrice: item.totalPrice || item.total || (item.quantity * (item.pricePerItem || item.price || item.unitPrice)),
    color: item.color,
    size: item.size as StandardSize,
    designData: item.designData
  }),

  // Standardize invoice item
  standardizeInvoiceItem: (item: any): StandardInvoiceItem => ({
    id: item.id || item._id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: item.description || item.product?.name || 'Custom Item',
    size: item.size as StandardSize,
    color: item.color,
    customColor: item.customColor,
    quantity: item.quantity,
    unitPrice: item.unitPrice || item.pricePerItem || item.price,
    total: item.total || item.totalPrice || (item.quantity * (item.unitPrice || item.pricePerItem || item.price)),
    image: item.image || item.imageUrl,
    isDesignItem: item.isDesignItem || !!item.designData,
    designData: item.designData
  })
};

// Validation utilities
export const validateStandardTypes = {
  isValidSize: (size: string): size is StandardSize => {
    return STANDARD_SIZES.includes(size as StandardSize);
  },

  isValidAddress: (address: any): address is StandardAddress => {
    return address && 
           typeof address.name === 'string' &&
           typeof address.street === 'string' &&
           typeof address.city === 'string' &&
           typeof address.state === 'string' &&
           typeof address.zipCode === 'string' &&
           typeof address.country === 'string';
  },

  isValidCartItem: (item: any): boolean => {
    return item &&
           typeof item.productId === 'string' &&
           typeof item.color === 'string' &&
           validateStandardTypes.isValidSize(item.size) &&
           typeof item.quantity === 'number' &&
           typeof item.pricePerItem === 'number';
  }
};