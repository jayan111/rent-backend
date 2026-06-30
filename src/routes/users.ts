import express from 'express';
import {
  getUserProfile,
  updateProfile,
  uploadKYCDocument,
  verifyKYC,
  getAllUsers,
  getUserStats
} from '../controllers/userController';

const router = express.Router();

// User profile routes
router.get('/profile', getUserProfile);
router.patch('/profile', updateProfile);

// KYC routes
router.post('/kyc', uploadKYCDocument);
router.patch('/kyc/:userId/verify', verifyKYC);

// Admin user management routes
router.get('/', getAllUsers);
router.get('/stats', getUserStats);

export default router;