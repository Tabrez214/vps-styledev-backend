import { IOrder } from '../models/order';
import { IInvoice, IInvoiceItem } from '../models/invoiceGenerator';
import { StandardOrderItem, StandardInvoiceItem, mapPriceFields } from '../types/standardTypes';
import mongoose from 'mongoose';

/**
 * Unified Order to Invoice Data Mapper
 * This ensures consistent data transformation between orders and invoices
 */

export interface OrderItemWithProduct {
  productId?: {
    _id: string;
    name: string;
    images?: string[];
  };
  designId?: string;
  quantity: number;
  price?: number;           // Legacy field - kept for backward compatibility
  pricePerItem?: number;    // New standardized field
  totalPrice?: number;      // New standardized field
  color?: string;           // New explicit field
  size?: string;            // New explicit field
  sizes?: any;              // Legacy field for design orders
  designData?: any;
}

export interface PopulatedOrder extends Omit<IOrder, 'items' | 'user' | 'address'> {
  items: OrderItemWithProduct[];
  user: {
    _id: string;
    name: string;
    email: string;
  };
  address: {
    name?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    phoneNumber?: string;
    street?: string;
    streetAddress?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    postalCode?: string;
    country?: string;
    gstNumber?: string;
  } | string;
}

/**
 * Maps order data to standardized invoice format
 */
