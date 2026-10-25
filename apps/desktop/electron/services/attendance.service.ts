import crypto from 'node:crypto';
import { DesktopDatabaseService } from './sqlite.service.js';
import { FaceVerificationProvider } from './face-verification.provider.js';
import { QrVerificationProvider } from './qr-verification.provider.js';
import { ManualAttendanceOverrideService } from './manual-override.service.js';
import {
  evaluateAttendanceStatus,
  AttendanceRecord,
  VerificationMethod,
  DEFAULT_EUCLIDEAN_THRESHOLD,
  verifySignedQRToken,
  isValidMatricNumber,
} from '@classguard/shared';

export interface FaceAttendanceParams {
  matricNumber: string;
  sessionId?: string;
  courseId?: string;
  capturedEmbedding?: number[];
  testSimulatedMatch?: boolean;
  threshold?: number;
  kioskId?: string;
}

export interface QrFallbackAttendanceParams {
  studentQrCredentialString: string;
  sessionId?: string;
  courseId?: string;
  matricNumber?: string;
  kioskId?: string;
}

export interface LecturerOverrideParams {
  studentId: string;
  sessionId: string;
  lecturerId: string;
  overrideReason: string;
  kioskId?: string;
}

export interface AttendanceResult {
  success: boolean;
  statusCode:
    | 'SUCCESS'
    | 'STUDENT_NOT_FOUND'
    | 'NOT_ENROLLED'
    | 'NO_ACTIVE_SESSION'
    | 'SESSION_CLOSED'
    | 'ALREADY_MARKED'
    | 'NO_FACE_ENROLLED'
    | 'FACE_MISMATCH'
    | 'NO_FACE_DETECTED'
    | 'INVALID_QR_CREDENTIAL'
    | 'UNAUTHORIZED_LECTURER'
    | 'MISSING_REASON'
    | 'ERROR';
  message: string;
  record?: AttendanceRecord;
  studentName?: string;
  matricNumber?: string;
  attendanceStatus?: 'PRESENT' | 'LATE' | 'EXCUSED';
  verificationMethod?: VerificationMethod;
  similarityScore?: number;
  courseCode?: string;
  timestamp?: string;
}

export class AttendanceService {
  private static instance: AttendanceService;
  private db: DesktopDatabaseService;
  private faceProvider: FaceVerificationProvider;
  private qrProvider: QrVerificationProvider;
  private overrideService: ManualAttendanceOverrideService;

  private constructor() {
    this.db = DesktopDatabaseService.getInstance();
    this.faceProvider = FaceVerificationProvider.getInstance();
    this.qrProvider = QrVerificationProvider.getInstance();
    this.overrideService = ManualAttendanceOverrideService.getInstance();
  }

  public static getInstance(): AttendanceService {
    if (!AttendanceService.instance) {
      AttendanceService.instance = new AttendanceService();
    }
    return AttendanceService.instance;
  }

  /**
   * Helper to find the relevant active session for attendance check-in.
   */
  private resolveActiveSession(sessionId?: string, courseId?: string) {
    if (sessionId) {
      return this.db.getSessionById(sessionId);
    }
    const sessions = this.db.getSessions(courseId);
    return sessions.find((s) => s.status === 'ACTIVE') || null;
  }

