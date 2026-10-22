import { ipcMain, BrowserWindow } from 'electron';
import bcrypt from 'bcryptjs';
import { DesktopDatabaseService } from '../services/sqlite.service.js';
import { AttendanceService } from '../services/attendance.service.js';
import { EnrollmentService } from '../services/enrollment.service.js';
import { DesktopSyncService } from '../services/sync.service.js';
import {
  createSignedQRToken,
  generateSessionKeyPair,
  calculateAttendancePercentage,
} from '@classguard/shared';

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  const db = DesktopDatabaseService.getInstance();
  const attendanceService = AttendanceService.getInstance();
  const enrollmentService = EnrollmentService.getInstance();
  const syncService = DesktopSyncService.getInstance();

  // --- Auth ---
  ipcMain.handle('auth:login', async (_, { email, password }) => {
    try {
      const user = db.getUserByEmail(email);
      if (!user) return { success: false, error: 'Invalid email or password' };
      if (!user.active) return { success: false, error: 'User account is deactivated' };

      const matches = await bcrypt.compare(password, user.passwordHash);
      if (!matches) return { success: false, error: 'Invalid email or password' };

      db.logAudit(user.id, user.fullName, 'LOCAL_LOGIN', 'User', user.id, `User ${user.email} logged into desktop app`);

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          fullName: user.fullName,
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // --- Students ---
  ipcMain.handle('students:list', async (_, search?: string) => {
    return { success: true, data: db.getStudents(search) };
  });

  ipcMain.handle('students:get', async (_, idOrMatric: string) => {
    const student = idOrMatric.startsWith('stu-')
      ? db.getStudentById(idOrMatric)
      : db.getStudentByMatric(idOrMatric);
    if (!student) return { success: false, error: 'Student not found' };
    return { success: true, data: student };
  });

  ipcMain.handle('students:create', async (_, data) => {
    return await enrollmentService.registerStudent(data);
  });

  ipcMain.handle('students:update', async (_, { id, data }) => {
    return await enrollmentService.updateStudent(id, data);
  });

  ipcMain.handle('students:delete', async (_, id: string) => {
    return await enrollmentService.deleteStudent(id);
  });

  ipcMain.handle('students:enrollFace', async (_, { studentId, embedding, qualityScore }) => {
    return await enrollmentService.enrollFace({ studentId, embedding, qualityScore });
  });

  ipcMain.handle('students:deleteFace', async (_, studentId: string) => {
    return await enrollmentService.deleteFace(studentId);
  });

  ipcMain.handle('students:generateQrCredential', async (_, studentId: string) => {
    return await enrollmentService.generateStudentQrCredential(studentId);
  });

  ipcMain.handle('students:getEnrollmentStatusList', async (_, search?: string) => {
    return { success: true, data: enrollmentService.getEnrollmentStatusList(search) };
  });

  // --- Courses ---
  ipcMain.handle('courses:list', async () => {
    return { success: true, data: db.getCourses() };
  });

  ipcMain.handle('courses:create', async (_, data) => {
    try {
      const course = db.createCourse(data);
      db.logAudit(undefined, 'Admin', 'COURSE_CREATED', 'Course', course.id, `Created course ${course.code}`);
      return { success: true, data: course };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // --- Lecturers ---
  ipcMain.handle('lecturers:list', async () => {
    return { success: true, data: db.getLecturers() };
  });

  // --- Enrollments ---
  ipcMain.handle('enrollments:byCourse', async (_, courseId: string) => {
    return { success: true, data: db.getEnrollmentsByCourse(courseId) };
  });

  ipcMain.handle('enrollments:enroll', async (_, { studentId, courseId }) => {
    try {
      db.enrollStudent(studentId, courseId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('enrollments:bulk', async (_, { courseId, studentIds }) => {
    try {
      for (const sId of studentIds) {
        db.enrollStudent(sId, courseId);
      }
      return { success: true, count: studentIds.length };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // --- Attendance Sessions ---
  ipcMain.handle('sessions:list', async (_, courseId?: string) => {
    return { success: true, data: db.getSessions(courseId) };
  });

  ipcMain.handle('sessions:get', async (_, id: string) => {
    const session = db.getSessionById(id);
    if (!session) return { success: false, error: 'Session not found' };
    const records = db.getRecordsBySession(id);
    const enrollments = db.getEnrollmentsByCourse(session.courseId);

    const presentCount = records.filter((r) => r.status === 'PRESENT').length;
    const lateCount = records.filter((r) => r.status === 'LATE').length;

    return {
      success: true,
      data: {
        session,
        enrolledCount: enrollments.length,
        presentCount,
        lateCount,
        records,
      },
    };
  });

  ipcMain.handle('sessions:create', async (_, data) => {
    try {
      // Generate Ed25519 keypair for session-specific signed QR tokens
      const keypair = generateSessionKeyPair();

      const session = db.createSession({
        ...data,
        publicKey: keypair.publicKey,
        privateKey: keypair.privateKey,
      });

      db.logAudit(undefined, 'Lecturer', 'SESSION_CREATED', 'AttendanceSession', session.id, `Created session ${session.title}`);
      return { success: true, data: session };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sessions:close', async (_, id: string) => {
    try {
      db.closeSession(id);
      db.logAudit(undefined, 'Lecturer', 'SESSION_CLOSED', 'AttendanceSession', id, `Closed session ${id}`);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Generate real-time signed QR token using session's private key
  ipcMain.handle('sessions:generateToken', async (_, { sessionId, ttlSeconds = 30 }) => {
    try {
      const session: any = db.getSessionById(sessionId);
      if (!session) return { success: false, error: 'Session not found' };
      if (session.status !== 'ACTIVE') return { success: false, error: 'Session is not active' };
      if (!session.privateKey || !session.publicKey) {
        return { success: false, error: 'Session lacks cryptographic signing keys' };
      }

      const { tokenString, tokenObject } = createSignedQRToken({
        sessionId: session.id,
        courseId: session.courseId,
        courseCode: session.courseCode || 'N/A',
        privateKeyPem: session.privateKey,
        publicKeyPem: session.publicKey,
        ttlSeconds,
      });

      return { success: true, tokenString, tokenObject };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // --- Kiosk Verification & Attendance ---
  ipcMain.handle('kiosk:verifyFaceAndRecord', async (_, payload) => {
    return await attendanceService.verifyFaceAndRecord(payload);
  });

  ipcMain.handle('kiosk:verifyQrFallbackAndRecord', async (_, payload) => {
    return await attendanceService.verifyQrFallbackAndRecord(payload);
  });

  ipcMain.handle('sessions:lecturerOverrideAttendance', async (_, payload) => {
    return await attendanceService.recordLecturerOverride(payload);
  });

  ipcMain.handle('kiosk:verifyAndRecord', async (_, payload) => {
    return await attendanceService.processAttendanceAttempt(payload);
  });

  // --- Reports & Summaries ---
  ipcMain.handle('reports:courseSummary', async (_, courseId: string) => {
    try {
      const course = db.getCourseById(courseId);
      if (!course) return { success: false, error: 'Course not found' };

      const sessions = db.getSessions(courseId);
      const closedSessions = sessions.filter((s) => s.status === 'CLOSED');
      const enrollments = db.getEnrollmentsByCourse(courseId);
      const records = db.getRecordsByCourse(courseId);

      const breakdown = enrollments.map((e) => {
        const studentRecords = records.filter((r) => r.studentId === e.studentId);
        const presentCount = studentRecords.filter((r) => r.status === 'PRESENT').length;
        const lateCount = studentRecords.filter((r) => r.status === 'LATE').length;
        const attendedCount = presentCount + lateCount;
        const absentCount = Math.max(0, closedSessions.length - attendedCount);
        const attendancePercentage = calculateAttendancePercentage(attendedCount, closedSessions.length);

        return {
          studentId: e.studentId,
          matricNumber: e.studentMatric || 'N/A',
          studentName: e.studentName || 'N/A',
          presentCount,
          lateCount,
          absentCount,
          attendedCount,
          eligibleSessions: closedSessions.length,
          attendancePercentage,
        };
      });

      const averageRate =
        breakdown.length > 0
          ? Math.round(breakdown.reduce((acc, b) => acc + b.attendancePercentage, 0) / breakdown.length)
          : 0;

      return {
        success: true,
        data: {
          course,
          totalSessions: sessions.length,
          closedSessions: closedSessions.length,
          enrolledCount: enrollments.length,
          averageRate,
          studentBreakdown: breakdown,
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('reports:exportCsv', async (_, courseId: string) => {
    try {
      const course = db.getCourseById(courseId);
      if (!course) return { success: false, error: 'Course not found' };

      const sessions = db.getSessions(courseId).filter((s) => s.status === 'CLOSED');
      const enrollments = db.getEnrollmentsByCourse(courseId);
      const records = db.getRecordsByCourse(courseId);

      let csv = 'Matriculation Number,Student Name,Present,Late,Absent,Total Attended,Eligible Sessions,Attendance Percentage\n';

      for (const e of enrollments) {
        const studentRecords = records.filter((r) => r.studentId === e.studentId);
        const presentCount = studentRecords.filter((r) => r.status === 'PRESENT').length;
        const lateCount = studentRecords.filter((r) => r.status === 'LATE').length;
        const attendedCount = presentCount + lateCount;
        const absentCount = Math.max(0, sessions.length - attendedCount);
        const pct = calculateAttendancePercentage(attendedCount, sessions.length);

        csv += `"${e.studentMatric}","${e.studentName}",${presentCount},${lateCount},${absentCount},${attendedCount},${sessions.length},${pct}%\n`;
      }

      return { success: true, csv, filename: `${course.code}_Attendance_Report.csv` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // --- Sync ---
  ipcMain.handle('sync:getStatus', async () => {
    return { success: true, data: db.getSyncStatus() };
  });

  ipcMain.handle('sync:syncNow', async () => {
    return await syncService.syncPendingRecords();
  });

  ipcMain.handle('sync:checkOnline', async () => {
    return await syncService.checkConnectivity();
  });

  ipcMain.handle('sync:pullProvisioning', async () => {
    return await syncService.pullProvisioningBundle();
  });

  // --- Audit ---
  ipcMain.handle('audit:list', async (_, limit?: number) => {
    return { success: true, data: db.getAuditLogs(limit) };
  });

  // --- System Window & Kiosk ---
  ipcMain.handle('system:toggleFullscreen', async () => {
    const isFull = mainWindow.isFullScreen();
    mainWindow.setFullScreen(!isFull);
    return { isFullScreen: !isFull };
  });

  ipcMain.handle('system:isFullscreen', async () => {
    return { isFullScreen: mainWindow.isFullScreen() };
  });
}
