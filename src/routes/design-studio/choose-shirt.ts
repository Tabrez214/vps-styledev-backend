import express from 'express';
import ShirtStyle from '../../models/design-studio/shirt-style';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const shirtStyles = await ShirtStyle.find();
    res.json(shirtStyles);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(500).json({ message: errorMessage });
  }
});

export default router;