  /**
   * PRIMARY METHOD: Facial Verification Attendance Check-In
   * 1. Student enters matriculation number.
   * 2. System retrieves student and checks active + course enrolled.
   * 3. Confirms active attendance session.
   * 4. Compares captured face embedding against enrolled template (1-to-1).
   * 5. If matched: marks attendance (PRESENT/LATE) as 'FACE_VERIFIED'.
   * 6. DOES NOT require QR scan after successful facial verification!
   */
  public async verifyFaceAndRecord(params: FaceAttendanceParams): Promise<AttendanceResult> {
    try {
      const matric = params.matricNumber.trim().toUpperCase();

      if (!isValidMatricNumber(matric)) {
        return {
          success: false,
          statusCode: 'STUDENT_NOT_FOUND',
          message: `Invalid matriculation number format "${matric}". Must match 2xxx/2xxxxx (e.g. 2022/241414).`,
        };
      }

      // 1. Verify student exists and is active
      const student = this.db.getStudentByMatric(matric);
      if (!student) {
        return {
          success: false,
          statusCode: 'STUDENT_NOT_FOUND',
          message: `Student with matriculation number "${matric}" was not found in local records.`,
        };
      }

      if (!student.active) {
        return {
          success: false,
          statusCode: 'STUDENT_NOT_FOUND',
          message: `Student account for ${student.fullName} (${student.matricNumber}) is currently deactivated.`,
        };
      }

      // 2. Identify active session
      const session = this.resolveActiveSession(params.sessionId, params.courseId);
      if (!session) {
        return {
          success: false,
          statusCode: 'NO_ACTIVE_SESSION',
          message: 'No open attendance session was found for this course.',
        };
      }

      if (session.status !== 'ACTIVE') {
        return {
          success: false,
          statusCode: 'SESSION_CLOSED',
          message: `This attendance session (${session.title}) is ${session.status.toLowerCase()}. New check-ins are not accepted.`,
        };
      }

      // 3. Verify course enrollment
      const isEnrolled = this.db.isStudentEnrolled(student.id, session.courseId);
      if (!isEnrolled) {
        return {
          success: false,
          statusCode: 'NOT_ENROLLED',
          message: `Student ${student.fullName} (${student.matricNumber}) is NOT enrolled in course ${session.courseCode || 'this course'}.`,
        };
      }

      // 4. Duplicate attendance prevention (Idempotency / Unique Student & Session)
      const existingRecord = this.db.getAttendanceRecord(student.id, session.id);
      if (existingRecord) {
        return {
          success: false,
          statusCode: 'ALREADY_MARKED',
          message: `Attendance already recorded for ${student.fullName} in this session as ${existingRecord.status} (via ${existingRecord.verificationMethod}).`,
          record: existingRecord,
          studentName: student.fullName,
          matricNumber: student.matricNumber,
          attendanceStatus: existingRecord.status as any,
          verificationMethod: existingRecord.verificationMethod,
          courseCode: session.courseCode,
          timestamp: existingRecord.timestamp,
        };
      }

      // 5. Run local 1-to-1 facial verification
      const faceResult = await this.faceProvider.verifyFace({
        studentId: student.id,
        matricNumber: student.matricNumber,
        capturedEmbedding: params.capturedEmbedding,
        testSimulatedMatch: params.testSimulatedMatch,
        threshold: params.threshold,
      });

      if (!faceResult.success) {
        // Failed verification attempts do NOT mark student absent
        return {
          success: false,
          statusCode: faceResult.statusCode as any,
          message: faceResult.message,
          studentName: student.fullName,
          matricNumber: student.matricNumber,
          similarityScore: faceResult.similarityScore,
        };
      }

      // 6. Evaluate Attendance Status (PRESENT or LATE)
      const checkInTime = new Date();
      const status = evaluateAttendanceStatus(checkInTime, {
        sessionDate: session.sessionDate,
        openingTime: session.openingTime,
        closingTime: session.closingTime,
        lateThresholdMinutes: session.lateThresholdMinutes,
      }) as 'PRESENT' | 'LATE';

      // 7. Record in local SQLite database
      const recordId = crypto.randomUUID();
      const record = this.db.insertAttendanceRecord({
        id: recordId,
        studentId: student.id,
        matricNumber: student.matricNumber,
        studentName: student.fullName,
        courseId: session.courseId,
        sessionId: session.id,
        timestamp: checkInTime.toISOString(),
        status,
        verificationMethod: 'FACE_VERIFIED',
        similarityScore: faceResult.similarityScore,
        livenessPassed: true,
        kioskId: params.kioskId || 'KIOSK-01',
      });

      // 8. Audit logging
      this.db.logAudit(
        student.id,
        student.fullName,
        'ATTENDANCE_FACE_VERIFIED',
        'AttendanceRecord',
        recordId,
        `Student ${student.matricNumber} facially verified as ${status} (Score: ${faceResult.similarityScore}%)`
      );

      return {
        success: true,
        statusCode: 'SUCCESS',
        message: `Attendance marked successfully via Facial Verification: ${status}!`,
        record,
        studentName: student.fullName,
        matricNumber: student.matricNumber,
        attendanceStatus: status,
        verificationMethod: 'FACE_VERIFIED',
        similarityScore: faceResult.similarityScore,
        courseCode: session.courseCode,
        timestamp: checkInTime.toISOString(),
      };
    } catch (err: any) {
      return {
        success: false,
        statusCode: 'ERROR',
        message: `Facial attendance processing error: ${err.message}`,
      };
    }
  }

