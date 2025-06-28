import { Router } from 'express';
import { getDesign, createDesign, updateDesign } from '../../controllers/design-studio/designController';

const router = Router();

// GET /api/designs/:id - Fetch a design
router.get('/:id', getDesign);

// POST /api/designs - Create a new design
router.post('/', createDesign);

// PUT /api/designs/:id - Update an existing design
router.put('/:id', updateDesign);

export default router;
