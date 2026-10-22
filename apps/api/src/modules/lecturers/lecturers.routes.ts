import { Router, Response } from 'express';
import { LecturerModel, AuditLogModel } from '../../models/index.js';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth.js';
import { LecturerCreateSchema } from '@classguard/shared';

export const lecturersRouter = Router();

lecturersRouter.use(authenticate);

lecturersRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const lecturers: any[] = await LecturerModel.find({ active: true }).sort({ fullName: 1 });
    return res.json({
      success: true,
      data: lecturers.map((l: any) => ({
        id: l._id.toString(),
        staffId: l.staffId,
        fullName: l.fullName,
        email: l.email,
        department: l.department,
        active: l.active,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

lecturersRouter.post('/', authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = LecturerCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const lecturer: any = await LecturerModel.create(parsed.data);

    await AuditLogModel.create({
      userId: req.user?.id,
      username: req.user?.fullName,
      action: 'LECTURER_CREATED',
      entityType: 'Lecturer',
      entityId: lecturer._id.toString(),
      details: `Created lecturer ${lecturer.fullName} (${lecturer.staffId})`,
      timestamp: new Date(),
    });

    return res.status(201).json({
      success: true,
      data: {
        id: lecturer._id.toString(),
        staffId: lecturer.staffId,
        fullName: lecturer.fullName,
        email: lecturer.email,
        department: lecturer.department,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
