import { Router, Response } from 'express';
import {
  AttendanceSessionModel,
  AttendanceRecordModel,
  CourseModel,
  EnrollmentModel,
  AuditLogModel,
} from '../../models/index.js';
import { authenticate, AuthRequest } from '../../middleware/auth.js';
import { AttendanceSessionCreateSchema } from '@classguard/shared';

export const sessionsRouter = Router();

sessionsRouter.use(authenticate);

// List sessions
sessionsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { courseId, status } = req.query;
    const filter: Record<string, any> = {};
    if (courseId) filter.courseId = courseId;
    if (status) filter.status = status;

    const sessions: any[] = await AttendanceSessionModel.find(filter)
      .populate('courseId')
      .populate('lecturerId')
      .sort({ sessionDate: -1, openingTime: -1 });

    const formatted = await Promise.all(
      sessions.map(async (s: any) => {
        const recordCount = await AttendanceRecordModel.countDocuments({ sessionId: s._id });
        const course = s.courseId;
        const lecturer = s.lecturerId;
        return {
          id: s._id.toString(),
          courseId: course?._id?.toString() || s.courseId?.toString(),
          courseCode: course?.code || 'N/A',
          courseTitle: course?.title || 'N/A',
          lecturerId: lecturer?._id?.toString() || s.lecturerId?.toString(),
          lecturerName: lecturer?.fullName || 'N/A',
          title: s.title,
          sessionDate: s.sessionDate,
          openingTime: s.openingTime,
          closingTime: s.closingTime,
          lateThresholdMinutes: s.lateThresholdMinutes,
          status: s.status,
          publicKey: s.publicKey,
          qrRotateSeconds: s.qrRotateSeconds,
          attendanceCount: recordCount,
          createdAt: s.createdAt,
        };
      })
    );

    return res.json({ success: true, data: formatted });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Get session details with live attendees
sessionsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const session: any = await AttendanceSessionModel.findById(req.params.id)
      .populate('courseId')
      .populate('lecturerId');

    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });

    const records: any[] = await AttendanceRecordModel.find({ sessionId: session._id }).sort({ timestamp: -1 });

    const courseId = session.courseId?._id || session.courseId;
    const enrolledCount = await EnrollmentModel.countDocuments({
      courseId,
      status: 'ENROLLED',
    });

    const presentCount = records.filter((r) => r.status === 'PRESENT').length;
    const lateCount = records.filter((r) => r.status === 'LATE').length;

    return res.json({
      success: true,
      data: {
        id: session._id.toString(),
        session: {
          id: session._id.toString(),
          title: session.title,
          sessionDate: session.sessionDate,
          openingTime: session.openingTime,
          closingTime: session.closingTime,
          lateThresholdMinutes: session.lateThresholdMinutes,
          status: session.status,
          courseCode: session.courseId?.code,
          courseTitle: session.courseId?.title,
          lecturerName: session.lecturerId?.fullName,
        },
        enrolledCount,
        presentCount,
        lateCount,
        records: records.map((r) => ({
          id: r._id.toString(),
          clientRecordId: r.clientRecordId,
          matricNumber: r.matricNumber,
          studentName: r.studentName,
          timestamp: r.timestamp,
          status: r.status,
          verificationMethod: r.verificationMethod,
          similarityScore: r.similarityScore,
          notes: r.notes,
        })),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Create attendance session
sessionsRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = AttendanceSessionCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const course: any = await CourseModel.findById(parsed.data.courseId);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found' });

    const session: any = await AttendanceSessionModel.create({
      courseId: parsed.data.courseId,
      lecturerId: parsed.data.lecturerId,
      title: parsed.data.title,
      sessionDate: parsed.data.sessionDate,
      openingTime: parsed.data.openingTime,
      closingTime: parsed.data.closingTime,
      lateThresholdMinutes: parsed.data.lateThresholdMinutes,
      qrRotateSeconds: parsed.data.qrRotateSeconds,
      status: 'ACTIVE',
      publicKey: req.body.publicKey || undefined,
    });

    await AuditLogModel.create({
      userId: req.user?.id,
      username: req.user?.fullName,
      action: 'SESSION_CREATED',
      entityType: 'AttendanceSession',
      entityId: session._id.toString(),
      details: `Created attendance session "${session.title}" for course ${course.code}`,
      timestamp: new Date(),
    });

    return res.status(201).json({
      success: true,
      data: {
        id: session._id.toString(),
        title: session.title,
        status: session.status,
        sessionDate: session.sessionDate,
        openingTime: session.openingTime,
        closingTime: session.closingTime,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Close attendance session
sessionsRouter.post('/:id/close', async (req: AuthRequest, res: Response) => {
  try {
    const session: any = await AttendanceSessionModel.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });

    session.status = 'CLOSED';
    await session.save();

    await AuditLogModel.create({
      userId: req.user?.id,
      username: req.user?.fullName,
      action: 'SESSION_CLOSED',
      entityType: 'AttendanceSession',
      entityId: session._id.toString(),
      details: `Closed attendance session ${session._id}`,
      timestamp: new Date(),
    });

    return res.json({ success: true, message: 'Attendance session successfully closed' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
