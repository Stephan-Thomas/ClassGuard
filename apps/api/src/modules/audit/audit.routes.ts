import { Router, Response } from 'express';
import { AuditLogModel } from '../../models/index.js';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth.js';

export const auditRouter = Router();

auditRouter.use(authenticate);

auditRouter.get('/', authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { action, entityType, limit = '100' } = req.query;
    const filter: Record<string, any> = {};
    if (action) filter.action = action;
    if (entityType) filter.entityType = entityType;

    const limitNum = Math.min(200, parseInt(String(limit), 10) || 100);
    const logs: any[] = await AuditLogModel.find(filter).sort({ timestamp: -1 }).limit(limitNum);

    return res.json({
      success: true,
      data: logs.map((l: any) => ({
        id: l._id.toString(),
        userId: l.userId,
        username: l.username,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        details: l.details,
        ipAddress: l.ipAddress,
        timestamp: l.timestamp,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