  /**
   * FALLBACK METHOD: Student-Specific QR Credential Attendance Check-In
   * Offered after facial verification fails (or student has no face enrolled / camera error).
   * 1. Scans unique student QR credential.
   * 2. Validates credential cryptographic signature and student identity.
   * 3. Confirms active attendance session and course enrollment.
   * 4. Enforces duplicate check.
   * 5. Marks attendance as 'QR_FALLBACK'.
   */
  public async verifyQrFallbackAndRecord(params: QrFallbackAttendanceParams): Promise<AttendanceResult> {
    try {
      // 1. Validate student QR credential
      const qrResult = await this.qrProvider.verifyStudentCredential({
        studentQrCredentialString: params.studentQrCredentialString,
        expectedMatricNumber: params.matricNumber,
      });

      if (!qrResult.success || !qrResult.payload) {
        return {
          success: false,
          statusCode: 'INVALID_QR_CREDENTIAL',
          message: qrResult.message,
        };
      }

      const { studentId, matricNumber, fullName } = qrResult.payload;

      // 2. Retrieve student
      const student = this.db.getStudentById(studentId);
      if (!student || !student.active) {
        return {
          success: false,
          statusCode: 'STUDENT_NOT_FOUND',
          message: `Student account for ${fullName} (${matricNumber}) is inactive or not found locally.`,
        };
      }

      // 3. Resolve active session
      const session = this.resolveActiveSession(params.sessionId, params.courseId);
      if (!session) {
        return {
          success: false,
          statusCode: 'NO_ACTIVE_SESSION',
          message: 'No active attendance session found.',
        };
      }

      if (session.status !== 'ACTIVE') {
        return {
          success: false,
          statusCode: 'SESSION_CLOSED',
          message: `Attendance session (${session.title}) is ${session.status.toLowerCase()}. New check-ins are closed.`,
        };
      }

      // 4. Verify course enrollment
      const isEnrolled = this.db.isStudentEnrolled(student.id, session.courseId);
      if (!isEnrolled) {
        return {
          success: false,
          statusCode: 'NOT_ENROLLED',
          message: `Student ${student.fullName} (${student.matricNumber}) is NOT enrolled in course ${session.courseCode || 'this course'}.`,
        };
      }

      // 5. Prevent duplicate attendance
      const existingRecord = this.db.getAttendanceRecord(student.id, session.id);
      if (existingRecord) {
        return {
          success: false,
          statusCode: 'ALREADY_MARKED',
          message: `Attendance already recorded for ${student.fullName} in this session as ${existingRecord.status} (via ${existingRecord.verificationMethod}).`,
          record: existingRecord,
          studentName: student.fullName,
          matricNumber: student.matricNumber,
          attendanceStatus: existingRecord.status as any,
          verificationMethod: existingRecord.verificationMethod,
          courseCode: session.courseCode,
          timestamp: existingRecord.timestamp,
        };
      }

      // 6. Evaluate Attendance Status
      const checkInTime = new Date();
      const status = evaluateAttendanceStatus(checkInTime, {
        sessionDate: session.sessionDate,
        openingTime: session.openingTime,
        closingTime: session.closingTime,
        lateThresholdMinutes: session.lateThresholdMinutes,
      }) as 'PRESENT' | 'LATE';

      // 7. Record in SQLite with QR_FALLBACK method
      const recordId = crypto.randomUUID();
      const record = this.db.insertAttendanceRecord({
        id: recordId,
        studentId: student.id,
        matricNumber: student.matricNumber,
        studentName: student.fullName,
        courseId: session.courseId,
        sessionId: session.id,
        timestamp: checkInTime.toISOString(),
        status,
        verificationMethod: 'QR_FALLBACK',
        similarityScore: undefined,
        livenessPassed: true,
        kioskId: params.kioskId || 'KIOSK-01',
        notes: 'Verified via student QR credential fallback',
      });

      // 8. Audit log
      this.db.logAudit(
        student.id,
        student.fullName,
        'ATTENDANCE_QR_FALLBACK_RECORDED',
        'AttendanceRecord',
        recordId,
        `Student ${student.matricNumber} marked as ${status} using Student QR Fallback Credential`
      );

      return {
        success: true,
        statusCode: 'SUCCESS',
        message: `Attendance recorded successfully via QR Fallback: ${status}!`,
        record,
        studentName: student.fullName,
        matricNumber: student.matricNumber,
        attendanceStatus: status,
        verificationMethod: 'QR_FALLBACK',
        courseCode: session.courseCode,
        timestamp: checkInTime.toISOString(),
      };
    } catch (err: any) {
      return {
        success: false,
        statusCode: 'ERROR',
        message: `QR fallback attendance error: ${err.message}`,
      };
    }
  }

