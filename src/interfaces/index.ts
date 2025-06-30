/**
 * Common interfaces for design elements
 */

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Dimensions {
  widthInches: number;
  heightInches: number;
}

export interface ViewDimensions {
  front: Dimensions;
  back: Dimensions;
  left: Dimensions;
  right: Dimensions;
}

export interface PreviewImages {
  front: string;
  back: string;
  left: string;
  right: string;
}

export interface TShirtStyle {
  style: string;
  color: string;
}

/**
 * Element property interfaces
 */
export interface TextProperties {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;
}

export interface ImageProperties {
  src: string;
  opacity?: number;
  filter?: string;
  originalWidth?: number;
  originalHeight?: number;
  // File metadata for uploaded images
  fileId?: string;
  originalFilename?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt?: Date;
}

export interface ClipArtProperties {
  src: string;
  opacity?: number;
  filter?: string;
  originalWidth?: number;
  originalHeight?: number;
  // File metadata for uploaded images
  fileId?: string;
  originalFilename?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt?: Date;
}

export type ElementProperties = TextProperties | ImageProperties | ClipArtProperties;

/**
 * Design element interface
 */
export interface DesignElement {
  id: string;
  type: 'text' | 'image' | 'clipart';
  position: Position;
  size: Size;
  rotation: number;
  layer: number;
  view: 'front' | 'back' | 'left' | 'right';
  properties: ElementProperties;
}

/**
 * Design metadata interface
 */
export interface DesignMetadata {
  email: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt?: Date;
  updatedAt?: Date;
  isDeleted?: boolean;
  deletedAt?: Date;
}

/**
 * Design document interface
 */
export interface IDesign {
  name: string;
  shareableId: string;
  accessToken?: string;
  tshirt: TShirtStyle;
  elements: DesignElement[];
  dimensions: ViewDimensions;
  previewImages?: PreviewImages;
  isPublic: boolean;
  metadata: DesignMetadata;
}

/**
 * Asset interfaces
 */
export interface AssetDimensions {
  width: number;
  height: number;
}

export interface AssetMetadata {
  uploadedBy: string;
  originalFilename: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt?: Date;
  ipAddress?: string;
  userAgent?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAsset {
  type: 'clipart' | 'uploaded';
  category?: string;
  name: string;
  tags: string[];
  url: string;
  thumbnailUrl: string;
  svg?: string; // SVG content for clipart assets
  dimensions: AssetDimensions;
  metadata: AssetMetadata;
  isActive: boolean;
}

/**
 * T-Shirt style interfaces
 */
export interface TShirtColor {
  _id: any;
  name: string;
  hex: string;
  isAvailable: boolean;
}

export interface TShirtSize {
  _id: any;
  toObject(): any;
  size: string;
  isAvailable: boolean;
  additionalCost: number;
}

export interface PrintableArea {
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface PrintableAreas {
  front: PrintableArea;
  back: PrintableArea;
  left: PrintableArea;
  right: PrintableArea;
}

export interface TShirtImages {
  front: string;
  back: string;
  left: string;
  right: string;
}

export interface ITShirtStyle {
  name: string;
  description: string;
  basePrice: number;
  availableColors: TShirtColor[];
  availableSizes: TShirtSize[];
  images: TShirtImages;
  printableAreas: PrintableAreas;
  isActive: boolean;
}

/**
 * Order interfaces
 */
export interface OrderSizes {
  [size: string]: number;
}

export interface OrderAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface OrderCustomer {
  name: string;
  email: string;
  address: OrderAddress;
  phone: string;
}

export interface OrderCost {
  description: string;
  amount: number;
}

export interface OrderPriceBreakdown {
  basePrice: number;
  additionalCosts: OrderCost[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
}

export interface OrderMetadata {
  ipAddress?: string;
  userAgent?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IOrder {
  orderNumber: string;
  designId: string;
  customer: OrderCustomer;
  sizes: OrderSizes;
  totalQuantity: number;
  priceBreakdown: OrderPriceBreakdown;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  printerChallanUrl?: string;
  estimatedDelivery?: Date;
  metadata: OrderMetadata;
}
