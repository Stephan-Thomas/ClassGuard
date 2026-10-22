import { Router, Response } from 'express';
import {
  AttendanceRecordModel,
  AttendanceSessionModel,
  CourseModel,
  EnrollmentModel,
  StudentModel,
  LecturerModel,
} from '../../models/index.js';
import { authenticate, AuthRequest } from '../../middleware/auth.js';
import { calculateAttendancePercentage } from '@classguard/shared';

export const reportsRouter = Router();

reportsRouter.use(authenticate);

// Overall Dashboard Statistics
reportsRouter.get('/dashboard-stats', async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [totalStudents, totalLecturers, totalCourses, activeSessions, todayRecords, recentRecords] =
      await Promise.all([
        StudentModel.countDocuments({ active: true }),
        LecturerModel.countDocuments({ active: true }),
        CourseModel.countDocuments({ active: true }),
        AttendanceSessionModel.countDocuments({ status: 'ACTIVE' }),
        AttendanceRecordModel.countDocuments({
          timestamp: { $gte: new Date(`${today}T00:00:00.000Z`) },
        }),
        AttendanceRecordModel.find().sort({ timestamp: -1 }).limit(10),
      ]);

    return res.json({
      success: true,
      data: {
        totalStudents,
        totalLecturers,
        totalCourses,
        activeSessions,
        todayAttendanceCount: todayRecords,
        recentActivity: recentRecords.map((r: any) => ({
          id: r._id.toString(),
          matricNumber: r.matricNumber,
          studentName: r.studentName,
          status: r.status,
          timestamp: r.timestamp,
          verificationMethod: r.verificationMethod,
        })),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Course Attendance Summary Report
reportsRouter.get('/course/:courseId', async (req: AuthRequest, res: Response) => {
  try {
    const course: any = await CourseModel.findById(req.params.courseId);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found' });

    // Find all closed or active sessions for this course
    const sessions: any[] = await AttendanceSessionModel.find({
      courseId: course._id,
      status: { $in: ['ACTIVE', 'CLOSED'] },
    });

    const closedSessionsCount = sessions.filter((s) => s.status === 'CLOSED').length;
    const totalSessionsCount = sessions.length;

    // Get all enrolled students
    const enrollments: any[] = await EnrollmentModel.find({
      courseId: course._id,
      status: 'ENROLLED',
    }).populate('studentId');

    // Get all attendance records for this course
    const records: any[] = await AttendanceRecordModel.find({ courseId: course._id });

    const studentBreakdown = enrollments.map((e: any) => {
      const student = e.studentId;
      const studentIdStr = student?._id?.toString() || e.studentId.toString();
      const studentRecords = records.filter((r) => r.studentId.toString() === studentIdStr);

      const presentCount = studentRecords.filter((r) => r.status === 'PRESENT').length;
      const lateCount = studentRecords.filter((r) => r.status === 'LATE').length;
      const attendedCount = presentCount + lateCount;
      const absentCount = Math.max(0, closedSessionsCount - attendedCount);

      const attendancePercentage = calculateAttendancePercentage(attendedCount, closedSessionsCount);

      return {
        studentId: studentIdStr,
        matricNumber: student?.matricNumber || 'N/A',
        fullName: student?.fullName || 'N/A',
        department: student?.department || '',
        presentCount,
        lateCount,
        absentCount,
        attendedCount,
        eligibleSessions: closedSessionsCount,
        attendancePercentage,
      };
    });

    const overallAverageRate =
      studentBreakdown.length > 0
        ? Math.round(
            studentBreakdown.reduce((acc, s) => acc + s.attendancePercentage, 0) / studentBreakdown.length
          )
        : 0;

    return res.json({
      success: true,
      data: {
        course: {
          id: course._id.toString(),
          code: course.code,
          title: course.title,
          department: course.department,
          level: course.level,
        },
        totalSessionsCount,
        closedSessionsCount,
        totalEnrolled: enrollments.length,
        overallAverageRate,
        studentBreakdown,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Session-specific Attendance Report (Present, Late, Absent)
reportsRouter.get('/session/:sessionId', async (req: AuthRequest, res: Response) => {
  try {
    const session: any = await AttendanceSessionModel.findById(req.params.sessionId)
      .populate('courseId')
      .populate('lecturerId');

    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });

    const courseId = session.courseId?._id || session.courseId;
    const enrollments: any[] = await EnrollmentModel.find({ courseId, status: 'ENROLLED' }).populate('studentId');

    const records: any[] = await AttendanceRecordModel.find({ sessionId: session._id });

    const presentStudents: any[] = [];
    const lateStudents: any[] = [];
    const attendedStudentIds = new Set<string>();

    for (const record of records) {
      attendedStudentIds.add(record.studentId.toString());
      const item = {
        studentId: record.studentId.toString(),
        matricNumber: record.matricNumber,
        studentName: record.studentName,
        timestamp: record.timestamp,
        verificationMethod: record.verificationMethod,
        similarityScore: record.similarityScore,
      };

      if (record.status === 'PRESENT') {
        presentStudents.push(item);
      } else if (record.status === 'LATE') {
        lateStudents.push(item);
      }
    }

    // Only compute absent list if session has completed/closed, per specifications
    const absentStudents: any[] = [];
    for (const enrollment of enrollments) {
      const student = enrollment.studentId;
      const sId = student?._id?.toString() || enrollment.studentId.toString();
      if (!attendedStudentIds.has(sId)) {
        absentStudents.push({
          studentId: sId,
          matricNumber: student?.matricNumber || 'N/A',
          studentName: student?.fullName || 'N/A',
          department: student?.department || '',
        });
      }
    }

    return res.json({
      success: true,
      data: {
        session: {
          id: session._id.toString(),
          title: session.title,
          sessionDate: session.sessionDate,
          openingTime: session.openingTime,
          closingTime: session.closingTime,
          status: session.status,
          courseCode: session.courseId?.code,
          courseTitle: session.courseId?.title,
        },
        enrolledCount: enrollments.length,
        presentCount: presentStudents.length,
        lateCount: lateStudents.length,
        absentCount: absentStudents.length,
        presentStudents,
        lateStudents,
        absentStudents: session.status === 'CLOSED' ? absentStudents : [],
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
