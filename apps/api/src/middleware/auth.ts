import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { UserRole } from '@classguard/shared';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch (err: any) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

export function authorize(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access forbidden: requires ${allowedRoles.join(' or ')} privilege`,
      });
    }

    next();
  };
}

