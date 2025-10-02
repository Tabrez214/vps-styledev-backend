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

// File filter to allow images and design files
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allow images and design file formats
  const allowedMimeTypes = [
    // Image formats
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    // Design file formats
    'application/pdf', // PDF files
    'application/postscript', // AI and EPS files
    'image/vnd.adobe.photoshop', // PSD files
    'application/x-photoshop', // Alternative PSD MIME type
    'image/photoshop', // Another PSD MIME type
    'image/x-photoshop', // Another PSD MIME type
    'application/photoshop', // Another PSD MIME type
    'image/psd', // PSD MIME type
    'application/illustrator', // AI files
    'application/x-illustrator', // AI files
    'image/x-eps', // EPS files
    'application/eps', // EPS files
    'application/x-eps', // EPS files
  ];

  // Also check file extensions as a fallback since MIME types can vary
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.pdf', '.ai', '.eps', '.psd'];
  const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
  
  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images (JPG, PNG, GIF, WebP, SVG) and design files (PDF, AI, EPS, PSD) are allowed for design studio.'));
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