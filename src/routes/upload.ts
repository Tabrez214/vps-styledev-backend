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
    res.status(400).json({ message: 'No file uploaded' });
    return;
  }

  console.log('Uploaded file details:', req.file);
  const file = req.file;
  if (!file) {
    res.status(400).json({ message: "No file uploaded" });
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

    // Construct the full URL based on the environment
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? process.env.BASE_URL 
      : `http://localhost:${process.env.PORT || 3001}`;
    
    const fullUrl = `${baseUrl}/uploads/${req.file.filename}`;

    // Return a response that the frontend can use:
    res.json({ 
      message: "File uploaded successfully", 
      url: fullUrl,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});


export default router;
