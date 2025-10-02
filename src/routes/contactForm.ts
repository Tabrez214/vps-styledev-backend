// routes/contact.js (Updated version with welcome email)
import express, { Request, Response } from 'express';
const router = express.Router();
import ContactForm from '../models/contactForm';
import EmailService from '../services/emailService';

// Create an instance of EmailService
const emailService = new EmailService();

// GET route to fetch all contacts with pagination and filtering
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    
    // Optional filters
    const searchTerm = req.query.search as string;
    const subscriptionStatus = req.query.status as string; // 'subscribed', 'unsubscribed', or 'all'
    
    // Build query object
    let query: any = {};
    
    // Add search functionality
    if (searchTerm) {
      query.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { mobile: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } }
      ];
    }
    
    // Add subscription status filter
    if (subscriptionStatus && subscriptionStatus !== 'all') {
      query.isSubscribed = subscriptionStatus === 'subscribed';
    }
    
    // Get total count for pagination
    const totalContacts = await ContactForm.countDocuments(query);
    const totalPages = Math.ceil(totalContacts / limit);
    
    // Fetch contacts with pagination
    const contacts = await ContactForm.find(query)
      .sort({ createdAt: -1 }) // Sort by newest first
      .skip(skip)
      .limit(limit)
      .lean(); // Use lean() for better performance
    
    // Pagination info
    const pagination = {
      currentPage: page,
      totalPages,
      totalContacts,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      limit
    };
    
    res.status(200).json({
      success: true,
      data: contacts,
      pagination,
      message: 'Contacts fetched successfully'
    });
    
  } catch (error: any) {
    console.error('Get contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contacts',
      error: error.message
    });
  }
});

// GET route to fetch single contact by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const contact = await ContactForm.findById(id);
    
    if (!contact) {
      res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
      return;
    }
    
    res.status(200).json({
      success: true,
      data: contact,
      message: 'Contact fetched successfully'
    });
    
  } catch (error: any) {
    console.error('Get contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contact',
      error: error.message
    });
  }
});

// POST route to create new contact with welcome email
router.post('/', async (req: Request, res: Response) => {
  try {
    const { email, name, mobile, description } = req.body;

    // Validate required fields (matching frontend validation)
    if (!email || !name || !mobile) {
      res.status(400).json({
        success: false,
        message: 'Name, mobile number, and email are required',
      });
      return;
    }

    // Check for existing subscriber
    const existingSubscriber = await ContactForm.findOne({ email });
    if (existingSubscriber) {
      res.status(200).json({
        success: true,
        message: 'You are already subscribed',
      });
      return;
    }

    // Create new contact form entry
    const contactForm = await ContactForm.create({
      email,
      name,
      mobile,
      description: description || '',
      subscribedAt: new Date(),
      source: 'popup',
    });

    // Send welcome email (don't wait for it to complete)
    emailService.sendWelcomeEmail(email, name);

    res.status(201).json({
      success: true,
      message: 'Message sent successfully!', // Match frontend success message
      data: {
        id: contactForm._id,
        email: contactForm.email,
        name: contactForm.name,
      },
    });
  } catch (error: any) {
    console.error('Contact form error:', error);

    if (error.name === 'ValidationError') {
      // Extract specific validation errors
      const validationErrors = Object.values(error.errors).map((err: any) => err.message);
      res.status(400).json({
        success: false,
        message: validationErrors[0] || 'Invalid data provided', // Return first validation error
        errors: error.errors,
      });
      return;
    }

    if (error.code === 11000) {
      res.status(409).json({
        success: false,
        message: 'This email is already subscribed',
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Failed to send message. Please try again.', // Match frontend error message
    });
  }
});

// Unsubscribe endpoint
router.post('/unsubscribe', async (req: Request, res: Response) => {
  console.log('Unsubscribe route hit', req.body);
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        message: 'Email is required',
      });
      return;
    }

    const contactForm = await ContactForm.findOne({ email });

    if (!contactForm) {
      res.status(404).json({
        success: false,
        message: 'Subscriber not found',
      });
      return;
    }

    if (!contactForm.isSubscribed) {
      res.status(200).json({
        success: true,
        message: 'You are already unsubscribed',
      });
      return;
    }

    contactForm.isSubscribed = false;
    await contactForm.save();

    res.status(200).json({
      success: true,
      message: 'You have been unsubscribed successfully',
    });
  } catch (error: any) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// PUT route to update contact subscription status
router.put('/:id/subscription', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isSubscribed } = req.body;

    const contact = await ContactForm.findById(id);

    if (!contact) {
      res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
      return;
    }

    contact.isSubscribed = isSubscribed;
    await contact.save();

    res.status(200).json({
      success: true,
      data: contact,
      message: `Contact ${isSubscribed ? 'subscribed' : 'unsubscribed'} successfully`
    });

  } catch (error: any) {
    console.error('Update subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update subscription status',
      error: error.message
    });
  }
});

// DELETE route to delete a contact
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const contact = await ContactForm.findById(id);

    if (!contact) {
      res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
      return;
    }

    await ContactForm.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Contact deleted successfully'
    });

  } catch (error: any) {
    console.error('Delete contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete contact',
      error: error.message
    });
  }
});

export default router;