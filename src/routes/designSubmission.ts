import { Router, Request, Response } from 'express';
import DesignSubmission from '../models/designSubmission';
import designSubmissionUpload from '../middleware/designSubmissionUploadMiddleware';
import { authMiddleware } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';

const router = Router();

// POST route for design submission
router.post('/submit-design', designSubmissionUpload.single('designFile'), async (req: Request, res: Response) => {
  try {
    const {
      fullName,
      email,
      phone,
      collegeName,
      instagram,
      designTitle,
      inspiration,
      internshipInterest,
      hearAbout
    } = req.body;

    // Validate required fields
    if (!fullName || !email || !phone || !collegeName || !designTitle || !internshipInterest || !hearAbout) {
      res.status(400).json({
        success: false,
        message: 'Please fill in all required fields'
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'Design file is required'
      });
      return;
    }

    // Validate enum values
    if (!['yes', 'no'].includes(internshipInterest)) {
      res.status(400).json({
        success: false,
        message: 'Invalid internship interest value'
      });
      return;
    }

    if (!['instagram', 'whatsapp', 'college', 'friend', 'poster', 'other'].includes(hearAbout)) {
      res.status(400).json({
        success: false,
        message: 'Invalid hear about value'
      });
      return;
    }

    // Check if email already submitted
    const existingSubmission = await DesignSubmission.findOne({ email });
    if (existingSubmission) {
      res.status(400).json({
        success: false,
        message: 'You have already submitted a design with this email address'
      });
      return;
    }

    // Create new submission
    const submission = new DesignSubmission({
      fullName,
      email,
      phone,
      collegeName,
      instagram: instagram || '',
      designFile: req.file.path,
      designTitle,
      inspiration: inspiration || '',
      internshipInterest,
      hearAbout
    });

    await submission.save();

    res.status(201).json({
      success: true,
      message: 'Design submitted successfully!',
      submissionId: submission._id
    });

  } catch (error: any) {
    console.error('Error submitting design:', error);

    // Handle multer errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 10MB.'
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

// GET route to fetch all submissions (admin only)
router.get('/submissions', authMiddleware, authorizeRoles('admin'), async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const search = req.query.search as string;

    // Build query
    const query: any = {};
    if (status && ['pending', 'reviewed', 'selected', 'rejected'].includes(status)) {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { collegeName: { $regex: search, $options: 'i' } },
        { designTitle: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    const [submissions, total] = await Promise.all([
      DesignSubmission.find(query)
        .sort({ submissionDate: -1 })
        .skip(skip)
        .limit(limit),
      DesignSubmission.countDocuments(query)
    ]);

    res.json({
      success: true,
      submissions,
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        count: submissions.length,
        totalCount: total
      }
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET route to fetch single submission (admin only)
router.get('/submissions/:id', authMiddleware, authorizeRoles('admin'), async (req: Request, res: Response) => {
  try {
    const submission = await DesignSubmission.findById(req.params.id);

    if (!submission) {
      res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
      return;
    }

    res.json({
      success: true,
      submission
    });
  } catch (error) {
    console.error('Error fetching submission:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// PUT route to update submission status (admin only)
router.put('/submissions/:id/status', authMiddleware, authorizeRoles('admin'), async (req: Request, res: Response) => {
  try {
    const { status } = req.body;

    if (!['pending', 'reviewed', 'selected', 'rejected'].includes(status)) {
      res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
      return;
    }

    const submission = await DesignSubmission.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!submission) {
      res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Status updated successfully',
      submission
    });
  } catch (error) {
    console.error('Error updating submission status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET route to get submission statistics (admin only)
router.get('/submissions/stats/overview', authMiddleware, authorizeRoles('admin'), async (req: Request, res: Response) => {
  try {
    const stats = await DesignSubmission.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalSubmissions = await DesignSubmission.countDocuments();
    const recentSubmissions = await DesignSubmission.countDocuments({
      submissionDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    });

    const statusCounts = stats.reduce((acc: any, stat: any) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {});

    res.json({
      success: true,
      stats: {
        total: totalSubmissions,
        recent: recentSubmissions,
        pending: statusCounts.pending || 0,
        reviewed: statusCounts.reviewed || 0,
        selected: statusCounts.selected || 0,
        rejected: statusCounts.rejected || 0
      }
    });
  } catch (error) {
    console.error('Error fetching submission stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;