export function mapOrderToInvoice(order: PopulatedOrder): Partial<IInvoice> {
  // Extract customer information
  const customer = extractCustomerInfo(order);
  const address = extractAddressInfo(order);
  const items = extractInvoiceItems(order);

  // Calculate totals with proper GST breakdown
  // Order totals already include GST (18% total = 9% CGST + 9% SGST)
  const totalInclusive = order.totalAmount || 0;
  const discountAmount = order.discountAmount || 0;

  // GST rates for India
  const GST_RATE = 0.18; // 18% total GST
  const cgstRate = 9;    // 9% CGST
  const sgstRate = 9;    // 9% SGST
  const igstRate = 0;    // 0% IGST for intra-state

  // Calculate amounts excluding GST
  const totalAfterDiscount = totalInclusive - discountAmount;
  const subtotalExclusive = totalAfterDiscount / (1 + GST_RATE);

  // Calculate GST amounts
  const totalGSTAmount = totalAfterDiscount - subtotalExclusive;
  const cgstAmount = totalGSTAmount / 2; // Split equally between CGST and SGST
  const sgstAmount = totalGSTAmount / 2;
  const igstAmount = 0;

  const subtotal = subtotalExclusive;
  const total = totalAfterDiscount;

  return {
    // Order reference
    orderId: order.order_id,
    order: order._id as any, // Type assertion for ObjectId compatibility
    purchaseOrderNumber: order.purchaseOrderNumber,

    // Invoice defaults - orders that reach the orders page should be tax invoices
    invoiceType: 'tax', // Orders in the system are typically completed transactions
    date: order.createdAt || new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    status: mapOrderStatusToInvoiceStatus(order.status),

    // Customer information
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    customerAddress: address.formatted,
    customerGstNumber: address.gstNumber,
    billingAddress: address.formatted,

    // Items
    items,

    // Financial details
    subtotal,
    discountType: 'amount' as const,
    discountValue: discountAmount,
    discountAmount,
    cgst: cgstRate,
    sgst: sgstRate,
    igst: igstRate,
    cgstAmount,
    sgstAmount,
    igstAmount,
    total,

    // Timestamps
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

/**
 * Extracts and standardizes customer information from order
 */
function extractCustomerInfo(order: PopulatedOrder) {
  // Priority: address data > billing address > user data > express checkout metadata
  const addressData = typeof order.address === 'object' ? order.address : {};
  const billingData = (order.billingAddress as any) || {};
  const userData = order.user || {};
  const expressData = (order.expressCheckoutMetadata as any) || {};

  return {
    name: addressData.name ||
      addressData.fullName ||
      billingData.name ||
      userData.name ||
      order.name ||
      'Unknown Customer',

    email: addressData.email ||
      billingData.email ||
      userData.email ||
      expressData.originalEmail ||
      'Unknown Email',

    phone: addressData.phone ||
      addressData.phoneNumber ||
      billingData.phone ||
      'Unknown Phone'
  };
}

/**
 * Extracts and formats address information from order
 */
function extractAddressInfo(order: PopulatedOrder) {
  let addressObj: any = {};

  if (typeof order.address === 'string') {
    return {
      formatted: order.address,
      gstNumber: order.billingAddress?.gstNumber || undefined
    };
  } else if (order.address && typeof order.address === 'object') {
    addressObj = order.address;
  } else if (order.billingAddress) {
    addressObj = order.billingAddress;
  }

  // Handle different address field variations
  const street = addressObj.street ||
    addressObj.streetAddress ||
    addressObj.address ||
    addressObj.fullName || '';
  const city = addressObj.city || '';
  const state = addressObj.state || '';
  const zipCode = addressObj.zipCode ||
    addressObj.postalCode || '';
  const country = addressObj.country || 'India';

  // Create formatted address string with proper line breaks
  const addressParts = [];

  if (street) addressParts.push(street);
  if (city || state || zipCode) {
    const locationParts = [city, state, zipCode].filter(Boolean);
    if (locationParts.length > 0) {
      addressParts.push(locationParts.join(', '));
    }
  }
  if (country && country !== 'India') addressParts.push(country);

  return {
    formatted: addressParts.length > 0 ? addressParts.join('\n') : 'Address not provided',
    gstNumber: addressObj.gstNumber || order.billingAddress?.gstNumber
  };
}

/**
 * Converts order items to invoice items format using standardized fields
 */
function extractInvoiceItems(order: PopulatedOrder): IInvoiceItem[] {
  if (!order.items || order.items.length === 0) {
    return [];
  }

  return order.items.map((item, index) => {
    // Handle different item types (product orders vs design orders)
    let description = 'Custom Item';
    let image = '';
    let isDesignItem = false;

    if (item.productId && typeof item.productId === 'object') {
      // Regular product order
      description = item.productId.name || 'Custom Product';
      image = item.productId.images?.[0] || '';
    } else if (item.designData) {
      // Design order
      description = item.designData.productName || 'Custom Design Item';
      image = item.designData.previewImage || '';
      isDesignItem = true;
    }

    // Use standardized fields with fallback to legacy fields
    const pricePerItemInclusive = item.pricePerItem || item.price || 0;
    const quantity = item.quantity || 1;
    const totalPriceInclusive = item.totalPrice || (quantity * pricePerItemInclusive);

    // Calculate GST breakdown for this item (prices include GST)
    const GST_RATE = 0.18;
    const totalPriceExclusive = totalPriceInclusive / (1 + GST_RATE);
    const pricePerItemExclusive = totalPriceExclusive / quantity;

    // Use explicit size and color fields with fallback to extraction functions
    const size = item.size || extractSizeFromItem(item);
    const color = item.color || extractColorFromItem(item);

    // Add size and color to description for clarity if they're meaningful
    if (size !== 'M' || color !== 'White') {
      const specs = [];
      if (size !== 'M') specs.push(size);
      if (color !== 'White') specs.push(color);
      if (specs.length > 0) {
        description = `${description} (${specs.join(', ')})`;
      }
    }

    return {
      id: `item_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 6)}`,
      description,
      size: size as any, // Cast to StandardSize
      color,
      customColor: '',
      quantity,
      unitPrice: pricePerItemExclusive,  // Price excluding GST
      total: totalPriceExclusive,        // Total excluding GST
      totalInclusiveGST: totalPriceInclusive, // Store original inclusive price for reference
      image,
      isDesignItem,
      designData: isDesignItem ? item.designData : undefined
    };
  });
}

/**
 * Extracts size information from order item with fallback logic
 */
function extractSizeFromItem(item: OrderItemWithProduct): string {
  // First check explicit size field (new standardized approach)
  if (item.size) {
    return item.size;
  }

  // Fallback to legacy sizes object (for design orders)
  if (item.sizes && typeof item.sizes === 'object') {
    // Handle design orders with size breakdown
    const sizes = Object.keys(item.sizes);
    return sizes.length > 0 ? sizes[0] : 'M';
  }

  return 'M'; // Default size
}

/**
 * Extracts color information from order item with fallback logic
 */
function extractColorFromItem(item: OrderItemWithProduct): string {
  // First check explicit color field (new standardized approach)
  if (item.color) {
    return item.color;
  }

  // Fallback to design data color
  if (item.designData && item.designData.color) {
    return item.designData.color;
  }

  // Fallback to design data selected shirt color
  if (item.designData && item.designData.selectedShirt && item.designData.selectedShirt.color) {
    return item.designData.selectedShirt.color;
  }

  return 'White'; // Default color
}

/**
 * Maps order status to appropriate invoice status
 */
function mapOrderStatusToInvoiceStatus(orderStatus: string): 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' {
  switch (orderStatus) {
    case 'completed':
      return 'paid';
    case 'pending':
      return 'sent';
    case 'failed':
      return 'cancelled';
    default:
      return 'draft';
  }
}

/**
 * Standardizes invoice data format for frontend consumption
 */
export function standardizeInvoiceData(data: any): any {
  return {
    // Invoice identification
    _id: data._id,
    invoiceNumber: data.invoiceNumber || generateInvoiceNumber(data),
    invoiceType: data.invoiceType || 'proforma',
    orderId: data.orderId || data.order_id,

    // Dates
    date: data.date || data.createdAt,
    dueDate: data.dueDate,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,

    // Customer information (multiple field mappings for compatibility)
    customerName: data.customerName || data.name,
    customerEmail: data.customerEmail || data.email,
    customerPhone: data.customerPhone || data.phone,
    customerAddress: data.customerAddress || data.address,
    customerGstNumber: data.customerGstNumber,

    // Alternative customer field mappings for backward compatibility
    name: data.customerName || data.name,
    email: data.customerEmail || data.email,
    phone: data.customerPhone || data.phone,

    // Address information
    address: data.customerAddress || data.billingAddress || data.address,
    billingAddress: data.billingAddress || data.customerAddress,
    shippingAddress: data.shippingAddress,

    // Items
    items: data.items || [],

    // Financial details
    subtotal: data.subtotal || 0,
    discountType: data.discountType || 'amount',
    discountValue: data.discountValue || 0,
    discountAmount: data.discountAmount || 0,
    totalAmount: data.total || data.totalAmount,
    total: data.total || data.totalAmount,

    // Tax details
    cgst: data.cgst || 0,
    sgst: data.sgst || 0,
    igst: data.igst || 0,
    cgstAmount: data.cgstAmount || 0,
    sgstAmount: data.sgstAmount || 0,
    igstAmount: data.igstAmount || 0,

    // Status and notes
    status: data.status || 'draft',
    notes: data.notes,

    // Purchase order
    purchaseOrderNumber: data.purchaseOrderNumber
  };
}

/**
 * Generates invoice number if not provided
 */
function generateInvoiceNumber(data: any): string {
  const date = new Date(data.date || data.createdAt || Date.now());
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const timestamp = Date.now().toString().slice(-4);

  return `INV-${year}${month}${day}-${timestamp}`;
}