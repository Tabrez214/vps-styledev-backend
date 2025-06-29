import { Router } from 'express';
import { 
  getDesign, 
  createDesign, 
  updateDesign,
  getDesignForManufacturer,
  getDesignFiles,
  validateDesign
} from '../../controllers/design-studio/designController';

const router = Router();

// Main design CRUD operations
router.post('/', createDesign);                    // POST /api/designs - Create a new design
router.get('/:id', getDesign);                     // GET /api/designs/:id - Fetch a design
router.put('/:id', updateDesign);                  // PUT /api/designs/:id - Update an existing design

// Manufacturer-specific endpoints
router.get('/:id/manufacturer', getDesignForManufacturer);  // GET /api/designs/:id/manufacturer - Manufacturing details
router.get('/:id/files', getDesignFiles);                  // GET /api/designs/:id/files - All design files
router.post('/:id/validate', validateDesign);              // POST /api/designs/:id/validate - Validate design

export default router;
