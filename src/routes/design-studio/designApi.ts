import { Router } from 'express';
import { createDesignFromFrontend, getDesignByShareableId } from '../../controllers/design-studio/designApiController';

const router = Router();

// POST /api/designs - Create a new design from frontend
router.post('/', createDesignFromFrontend);

// GET /api/designs/:shareableId - Get design by shareable ID
router.get('/:shareableId', getDesignByShareableId);

export default router;
