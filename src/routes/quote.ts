// order.ts (converted to TypeScript)
import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import Design from '../models/design';
import Order, { IDesignOrder } from '../models/designOrder';
import TShirtStyle from '../models/tShirtStyle';
import { generatePrinterChallan } from '../utils/design';

const router = express.Router();

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { designId, sizes, options } = req.body;
    if (!designId || !sizes) {
      res.status(400).json({ success: false, message: 'Design ID and sizes are required' });
      return;
    }

    const design = await Design.findOne({ shareableId: designId });
    if (!design) {
      res.status(404).json({ success: false, message: 'Design not found' });
      return;
    }

    const tshirtStyle = await TShirtStyle.findOne({ name: design.tshirt.style, isActive: true });
    if (!tshirtStyle) {
      res.status(404).json({ success: false, message: 'T-shirt style not found' });
      return;
    }
    const totalQuantity = Object.values(sizes).reduce((sum: number, qty) => sum + Number(qty), 0);
    if (totalQuantity <= 0) {
      res.status(400).json({ success: false, message: 'Total quantity must be greater than 0' });
      return;
    }

    const basePrice = tshirtStyle.basePrice * totalQuantity;
    const additionalCosts: { description: string; amount: number }[] = [];
    if (options?.hasText) additionalCosts.push({ description: 'Text printing', amount: 100 });
    if (options?.hasImage) additionalCosts.push({ description: 'Image printing', amount: 100 });
    if (options?.hasBackDesign) additionalCosts.push({ description: 'Back design printing', amount: 100 });

    let plusSizeCost = 0;
    for (const [size, quantity] of Object.entries(sizes)) {
      const sizeInfo = tshirtStyle.availableSizes.find(s => s.size === size);
      if (sizeInfo && sizeInfo.additionalCost && sizeInfo.additionalCost > 0 && Number(quantity) > 0) {
        plusSizeCost += sizeInfo.additionalCost * Number(quantity);
      }
    }
    if (plusSizeCost > 0) additionalCosts.push({ description: 'Plus size surcharge', amount: plusSizeCost });

    const additionalCostsTotal = additionalCosts.reduce((sum, cost) => sum + cost.amount, 0);
    const subtotal = basePrice + additionalCostsTotal;
    const tax = Math.round(subtotal * 0.18);
    const shipping = 100;
    const total = subtotal + tax + shipping;

    res.json({
      success: true,
      quote: {
        designId,
        totalQuantity,
        sizes,
        priceBreakdown: {
          basePrice,
          additionalCosts,
          subtotal,
          tax,
          shipping,
          total
        }
      }
    });
  } catch (error) {
    console.error('Error calculating quote:', error);
    res.status(500).json({ success: false, message: 'Server error while calculating quote' });
  }
});

router.post('/printer-challan', async (req: Request, res: Response): Promise<void> => {
  try {
    const { designId, orderDetails } = req.body;
    if (!designId || !orderDetails?.orderNumber) {
      res.status(400).json({ success: false, message: 'Design ID and order details are required' });
      return;
    }
    const design = await Design.findOne({ shareableId: designId });
    if (!design) {
      res.status(404).json({ success: false, message: 'Design not found' });
      return;
    }
    const challanUrl = await generatePrinterChallan(design, orderDetails);
    res.json({ success: true, challanUrl, message: 'Printer challan generated successfully' });
  } catch (error) {
    console.error('Error generating printer challan:', error);
    res.status(500).json({ success: false, message: 'Server error while generating printer challan' });
  }
});

router.post('/checkout', async (req: Request, res: Response): Promise<void> => {
  try {
    const { designId, sizes, customer, shippingMethod } = req.body;
    if (!designId || !sizes || !customer) {
      res.status(400).json({ success: false, message: 'Design ID, sizes, and customer information are required' });
      return;
    }

    const design = await Design.findOne({ shareableId: designId });
    if (!design) {
      res.status(404).json({ success: false, message: 'Design not found' });
      return;
    }

    const tshirtStyle = await TShirtStyle.findOne({ name: design.tshirt.style, isActive: true });
    if (!tshirtStyle) {
      res.status(404).json({ success: false, message: 'T-shirt style not found' });
      return;
    }

    const totalQuantity = Object.values(sizes).reduce((sum: number, qty) => sum + Number(qty), 0);
    if (totalQuantity <= 0) {
      res.status(400).json({ success: false, message: 'Total quantity must be greater than 0' });
      return;
    }

    const basePrice = tshirtStyle.basePrice * totalQuantity;
    const additionalCosts: { description: string; amount: number }[] = [];

    const hasText = design.elements.some((el: any) => el.type === 'text');
    const hasImage = design.elements.some((el: any) => el.type === 'image' || el.type === 'clipart');
    const hasBackDesign = design.elements.some((el: any) => el.view === 'back');
    if (hasText) additionalCosts.push({ description: 'Text printing', amount: 100 });
    if (hasImage) additionalCosts.push({ description: 'Image printing', amount: 100 });
    if (hasBackDesign) additionalCosts.push({ description: 'Back design printing', amount: 100 });

    let plusSizeCost = 0;
    for (const [size, quantity] of Object.entries(sizes)) {
      const sizeInfo = tshirtStyle.availableSizes.find((s: any) => s.size === size);
      if (sizeInfo && sizeInfo.additionalCost && sizeInfo.additionalCost > 0 && Number(quantity) > 0) {
        plusSizeCost += sizeInfo.additionalCost * Number(quantity);
      }
    }
    if (plusSizeCost > 0) additionalCosts.push({ description: 'Plus size surcharge', amount: plusSizeCost });

    const additionalCostsTotal = additionalCosts.reduce((sum, cost) => sum + cost.amount, 0);
    const subtotal = basePrice + additionalCostsTotal;
    const tax = Math.round(subtotal * 0.18);
    const shipping = shippingMethod === 'rush' ? 300 : 100;
    const total = subtotal + tax + shipping;

    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

    const newOrder = new Order({
      orderNumber,
      designId: design._id,
      customer,
      sizes,
      totalQuantity,
      priceBreakdown: { basePrice, additionalCosts, subtotal, tax, shipping, total },
      status: 'pending',
      paymentStatus: 'pending',
      metadata: { ipAddress: req.ip }
    });
    await newOrder.save();

    const challanUrl = await generatePrinterChallan(design, { orderNumber, sizes } as IDesignOrder);
    newOrder.printerChallanUrl = challanUrl;
    await newOrder.save();

    res.status(201).json({
      success: true,
      order: {
        orderNumber,
        total,
        paymentUrl: `/payment/${orderNumber}`,
        challanUrl
      },
      message: 'Order created successfully'
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, message: 'Server error while creating order' });
  }
});

export default router;
