import express from 'express';
import upload from '../middleware/uploadMiddleware';
import { Request, Response } from 'express';
import FileModel from '../models/file'; // Import Mongoose Model
import Product from '../models/product';

const router = express.Router();
router.post('/upload', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  console.log('Incoming file upload request');

  if (!req.file) {
    console.log('No file received');
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  try {
    const newFile = await FileModel.create({
      fileName: req.file.originalname,
      fileSizeInNumber: req.file.size,
      fileType: req.file.mimetype,
      filePath: `/uploads/${req.file.filename}`,
    });
    console.log("newFile:", newFile);

    // Get the caption from the request body
    const caption = req.body.caption || '';

    // Construct the full URL based on the environment
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? process.env.BASE_URL 
      : `http://localhost:${process.env.PORT || 3001}`;
    
    const fileUrl = `/uploads/${req.file.filename}`;
    const fullUrl = `${baseUrl}${fileUrl}`;

    // Return a response that matches the frontend's expected format
    res.json({ 
      url: fileUrl,
      caption: caption
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process upload' });
  }
});


export default router;
