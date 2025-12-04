import { Router, Request, Response } from 'express';
import ThreeDLogoRequest from '../models/threeDLogoRequest';
import threeDLogoUpload from '../middleware/threeDLogoUploadMiddleware';
import { authMiddleware } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';

const router = Router();

// POST route for 3D logo request submission
router.post('/submit-request', threeDLogoUpload.single('logoFile'), async (req: Request, res: Response) => {
    try {
        const {
            fullName,
            email,
            phone,
            companyName,
            quantity,
            notes
        } = req.body;

        // Validate required fields
        if (!fullName || !email || !phone) {
            res.status(400).json({
                success: false,
                message: 'Please fill in all required fields (Name, Email, Phone)'
            });
            return;
        }

        if (!req.file) {
            res.status(400).json({
                success: false,
                message: 'Logo file is required'
            });
            return;
        }

        // Create new request
        const logoRequest = new ThreeDLogoRequest({
            fullName,
            email,
            phone,
            companyName: companyName || '',
            quantity: quantity || '',
            notes: notes || '',
            logoFile: req.file.path
        });

        await logoRequest.save();

        res.status(201).json({
            success: true,
            message: '3D Logo request submitted successfully!',
            requestId: logoRequest._id
        });

    } catch (error: any) {
        console.error('Error submitting 3D logo request:', error);

        // Handle multer errors
        if (error.code === 'LIMIT_FILE_SIZE') {
            res.status(400).json({
                success: false,
                message: 'File size too large. Maximum size is 50MB.'
            });
            return;
        }

        if (error.message && error.message.includes('Invalid file type')) {
            res.status(400).json({
                success: false,
                message: error.message
            });
            return;
        }

        // Handle validation errors
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map((err: any) => err.message);
            res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: validationErrors
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// GET route to fetch all requests (admin only)
router.get('/requests', authMiddleware, authorizeRoles('admin'), async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const status = req.query.status as string;
        const search = req.query.search as string;

        // Build query
        const query: any = {};
        if (status && ['pending', 'reviewed', 'quoted', 'rejected'].includes(status)) {
            query.status = status;
        }
        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { companyName: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;

        const [requests, total] = await Promise.all([
            ThreeDLogoRequest.find(query)
                .sort({ submissionDate: -1 })
                .skip(skip)
                .limit(limit),
            ThreeDLogoRequest.countDocuments(query)
        ]);

        res.json({
            success: true,
            requests,
            pagination: {
                current: page,
                total: Math.ceil(total / limit),
                count: requests.length,
                totalCount: total
            }
        });
    } catch (error) {
        console.error('Error fetching 3D logo requests:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// PUT route to update request status (admin only)
router.put('/requests/:id/status', authMiddleware, authorizeRoles('admin'), async (req: Request, res: Response) => {
    try {
        const { status } = req.body;

        if (!['pending', 'reviewed', 'quoted', 'rejected'].includes(status)) {
            res.status(400).json({
                success: false,
                message: 'Invalid status value'
            });
            return;
        }

        const request = await ThreeDLogoRequest.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );

        if (!request) {
            res.status(404).json({
                success: false,
                message: 'Request not found'
            });
            return;
        }

        res.json({
            success: true,
            message: 'Status updated successfully',
            request
        });
    } catch (error) {
        console.error('Error updating request status:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

export default router;
