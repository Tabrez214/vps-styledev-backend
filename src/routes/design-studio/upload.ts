import express from 'express';
import designStudioUpload from '../../middleware/designStudioUploadMiddleware';
import { Request, Response } from 'express';
import FileModel from '../../models/file';

const router = express.Router();

// Single file upload for design studio
router.post('/upload', designStudioUpload.single('file'), async (req: Request, res: Response): Promise<void> => {
  console.log('Incoming design studio file upload request');

  if (!req.file) {
    console.log('No file received');
    res.status(400).json({ 
      success: false,
      error: 'No file uploaded' 
    });
    return;
  }

  try {
    // Save file metadata to database
    const newFile = await FileModel.create({
      fileName: req.file.originalname,
      fileSizeInNumber: req.file.size,
      fileType: req.file.mimetype,
      filePath: `/uploads/design-studio/${req.file.filename}`,
    });
    
    console.log("Design studio file saved:", newFile);

    // Get the caption from the request body
    const caption = req.body.caption || '';

    // Construct the full URL based on the environment
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? process.env.BASE_URL 
      : `http://localhost:${process.env.PORT || 3001}`;
    
    const fileUrl = `/uploads/design-studio/${req.file.filename}`;
    const fullUrl = `${baseUrl}${fileUrl}`;

    // Return comprehensive file information for design studio
    res.json({ 
      success: true,
      url: fileUrl,
      fullUrl: fullUrl,
      caption: caption,
      fileInfo: {
        fileId: newFile._id,
        originalName: req.file.originalname,
        originalFilename: req.file.originalname,
        size: req.file.size,
        fileSize: req.file.size,
        type: req.file.mimetype,
        mimeType: req.file.mimetype,
        uploadedAt: new Date().toISOString(),
        filename: req.file.filename,
        // Design studio specific metadata
        category: 'design-studio',
        folder: 'design-studio'
      },
      message: 'Design studio file uploaded successfully'
    });
  } catch (error) {
    console.error('Design studio upload error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to process design studio upload' 
    });
  }
});

// Multiple files upload for design studio (for batch uploads)
router.post('/upload-multiple', designStudioUpload.array('files', 10), async (req: Request, res: Response): Promise<void> => {
  console.log('Incoming design studio multiple files upload request');

  if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
    console.log('No files received');
    res.status(400).json({ 
      success: false,
      error: 'No files uploaded' 
    });
    return;
  }

  try {
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? process.env.BASE_URL 
      : `http://localhost:${process.env.PORT || 3001}`;

    const uploadedFiles = await Promise.all(
      req.files.map(async (file) => {
        // Save each file metadata to database
        const newFile = await FileModel.create({
          fileName: file.originalname,
          fileSizeInNumber: file.size,
          fileType: file.mimetype,
          filePath: `/uploads/design-studio/${file.filename}`,
        });

        const fileUrl = `/uploads/design-studio/${file.filename}`;
        const fullUrl = `${baseUrl}${fileUrl}`;

        return {
          fileId: newFile._id,
          originalName: file.originalname,
          filename: file.filename,
          url: fileUrl,
          fullUrl: fullUrl,
          size: file.size,
          mimeType: file.mimetype,
          uploadedAt: new Date().toISOString()
        };
      })
    );

    console.log(`Design studio files uploaded: ${uploadedFiles.length} files`);

    res.json({ 
      success: true,
      files: uploadedFiles,
      count: uploadedFiles.length,
      message: `${uploadedFiles.length} design studio files uploaded successfully`
    });
  } catch (error) {
    console.error('Design studio multiple upload error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to process design studio multiple upload' 
    });
  }
});

export default router;