import { Router, Response } from 'express';
import { EnrollmentModel, StudentModel, CourseModel, AuditLogModel } from '../../models/index.js';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth.js';
import { EnrollmentCreateSchema } from '@classguard/shared';

export const enrollmentsRouter = Router();

enrollmentsRouter.use(authenticate);

// Get students enrolled in a course
enrollmentsRouter.get('/course/:courseId', async (req: AuthRequest, res: Response) => {
  try {
    const enrollments: any[] = await EnrollmentModel.find({
      courseId: req.params.courseId,
      status: 'ENROLLED',
    }).populate('studentId');

    return res.json({
      success: true,
      data: enrollments.map((e: any) => {
        const student = e.studentId;
        return {
          id: e._id.toString(),
          studentId: student?._id?.toString() || e.studentId.toString(),
          matricNumber: student?.matricNumber || 'UNKNOWN',
          fullName: student?.fullName || 'UNKNOWN',
          department: student?.department || '',
          level: student?.level || '',
          hasFaceEnrolled: student?.hasFaceEnrolled || false,
          academicSession: e.academicSession,
          semester: e.semester,
          status: e.status,
        };
      }),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Enroll a student in a course
enrollmentsRouter.post('/', authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = EnrollmentCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const student: any = await StudentModel.findById(parsed.data.studentId);
    if (!student) return res.status(404).json({ success: false, error: 'Student not found' });

    const course: any = await CourseModel.findById(parsed.data.courseId);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found' });

    const enrollment: any = await EnrollmentModel.findOneAndUpdate(
      {
        studentId: parsed.data.studentId,
        courseId: parsed.data.courseId,
        academicSession: parsed.data.academicSession,
        semester: parsed.data.semester,
      },
      { status: 'ENROLLED' },
      { upsert: true, new: true }
    );

    await AuditLogModel.create({
      userId: req.user?.id,
      username: req.user?.fullName,
      action: 'STUDENT_ENROLLED',
      entityType: 'Enrollment',
      entityId: enrollment._id.toString(),
      details: `Enrolled student ${student.matricNumber} into course ${course.code}`,
      timestamp: new Date(),
    });

    return res.status(201).json({ success: true, data: enrollment });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Bulk enroll students into a course
enrollmentsRouter.post('/bulk', authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { courseId, studentIds, academicSession = '2025/2026', semester = 'First' } = req.body;
    if (!courseId || !Array.isArray(studentIds)) {
      return res.status(400).json({ success: false, error: 'courseId and studentIds array are required' });
    }

    const course: any = await CourseModel.findById(courseId);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found' });

    let enrolledCount = 0;
    for (const studentId of studentIds) {
      await EnrollmentModel.findOneAndUpdate(
        { studentId, courseId, academicSession, semester },
        { status: 'ENROLLED' },
        { upsert: true }
      );
      enrolledCount++;
    }

    await AuditLogModel.create({
      userId: req.user?.id,
      username: req.user?.fullName,
      action: 'BULK_ENROLLMENT',
      entityType: 'Enrollment',
      details: `Enrolled ${enrolledCount} students into course ${course.code}`,
      timestamp: new Date(),
    });

    return res.json({ success: true, count: enrolledCount, message: `Successfully enrolled ${enrolledCount} students` });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
