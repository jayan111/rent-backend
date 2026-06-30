import express from 'express';
import { login, register, forgotPassword, resetPassword, verifyToken, refreshToken, logout, updateProfile, changePassword, setPassword } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.post('/refresh-token', refreshToken);
router.post('/logout', authenticateToken, logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/verify', authenticateToken, verifyToken);
router.put('/profile', authenticateToken, updateProfile);
router.post('/change-password', authenticateToken, changePassword);
router.post('/set-password', authenticateToken, setPassword);

export default router;