import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserModel, AuditLogModel } from '../../models/index.js';
import { config } from '../../config/env.js';
import { authenticate, AuthRequest } from '../../middleware/auth.js';
import { LoginSchema } from '@classguard/shared';

export const authRouter = Router();

authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const parseResult = LoginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: parseResult.error.errors[0].message });
    }

    const { email, password } = parseResult.data;
    const user = await UserModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    if (!user.active) {
      return res.status(403).json({ success: false, error: 'User account is deactivated' });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        fullName: user.fullName,
      },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    // Audit log
    await AuditLogModel.create({
      userId: user._id.toString(),
      username: user.username,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user._id.toString(),
      details: `User ${user.email} logged in successfully`,
      ipAddress: req.ip,
      timestamp: new Date(),
    });

    return res.json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

authRouter.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  return res.json({ success: true, user: req.user });
});
