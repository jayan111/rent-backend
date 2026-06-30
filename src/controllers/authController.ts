import { Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AuthenticatedRequest } from '../types';
import { getDB } from '../config/database';
import { RowDataPacket } from 'mysql2';
import { sendPasswordResetEmail } from '../services/email';

interface UserRow extends RowDataPacket {
  id: string;
  email: string;
  password: string;
  name: string;
  phone: string;
  role: 'user' | 'admin';
  address: string;
  is_active: boolean;
  reset_token?: string;
  reset_token_expiry?: Date;
  refresh_token?: string;
  must_change_password: boolean;
  created_at: Date;
  updated_at: Date;
}

const generateTokens = (userId: string, email: string, role: string) => {
  const accessToken = jwt.sign(
    { userId, email, role },
    process.env.JWT_SECRET || 'fallback-secret',
    { expiresIn: '15m' }
  );
  
  const refreshToken = jwt.sign(
    { userId, email, role, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
    { expiresIn: '7d' }
  );
  
  return { accessToken, refreshToken };
};

export const login = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const db = await getDB();
    if (!db) {
      return res.status(500).json({ message: 'Database connection failed' });
    }

    const [users] = await db.query<UserRow[]>(
      'SELECT * FROM users WHERE email = ? AND is_active = TRUE',
      [email]
    );

    if (!users || users.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = users[0];
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.role);

    // Store refresh token in database
    await db.query(
      'UPDATE users SET refresh_token = ? WHERE id = ?',
      [refreshToken, user.id]
    );

    res.json({
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
          address: user.address ? JSON.parse(user.address) : null,
          must_change_password: !!user.must_change_password,
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const register = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, email, password, phone, address } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    const db = await getDB();
    if (!db) {
      return res.status(500).json({ message: 'Database connection failed' });
    }

    const [existingUsers] = await db.query<UserRow[]>(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers && existingUsers.length > 0) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = `user_${Date.now()}`;
    const { accessToken, refreshToken } = generateTokens(userId, email, 'user');

    await db.query(
      `INSERT INTO users (id, name, email, phone, password, address, refresh_token) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        name,
        email,
        phone || null,
        hashedPassword,
        address ? JSON.stringify(address) : null,
        refreshToken
      ]
    );

    res.status(201).json({
      message: 'Registration successful',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: userId,
          email,
          name,
          phone,
          role: 'user',
          address
        }
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const refreshToken = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    const db = await getDB();
    if (!db) {
      return res.status(500).json({ message: 'Database connection failed' });
    }

    try {
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret'
      ) as any;

      if (decoded.type !== 'refresh') {
        return res.status(401).json({ message: 'Invalid token type' });
      }

      const [users] = await db.query<UserRow[]>(
        'SELECT * FROM users WHERE id = ? AND refresh_token = ? AND is_active = TRUE',
        [decoded.userId, refreshToken]
      );

      if (!users || users.length === 0) {
        return res.status(401).json({ message: 'Invalid refresh token' });
      }

      const user = users[0];
      const { accessToken, refreshToken: newRefreshToken } = generateTokens(
        user.id,
        user.email,
        user.role
      );

      // Update refresh token in database
      await db.query(
        'UPDATE users SET refresh_token = ? WHERE id = ?',
        [newRefreshToken, user.id]
      );

      res.json({
        message: 'Token refreshed successfully',
        data: {
          accessToken,
          refreshToken: newRefreshToken
        }
      });
    } catch (jwtError) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const logout = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (userId) {
      const db = await getDB();
      if (db) {
        await db.query(
          'UPDATE users SET refresh_token = NULL WHERE id = ?',
          [userId]
        );
      }
    }

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { name, phone, address } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const db = await getDB();
    if (!db) {
      return res.status(500).json({ message: 'Database connection failed' });
    }

    const updateFields = [];
    const values = [];

    if (name) {
      updateFields.push('name = ?');
      values.push(name);
    }
    if (phone) {
      updateFields.push('phone = ?');
      values.push(phone);
    }
    if (address) {
      updateFields.push('address = ?');
      values.push(JSON.stringify(address));
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    values.push(userId);

    await db.query(
      `UPDATE users SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );

    const [users] = await db.query<UserRow[]>(
      'SELECT id, name, email, phone, role, address FROM users WHERE id = ?',
      [userId]
    );

    const user = users[0];
    res.json({
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
          address: user.address ? JSON.parse(user.address) : null
        }
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const forgotPassword = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const db = await getDB();
    if (!db) {
      return res.status(500).json({ message: 'Database connection failed' });
    }

    const [users] = await db.query<UserRow[]>(
      'SELECT * FROM users WHERE email = ? AND is_active = TRUE',
      [email]
    );

    // Always return success to avoid email enumeration
    if (!users || users.length === 0) {
      return res.json({ message: 'If that email exists, a reset link has been sent' });
    }

    const user = users[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await db.query(
      'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE email = ?',
      [resetToken, resetTokenExpiry, email]
    );

    const isAdmin = user.role === 'admin';
    try {
      await sendPasswordResetEmail(email, resetToken, user.name || email.split('@')[0], isAdmin);
    } catch (emailErr) {
      console.error('Failed to send reset email:', emailErr);
      return res.status(500).json({ message: 'Failed to send reset email. Please try again.' });
    }

    res.json({ message: 'If that email exists, a reset link has been sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// First-time password set for auto-created accounts (no current password required)
export const setPassword = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const [users] = await db.query<UserRow[]>(
      'SELECT must_change_password FROM users WHERE id = ? AND is_active = TRUE',
      [userId]
    );

    if (!users?.length) return res.status(404).json({ message: 'User not found' });
    if (!users[0].must_change_password) {
      return res.status(403).json({ message: 'Password change not required. Use change-password instead.' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await db.query(
      'UPDATE users SET password = ?, must_change_password = 0, updated_at = NOW() WHERE id = ?',
      [hashed, userId]
    );

    res.json({ message: 'Password set successfully' });
  } catch (error) {
    console.error('Set password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const resetPassword = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' });
    }

    const db = await getDB();
    if (!db) {
      return res.status(500).json({ message: 'Database connection failed' });
    }

    const [users] = await db.query<UserRow[]>(
      'SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > NOW() AND is_active = TRUE',
      [token]
    );

    if (!users || users.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      'UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE reset_token = ?',
      [hashedPassword, token]
    );

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const verifyToken = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    res.json({
      message: 'Token valid',
      data: {
        user: req.user
      }
    });
  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const changePassword = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new passwords are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const db = await getDB();
    if (!db) return res.status(500).json({ message: 'Database connection failed' });

    const [users] = await db.query<UserRow[]>(
      'SELECT id, password FROM users WHERE id = ? AND is_active = TRUE',
      [userId]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [hashedPassword, userId]);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};