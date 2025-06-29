import multer from 'multer';
import fs from 'fs';
import path from 'path';

// Get the absolute path to the design-studio uploads directory
const uploadDir = path.resolve(process.cwd(), 'uploads');
const designStudioDir = path.resolve(uploadDir, 'design-studio');

// Ensure the "uploads/design-studio" directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

if (!fs.existsSync(designStudioDir)) {
  fs.mkdirSync(designStudioDir, { recursive: true });
}

// Configure Multer storage for design studio files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, designStudioDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    // Prefix with 'design-' to identify design studio files
    cb(null, 'design-' + uniqueSuffix + ext);
  },
});

// File filter to allow images and some design files
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allow images and some design file formats
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf', // For design references
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and PDF files are allowed for design studio.'));
  }
};

// Multer upload configuration for design studio
const designStudioUpload = multer({
  storage,
  fileFilter,
  limits: { 
    fileSize: 25 * 1024 * 1024, // 25MB limit (larger for design files)
    files: 10 // Allow up to 10 files at once
  },
});

export default designStudioUpload;