  /**
   * LAST RESORT: Authorized Lecturer Manual Override
   * 1. Authorized lecturer opens active session.
   * 2. Searches student and selects override reason.
   * 3. Confirms action.
   * 4. Enforces duplicate check and records 'MANUAL_OVERRIDE'.
   * 5. Audit record logs student, course, session, lecturer ID, and reason.
   */
  public async recordLecturerOverride(params: LecturerOverrideParams): Promise<AttendanceResult> {
    try {
      // 1. Authorize lecturer and validate reason
      const authResult = await this.overrideService.authorizeOverride({
        studentId: params.studentId,
        sessionId: params.sessionId,
        lecturerId: params.lecturerId,
        overrideReason: params.overrideReason,
      });

      if (!authResult.authorized) {
        return {
          success: false,
          statusCode: authResult.statusCode as any,
          message: authResult.message,
        };
      }

      // 2. Retrieve student
      const student = this.db.getStudentById(params.studentId);
      if (!student) {
        return {
          success: false,
          statusCode: 'STUDENT_NOT_FOUND',
          message: 'Student record not found.',
        };
      }

      // 3. Retrieve session
      const session = this.db.getSessionById(params.sessionId);
      if (!session) {
        return {
          success: false,
          statusCode: 'NO_ACTIVE_SESSION',
          message: 'Attendance session not found.',
        };
      }

      if (session.status !== 'ACTIVE') {
        return {
          success: false,
          statusCode: 'SESSION_CLOSED',
          message: `Attendance session (${session.title}) is ${session.status.toLowerCase()}. Manual overrides cannot be added to closed sessions.`,
        };
      }

      // 4. Verify course enrollment
      const isEnrolled = this.db.isStudentEnrolled(student.id, session.courseId);
      if (!isEnrolled) {
        return {
          success: false,
          statusCode: 'NOT_ENROLLED',
          message: `Student ${student.fullName} (${student.matricNumber}) is NOT enrolled in course ${session.courseCode || 'this course'}.`,
        };
      }

      // 5. Prevent duplicate attendance
      const existingRecord = this.db.getAttendanceRecord(student.id, session.id);
      if (existingRecord) {
        return {
          success: false,
          statusCode: 'ALREADY_MARKED',
          message: `Attendance already recorded for ${student.fullName} in this session as ${existingRecord.status} (via ${existingRecord.verificationMethod}).`,
          record: existingRecord,
          studentName: student.fullName,
          matricNumber: student.matricNumber,
          attendanceStatus: existingRecord.status as any,
          verificationMethod: existingRecord.verificationMethod,
          courseCode: session.courseCode,
          timestamp: existingRecord.timestamp,
        };
      }

      // 6. Evaluate Attendance Status
      const checkInTime = new Date();
      const status = evaluateAttendanceStatus(checkInTime, {
        sessionDate: session.sessionDate,
        openingTime: session.openingTime,
        closingTime: session.closingTime,
        lateThresholdMinutes: session.lateThresholdMinutes,
      }) as 'PRESENT' | 'LATE';

      // 7. Record in SQLite
      const recordId = crypto.randomUUID();
      const record = this.db.insertAttendanceRecord({
        id: recordId,
        studentId: student.id,
        matricNumber: student.matricNumber,
        studentName: student.fullName,
        courseId: session.courseId,
        sessionId: session.id,
        timestamp: checkInTime.toISOString(),
        status,
        verificationMethod: 'MANUAL_OVERRIDE',
        similarityScore: 100,
        livenessPassed: true,
        kioskId: params.kioskId || 'LECTURER-CONSOLE',
        notes: `Lecturer Override (${authResult.staffId || params.lecturerId}): ${params.overrideReason}`,
      });

      // 8. Audit log
      this.db.logAudit(
        params.lecturerId,
        authResult.lecturerName || 'LECTURER',
        'MANUAL_ATTENDANCE_OVERRIDE',
        'AttendanceRecord',
        recordId,
        `Manual override recorded for student ${student.matricNumber} by ${authResult.lecturerName || params.lecturerId}. Reason: ${params.overrideReason}`
      );

      return {
        success: true,
        statusCode: 'SUCCESS',
        message: `Attendance recorded via Lecturer Manual Override: ${status}!`,
        record,
        studentName: student.fullName,
        matricNumber: student.matricNumber,
        attendanceStatus: status,
        verificationMethod: 'MANUAL_OVERRIDE',
        courseCode: session.courseCode,
        timestamp: checkInTime.toISOString(),
      };
    } catch (err: any) {
      return {
        success: false,
        statusCode: 'ERROR',
        message: `Lecturer override error: ${err.message}`,
      };
    }
  }

