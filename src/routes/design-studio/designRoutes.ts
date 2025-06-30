import { Router } from 'express';
import { 
  getDesign, 
  createDesign, 
  updateDesign,
  getDesignForManufacturer,
  getDesignFiles,
  validateDesign,
  sendDesignEmailManually
} from '../../controllers/design-studio/designController';

const router = Router();

// Main design CRUD operations
router.post('/', createDesign);                    // POST /designs - Create a new design
router.get('/:id', getDesign);                     // GET /designs/:id - Fetch a design
router.put('/:id', updateDesign);                  // PUT /designs/:id - Update an existing design

// Manufacturer-specific endpoints
router.get('/:id/manufacturer', getDesignForManufacturer);  // GET /designs/:id/manufacturer - Manufacturing details
router.get('/:id/files', getDesignFiles);                  // GET /designs/:id/files - All design files
router.post('/:id/validate', validateDesign);              // POST /designs/:id/validate - Validate design

// Email functionality
router.post('/send-email', sendDesignEmailManually);       // POST /designs/send-email - Send design email manually

export default router;
