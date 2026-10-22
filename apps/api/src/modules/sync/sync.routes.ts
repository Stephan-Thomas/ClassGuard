import { Router, Response } from 'express';
import {
  AttendanceRecordModel,
  StudentModel,
  CourseModel,
  EnrollmentModel,
  FaceTemplateModel,
  AttendanceSessionModel,
  AuditLogModel,
} from '../../models/index.js';
import { authenticate, AuthRequest } from '../../middleware/auth.js';
import { SyncBatchSchema } from '@classguard/shared';

export const syncRouter = Router();

syncRouter.use(authenticate);

/**
 * Idempotent batch upload of offline attendance records.
 * Ensures duplicate sync attempts or re-sent events never create duplicate records.
 */
syncRouter.post('/push', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = SyncBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const { records, sourceKioskId } = parsed.data;
    const acknowledgedIds: string[] = [];
    let syncedCount = 0;
    let duplicateIgnoredCount = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const record of records) {
      try {
        // Idempotency check 1: Client record ID
        const existingByClient = await AttendanceRecordModel.findOne({ clientRecordId: record.id });
        if (existingByClient) {
          acknowledgedIds.push(record.id);
          duplicateIgnoredCount++;
          continue;
        }

        // Idempotency check 2: Student & Session uniqueness
        const existingByStudentSession = await AttendanceRecordModel.findOne({
          studentId: record.studentId,
          sessionId: record.sessionId,
        });

        if (existingByStudentSession) {
          acknowledgedIds.push(record.id);
          duplicateIgnoredCount++;
          continue;
        }

        // Insert new synced record
        await AttendanceRecordModel.create({
          clientRecordId: record.id,
          studentId: record.studentId,
          matricNumber: record.matricNumber,
          studentName: record.studentName,
          courseId: record.courseId,
          sessionId: record.sessionId,
          timestamp: new Date(record.timestamp),
          status: record.status,
          verificationMethod: record.verificationMethod,
          similarityScore: record.similarityScore,
          livenessPassed: record.livenessPassed ?? true,
          kioskId: sourceKioskId || record.id,
          notes: record.notes,
          syncStatus: 'SYNCED',
          syncedAt: new Date(),
        });

        acknowledgedIds.push(record.id);
        syncedCount++;
      } catch (itemErr: any) {
        errors.push({ id: record.id, error: itemErr.message });
      }
    }

    await AuditLogModel.create({
      userId: req.user?.id,
      username: req.user?.fullName,
      action: 'ATTENDANCE_SYNCED',
      entityType: 'AttendanceRecord',
      details: `Batch synced from ${sourceKioskId || 'kiosk'}: ${syncedCount} new, ${duplicateIgnoredCount} duplicates reconciled`,
      timestamp: new Date(),
    });

    return res.json({
      success: true,
      syncedCount,
      duplicateIgnoredCount,
      acknowledgedIds,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Download offline kiosk provisioning bundle:
 * Pre-provisions active students, courses, enrollments, face biometric templates,
 * and active sessions so the kiosk can run completely offline.
 */
syncRouter.get('/provisioning', async (req: AuthRequest, res: Response) => {
  try {
    const [students, courses, enrollments, faceTemplates, activeSessions]: any[] = await Promise.all([
      StudentModel.find({ active: true }),
      CourseModel.find({ active: true }),
      EnrollmentModel.find({ status: 'ENROLLED' }),
      FaceTemplateModel.find(),
      AttendanceSessionModel.find({ status: 'ACTIVE' }),
    ]);

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        students: students.map((s: any) => ({
          id: s._id.toString(),
          matricNumber: s.matricNumber,
          fullName: s.fullName,
          department: s.department,
          level: s.level,
          active: s.active,
          hasFaceEnrolled: s.hasFaceEnrolled,
        })),
        courses: courses.map((c: any) => ({
          id: c._id.toString(),
          code: c.code,
          title: c.title,
          department: c.department,
          level: c.level,
          creditUnits: c.creditUnits,
        })),
        enrollments: enrollments.map((e: any) => ({
          id: e._id.toString(),
          studentId: e.studentId.toString(),
          courseId: e.courseId.toString(),
          academicSession: e.academicSession,
          semester: e.semester,
        })),
        faceTemplates: faceTemplates.map((f: any) => ({
          id: f._id.toString(),
          studentId: f.studentId.toString(),
          matricNumber: f.matricNumber,
          embedding: f.embedding,
          algorithm: f.algorithm,
          version: f.version,
        })),
        activeSessions: activeSessions.map((s: any) => ({
          id: s._id.toString(),
          courseId: s.courseId.toString(),
          lecturerId: s.lecturerId.toString(),
          title: s.title,
          sessionDate: s.sessionDate,
          openingTime: s.openingTime,
          closingTime: s.closingTime,
          lateThresholdMinutes: s.lateThresholdMinutes,
          publicKey: s.publicKey,
          status: s.status,
        })),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
