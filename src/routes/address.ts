import express from "express";
import { Request, Response } from "express";
import Address from "../models/address";
import { authMiddleware, RequestWithUser } from '../middleware/authMiddleware';
import addressSchema from "../schemas/address";

const router = express.Router();

// Add a new address
router.post("/", authMiddleware, async (req: RequestWithUser, res: Response) => {
  try {
    const validationResult = addressSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({ error: validationResult.error.errors });
      return;
    }
    const { fullName, phoneNumber, streetAddress, city, state, country, postalCode, gstNumber, isDefault } = validationResult.data;
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const userId = req.user.userId; // Get user from auth middleware

    // If the user sets this address as default, update other addresses
    if (isDefault) {
      await Address.updateMany({ user: userId }, { $set: { isDefault: false } });
    }

    const address = new Address({
      user: userId,
      fullName,
      phoneNumber,
      streetAddress,
      city,
      state,
      country,
      postalCode,
      gstNumber,
      isDefault,
    });

    await address.save();
    res.status(201).json({ message: "Address added successfully", address });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Get all addresses for a user
router.get("/", authMiddleware, async (req: RequestWithUser, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const addresses = await Address.find({ user: req.user.userId });
    res.json(addresses);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Update an address
router.put("/:id", authMiddleware, async (req: RequestWithUser, res: Response) => {
  try {
    const { fullName, phoneNumber, streetAddress, city, state, country, postalCode, gstNumber, isDefault } = req.body;
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const userId = req.user.userId;
    const addressId = req.params.id;

    // If updating the default address, make sure to update others
    if (isDefault) {
      await Address.updateMany({ user: userId }, { $set: { isDefault: false } });
    }

    const updatedAddress = await Address.findOneAndUpdate(
      { _id: addressId, user: userId },
      { fullName, phoneNumber, streetAddress, city, state, country, postalCode, gstNumber, isDefault },
      { new: true }
    );

    if (!updatedAddress) {
      res.status(404).json({ error: "Address not found" });
      return;
    }

    res.json(updatedAddress);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Delete an address
router.delete("/:id", authMiddleware, async (req: RequestWithUser, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const deletedAddress = await Address.findOneAndDelete({ _id: req.params.id, user: req.user.userId });

    if (!deletedAddress) {
      res.status(404).json({ error: "Address not found" });
      return;
    }

    res.json({ message: "Address deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
