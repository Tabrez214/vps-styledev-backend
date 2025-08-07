import multer from 'multer';
import fs from 'fs';
import path from 'path';

// Get the absolute path to the design submissions directory
const uploadDir = path.resolve(process.cwd(), 'uploads', 'design-submissions');

// Ensure the "uploads/design-submissions" directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer storage for design submissions
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `design-${uniqueSuffix}-${sanitizedOriginalName}`);
  },
});

// File filter to allow design file formats
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'application/pdf'
  ];
  
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf'];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only .jpg, .jpeg, .png, and .pdf files are allowed.'));
  }
};

// Multer upload configuration for design submissions
const designSubmissionUpload = multer({
  storage,
  fileFilter,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only one file allowed
  },
});

export default designSubmissionUpload;