import { Request, Response } from 'express';
import Design from '../../models/design-studio/design';

// Get a design by its ID
export const getDesign = async (req: Request, res: Response) => {
  try {
    const design = await Design.findById(req.params.id);
    if (!design) {
      res.status(404).json({ message: 'Design not found' });
      return
    }
    // Optional: Check if the design belongs to the requesting user
    // if (design.userId.toString() !== req.user.id) {
    //   return res.status(403).json({ message: 'User not authorized' });
    // }
    res.status(200).json(design);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching design', error });
  }
};

// Create a new design
export const createDesign = async (req: Request, res: Response) => {
  try {
    const { name, elements, tshirt, shareableId, metadata, dimensions, isPublic } = req.body;
    
    // Create new design with all required fields
    const newDesign = new Design({
      name,
      elements,
      tshirt,
      shareableId,
      metadata,
      dimensions,
      isPublic: isPublic || false
    });
    
    await newDesign.save();
    res.status(201).json({
      success: true,
      data: {
        _id: newDesign._id,
        shareableId: newDesign.shareableId,
        name: newDesign.name
      },
      message: 'Design saved successfully'
    });
  } catch (error) {
    console.error('Error creating design:', error);
    res.status(400).json({ message: 'Error creating design', error });
  }
};

// Update an existing design
export const updateDesign = async (req: Request, res: Response) => {
  try {
    const { name, elements } = req.body;
    const updatedDesign = await Design.findByIdAndUpdate(
      req.params.id,
      { name, elements, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!updatedDesign) {
      res.status(404).json({ message: 'Design not found' });
      return;
    }
    res.status(200).json(updatedDesign);
  } catch (error) {
    res.status(400).json({ message: 'Error updating design', error });
  }
};
