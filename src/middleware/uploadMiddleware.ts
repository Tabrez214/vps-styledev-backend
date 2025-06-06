import multer from 'multer';
import fs from 'fs';
import path from 'path';

// Get the absolute path to the uploads directory (consistent with index.ts)
const uploadDir = path.resolve(process.cwd(), 'uploads');

// Ensure the "uploads" directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'file-' + uniqueSuffix + ext);
  },
});

// File filter to allow only images
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images are allowed.'));
  }
};

// Multer upload configuration
const upload = multer({
  storage,
  fileFilter, // Use the defined fileFilter function
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

export default upload;