  /**
   * Backwards-compatible router for legacy callers and development tests.
   */
  public async processAttendanceAttempt(params: {
    matricNumber: string;
    qrTokenString?: string;
    capturedEmbedding?: number[];
    testSimulatedMatch?: boolean;
    manualOverride?: boolean;
    overrideReason?: string;
    staffUserId?: string;
    kioskId?: string;
  }): Promise<AttendanceResult> {
    if (params.manualOverride) {
      const student = this.db.getStudentByMatric(params.matricNumber);
      if (!student) {
        return { success: false, statusCode: 'STUDENT_NOT_FOUND', message: 'Student not found' };
      }
      const session = this.resolveActiveSession();
      if (!session) {
        return { success: false, statusCode: 'NO_ACTIVE_SESSION', message: 'No active session' };
      }
      return this.recordLecturerOverride({
        studentId: student.id,
        sessionId: session.id,
        lecturerId: params.staffUserId || 'usr-lecturer-001',
        overrideReason: params.overrideReason || 'Staff override',
        kioskId: params.kioskId,
      });
    }

    // Try face verification first!
    const faceResult = await this.verifyFaceAndRecord({
      matricNumber: params.matricNumber,
      capturedEmbedding: params.capturedEmbedding,
      testSimulatedMatch: params.testSimulatedMatch,
      kioskId: params.kioskId,
    });

    if (faceResult.success) {
      return faceResult;
    }

    // If face verification was unsuccessful and QR fallback credential was supplied, attempt QR fallback
    if (params.qrTokenString) {
      // Check if qrTokenString is a student credential or session QR
      try {
        const parsed = JSON.parse(params.qrTokenString);
        if (parsed?.payload?.type === 'STUDENT_CREDENTIAL') {
          return this.verifyQrFallbackAndRecord({
            studentQrCredentialString: params.qrTokenString,
            matricNumber: params.matricNumber,
            kioskId: params.kioskId,
          });
        }
      } catch {}
    }

    return faceResult;
  }
}

// Export domain service alias for backwards compatibility
export const AttendanceDomainService = AttendanceService;
