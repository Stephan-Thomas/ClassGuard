import crypto from 'node:crypto';
import { User, UserRole, AuthSession } from '@classguard/shared';
import { DesktopDatabaseService } from './sqlite.service.js';

interface SessionData {
  token: string;
  userId: string;
  username: string;
  email: string;
  role: UserRole;
  fullName: string;
  createdAt: number;
  expiresAt: number;
}

export class DesktopSessionService {
  private static instance: DesktopSessionService;
  private sessions: Map<string, SessionData> = new Map();
  // Session TTL: 24 hours
  private readonly SESSION_TTL_MS = 24 * 60 * 60 * 1000;

  private constructor() {}

  public static getInstance(): DesktopSessionService {
    if (!DesktopSessionService.instance) {
      DesktopSessionService.instance = new DesktopSessionService();
    }
    return DesktopSessionService.instance;
  }

  /**
   * Create a new secure session for an authenticated user.
   */
  public createSession(user: User): AuthSession {
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const expiresAt = now + this.SESSION_TTL_MS;

    const sessionData: SessionData = {
      token,
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      createdAt: now,
      expiresAt,
    };

    this.sessions.set(token, sessionData);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        active: user.active,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      expiresAt,
    };
  }

  /**
   * Authoritatively validate a session token against the account store.
   * Checks expiry, revocation, and re-verifies user account active status.
   */
  public validateSession(token: string): { valid: boolean; user?: User; error?: string } {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'No session token provided' };
    }

    const session = this.sessions.get(token);
    if (!session) {
      return { valid: false, error: 'Session not found or expired' };
    }

    // Check expiration
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      return { valid: false, error: 'Session has expired. Please sign in again.' };
    }

    // Authoritatively re-verify user from database
    const db = DesktopDatabaseService.getInstance();
    const user = db.getUserById(session.userId);
    if (!user) {
      this.sessions.delete(token);
      return { valid: false, error: 'User account no longer exists.' };
    }

    if (!user.active) {
      this.sessions.delete(token);
      return { valid: false, error: 'User account has been deactivated.' };
    }

    // Update role if changed in database
    session.role = user.role;

    return {
      valid: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        active: !!user.active,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  /**
   * Verify that the session token has one of the allowed roles.
   */
  public requireRole(
    token: string,
    allowedRoles: UserRole[]
  ): { authorized: boolean; user?: User; error?: string } {
    const val = this.validateSession(token);
    if (!val.valid || !val.user) {
      return { authorized: false, error: val.error || 'Authentication required' };
    }

    if (!allowedRoles.includes(val.user.role)) {
      return {
        authorized: false,
        error: `Forbidden: role ${val.user.role} does not have required permissions (${allowedRoles.join(', ')})`,
      };
    }

    return { authorized: true, user: val.user };
  }

  /**
   * Invalidate and revoke an active session token (Logout).
   */
  public revokeSession(token: string): boolean {
    return this.sessions.delete(token);
  }

  /**
   * Purge expired sessions.
   */
  public purgeExpired(): void {
    const now = Date.now();
    for (const [token, data] of this.sessions.entries()) {
      if (now > data.expiresAt) {
        this.sessions.delete(token);
      }
    }
  }
}
