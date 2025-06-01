import express, { Request, Response } from 'express';
const router = express.Router();
import ContactForm from '../models/contactForm';

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

export default router;