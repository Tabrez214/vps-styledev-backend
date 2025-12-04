import multer from 'multer';
import fs from 'fs';
import path from 'path';

// Get the absolute path to the 3d logo requests directory
const uploadDir = path.resolve(process.cwd(), 'uploads', '3d-logo-requests');

// Ensure the "uploads/3d-logo-requests" directory exists
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
        const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `logo-${uniqueSuffix}-${sanitizedOriginalName}`);
    },
});

// File filter to allow logo file formats
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedMimeTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'application/pdf',
        'image/svg+xml'
    ];

    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf', '.svg'];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(fileExtension)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only .jpg, .jpeg, .png, .pdf, and .svg files are allowed.'));
    }
};

// Multer upload configuration
const threeDLogoUpload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
        files: 1 // Only one file allowed
    },
});

export default threeDLogoUpload;
