import { Router, Response } from 'express';
import { CourseModel, LecturerModel, EnrollmentModel, AuditLogModel } from '../../models/index.js';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth.js';
import { CourseCreateSchema } from '@classguard/shared';

export const coursesRouter = Router();

coursesRouter.use(authenticate);

coursesRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const filter: Record<string, any> = { active: true };
    if (req.user?.role === 'LECTURER') {
      const lecturer: any = await LecturerModel.findOne({ email: req.user.email });
      if (lecturer) {
        filter.lecturerId = lecturer._id;
      }
    }

    const courses: any[] = await CourseModel.find(filter).populate('lecturerId').sort({ code: 1 });

    const coursesWithCounts = await Promise.all(
      courses.map(async (c: any) => {
        const enrolledCount = await EnrollmentModel.countDocuments({ courseId: c._id, status: 'ENROLLED' });
        return {
          id: c._id.toString(),
          code: c.code,
          title: c.title,
          department: c.department,
          level: c.level,
          creditUnits: c.creditUnits,
          lecturerId: c.lecturerId ? c.lecturerId._id?.toString() : undefined,
          lecturerName: c.lecturerId ? c.lecturerId.fullName : undefined,
          enrolledStudentsCount: enrolledCount,
          active: c.active,
        };
      })
    );

    return res.json({ success: true, data: coursesWithCounts });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

coursesRouter.post('/', authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = CourseCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const existing = await CourseModel.findOne({ code: parsed.data.code.toUpperCase() });
    if (existing) {
      return res.status(409).json({ success: false, error: 'A course with this code already exists' });
    }

    const course: any = await CourseModel.create({
      code: parsed.data.code.toUpperCase(),
      title: parsed.data.title,
      department: parsed.data.department,
      level: parsed.data.level,
      creditUnits: parsed.data.creditUnits,
      lecturerId: parsed.data.lecturerId || undefined,
    });

    await AuditLogModel.create({
      userId: req.user?.id,
      username: req.user?.fullName,
      action: 'COURSE_CREATED',
      entityType: 'Course',
      entityId: course._id.toString(),
      details: `Created course ${course.code}: ${course.title}`,
      timestamp: new Date(),
    });

    return res.status(201).json({
      success: true,
      data: {
        id: course._id.toString(),
        code: course.code,
        title: course.title,
        department: course.department,
        level: course.level,
        creditUnits: course.creditUnits,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
