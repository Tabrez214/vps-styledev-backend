import express from 'express';
import Clipart from '../../models/design-studio/clipart';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const cliparts = await Clipart.find();
    res.json(cliparts);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(500).json({ message: errorMessage });
  }
});

export default router;