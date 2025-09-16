import { Router, Request, Response } from 'express';
import Product from '../models/product';
import Category from '../models/category';

const router = Router();

// Helper function to escape XML content
function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

// Helper function to clean HTML from descriptions
function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
}

// Helper function to get product category path
function getCategoryPath(categories: any[]): string {
  if (!categories || categories.length === 0) return 'Apparel & Accessories > Clothing';

  const category = categories[0];
  if (category.ancestors && category.ancestors.length > 0) {
    const path = category.ancestors.map((ancestor: any) => ancestor.name).join(' > ');
    return `${path} > ${category.name}`;
  }

  return category.name || 'Apparel & Accessories > Clothing';
}

// Google Shopping XML Feed Route
router.get('/feed.xml', async (req: Request, res: Response) => {
  try {
    console.log('Generating Google Shopping feed...');

    // Fetch active products with populated categories
    const products = await Product.find({
      isActive: true,
      stock: { $gt: 0 } // Only include products with stock
    })
      .populate('categories', 'name slug ancestors')
      .lean()
      .exec();

    console.log(`Found ${products.length} active products for feed`);

    // Start building XML
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>StyleDev Products</title>
    <link>https://styledev.in</link>
    <description>Premium custom apparel and design services from StyleDev</description>
    <language>en-US</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`;

    // Add each product as an item
    products.forEach((product: any) => {
      // Get primary image
      const primaryImage = product.images?.find((img: any) => img.isDefault) || product.images?.[0];
      const imageUrl = primaryImage?.url ?
        (primaryImage.url.startsWith('http') ? primaryImage.url : `https://styledev.in${primaryImage.url}`) :
        'https://styledev.in/default-product.jpg';

      // Get additional images (up to 10 total)
      const additionalImages = product.images
        ?.filter((img: any) => img !== primaryImage)
        ?.slice(0, 9)
        ?.map((img: any) => img.url.startsWith('http') ? img.url : `https://styledev.in${img.url}`)
        ?.join(',') || '';

      // Get availability
      const totalStock = product.stock + (product.sizes?.reduce((sum: number, size: any) => sum + (size.stock || 0), 0) || 0);
      const availability = totalStock > 0 ? 'in_stock' : 'out_of_stock';

      // Get sizes
      const sizes = product.sizes?.map((size: any) => size.size).join(', ') || '';

      // Get colors
      const colors = product.colors?.map((color: any) => color.name).join(', ') || '';

      // Get category path
      const categoryPath = getCategoryPath(product.categories);

      // Clean description
      const cleanDescription = stripHtml(product.description || product.shortDescription || '');
      const shortDesc = cleanDescription.length > 5000 ?
        cleanDescription.substring(0, 4997) + '...' : cleanDescription;

      xml += `
    <item>
      <g:id>${product._id}</g:id>
      <g:title><![CDATA[${escapeXml(product.name)}]]></g:title>
      <g:description><![CDATA[${shortDesc}]]></g:description>
      <g:link>https://styledev.in/products/${product._id}</g:link>
      <g:image_link>${imageUrl}</g:image_link>`;

      // Add additional images if available
      if (additionalImages) {
        xml += `
      <g:additional_image_link>${additionalImages}</g:additional_image_link>`;
      }

      xml += `
      <g:price>${product.pricePerItem} INR</g:price>
      <g:availability>${availability}</g:availability>
      <g:brand>StyleDev</g:brand>
      <g:condition>new</g:condition>
      <g:product_type><![CDATA[${categoryPath}]]></g:product_type>
      <g:google_product_category>Apparel &amp; Accessories &gt; Clothing</g:google_product_category>
      <g:item_group_id>${product._id}</g:item_group_id>`;

      // Add sizes if available
      if (sizes) {
        xml += `
      <g:size><![CDATA[${sizes}]]></g:size>`;
      }

      // Add colors if available
      if (colors) {
        xml += `
      <g:color><![CDATA[${colors}]]></g:color>`;
      }

      // Add shipping info
      xml += `
      <g:shipping>
        <g:country>IN</g:country>
        <g:service>Standard</g:service>
        <g:price>100 INR</g:price>
      </g:shipping>`;

      // Add minimum order quantity
      if (product.minimumOrderQuantity > 1) {
        xml += `
      <g:min_handling_time>3</g:min_handling_time>
      <g:max_handling_time>7</g:max_handling_time>`;
      }

      // Add custom labels for bulk pricing
      if (product.bulkPricing && product.bulkPricing.length > 0) {
        xml += `
      <g:custom_label_0>Bulk Pricing Available</g:custom_label_0>`;
      }

      // Add rush order info
      if (product.rushOrderAvailable) {
        xml += `
      <g:custom_label_1>Rush Order Available</g:custom_label_1>`;
      }

      // Add meta information if available
      if (product.metaTitle) {
        xml += `
      <g:custom_label_2><![CDATA[${escapeXml(product.metaTitle)}]]></g:custom_label_2>`;
      }

      xml += `
    </item>`;
    });

    xml += `
  </channel>
</rss>`;

    // Set appropriate headers
    res.set({
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'Last-Modified': new Date().toUTCString()
    });

    console.log('Google Shopping feed generated successfully');
    res.send(xml);

  } catch (error) {
    console.error('Error generating Google Shopping feed:', error);
    res.status(500).set('Content-Type', 'application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>StyleDev Products - Error</title>
    <description>Error generating product feed</description>
  </channel>
</rss>`);
  }
});

// Alternative JSON feed for debugging
router.get('/feed.json', async (req: Request, res: Response) => {
  try {
    const products = await Product.find({
      isActive: true,
      stock: { $gt: 0 }
    })
      .populate('categories', 'name slug ancestors')
      .select('name shortDescription pricePerItem stock images categories')
      .lean()
      .exec();

    res.json({
      total: products.length,
      products: products.map(product => ({
        id: product._id,
        name: product.name,
        description: product.shortDescription,
        price: product.pricePerItem,
        stock: product.stock,
        image: product.images?.[0]?.url,
        categories: product.categories
      }))
    });

  } catch (error) {
    console.error('Error generating JSON feed:', error);
    res.status(500).json({ error: 'Failed to generate product feed' });
  }
});

export default router;