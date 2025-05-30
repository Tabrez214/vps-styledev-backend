import express, { Request, Response } from 'express';
const router = express.Router();
const Subscriber = require('../models/subscribe');

router.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const { email, name } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        message: 'Email is required',
      });
      return;
    }

    const existingSubscriber = await Subscriber.findOne({ email });
    if (existingSubscriber) {
      res.status(200).json({
        success: true,
        message: 'You are already subscribed',
      });
      return;
    }

    // Create new subscriber
    const subscriber = await Subscriber.create({
      email,
      name: name || '',
      subscribedAt: new Date(),
      source: 'popup',
    });

    res.status(201).json({
      success: true,
      message: 'Subscription successful',
      data: {
        id: subscriber._id,
        email: subscriber.email,
      },
    });
  } catch (error: any) {
    console.error('Subscription error:', error);

    if (error.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        message: 'Invalid data provided',
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
      message: 'Internal server error',
    });
  }
});

// Unsubscribe
router.post('/unsubscribe', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        message: 'Email is required',
      });
      return;
    }

    const subscriber = await Subscriber.findOne({ email });

    if (!subscriber) {
      res.status(404).json({
        success: false,
        message: 'Subscriber not found',
      });
      return;
    }

    if (!subscriber.isSubscribed) {
      res.status(200).json({
        success: true,
        message: 'You are already unsubscribed',
      });
      return;
    }

    subscriber.isSubscribed = false;
    await subscriber.save();

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
