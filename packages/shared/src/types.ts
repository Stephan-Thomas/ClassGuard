export type UserRole = 'ADMIN' | 'LECTURER';

export type SessionStatus = 'SCHEDULED' | 'ACTIVE' | 'CLOSED' | 'CANCELLED';

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';

export type VerificationMethod =
  | 'FACE_VERIFIED'
  | 'QR_FALLBACK'
  | 'MANUAL_OVERRIDE'
  | 'TEST_SIMULATION'
  | 'QR_AND_FACE';

export type SyncStatus = 'PENDING' | 'SYNCED' | 'CONFLICT' | 'FAILED';

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash?: string;
  role: UserRole;
  fullName: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Student {
  id: string;
  matricNumber: string;
  fullName: string;
  department: string;
  level: string; // e.g. "400L", "300L"
  programme?: string;
  email?: string;
  active: boolean;
  hasFaceEnrolled: boolean;
  qrCredential?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Lecturer {
  id: string;
  staffId: string;
  fullName: string;
  email: string;
  department: string;
  userId?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Course {
  id: string;
  code: string; // e.g. "CSC 401"
  title: string;
  department: string;
  level: string;
  creditUnits: number;
  lecturerId?: string;
  lecturerName?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Enrollment {
  id: string;
  studentId: string;
  courseId: string;
  academicSession: string; // e.g. "2025/2026"
  semester: string; // e.g. "First"
  status: 'ENROLLED' | 'DROPPED';
  studentMatric?: string;
  studentName?: string;
  courseCode?: string;
  courseTitle?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceSession {
  id: string;
  courseId: string;
  courseCode?: string;
  courseTitle?: string;
  lecturerId: string;
  lecturerName?: string;
  title: string;
  sessionDate: string; // YYYY-MM-DD
  openingTime: string; // ISO or HH:mm
  closingTime: string; // ISO or HH:mm
  lateThresholdMinutes: number; // e.g. 15 minutes
  status: SessionStatus;
  publicKey?: string; // Ed25519 public key used for QR token verification
  qrRotateSeconds: number; // default 30 seconds
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  matricNumber: string;
  studentName: string;
  courseId: string;
  courseCode?: string;
  sessionId: string;
  timestamp: string; // ISO
  status: AttendanceStatus;
  verificationMethod: VerificationMethod;
  similarityScore?: number;
  livenessPassed?: boolean;
  kioskId?: string;
  notes?: string;
  syncStatus: SyncStatus;
  syncedAt?: string;
  createdAt: string;
}

export interface FaceTemplate {
  id: string;
  studentId: string;
  matricNumber: string;
  embedding: number[]; // 128-dimensional L2-normalized vector
  algorithm: string; // e.g. "FaceRecognitionNet-128D" or "MobileFaceNet"
  version: string;
  sampleCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SyncEvent {
  id: string;
  eventType: 'ATTENDANCE_RECORDED' | 'SESSION_CREATED' | 'SESSION_CLOSED' | 'STUDENT_ENROLLED';
  entityId: string;
  payload: Record<string, any>;
  status: SyncStatus;
  retryCount: number;
  errorMessage?: string;
  createdAt: string;
  syncedAt?: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  username?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details: string;
  ipAddress?: string;
  timestamp: string;
}

export interface QRTokenPayload {
  sessionId: string;
  courseId: string;
  courseCode: string;
  tokenId: string;
  issuedAt: number; // epoch ms
  expiresAt: number; // epoch ms
  nonce: string;
}

export interface SignedQRToken {
  payload: QRTokenPayload;
  signature: string; // Ed25519 signature in base64
  publicKey: string; // Ed25519 public key in base64
}

export interface StudentQRCredentialPayload {
  type: 'STUDENT_CREDENTIAL';
  studentId: string;
  matricNumber: string;
  fullName: string;
  department: string;
  credentialCode: string; // opaque token
  issuedAt: number; // epoch ms
  expiresAt?: number; // optional expiration epoch ms
}

export interface SignedStudentCredential {
  payload: StudentQRCredentialPayload;
  signature: string;
}

export interface VerificationResult {
  success: boolean;
  similarityScore: number;
  threshold: number;
  livenessPassed?: boolean;
  message: string;
  details?: Record<string, any>;
}

export interface CourseAttendanceSummary {
  courseId: string;
  courseCode: string;
  courseTitle: string;
  totalStudentsEnrolled: number;
  totalSessionsHeld: number;
  averageAttendanceRate: number; // 0 - 100%
}

export interface StudentAttendanceSummary {
  studentId: string;
  matricNumber: string;
  studentName: string;
  courseId: string;
  courseCode: string;
  totalEligibleSessions: number;
  sessionsAttended: number;
  sessionsLate: number;
  sessionsAbsent: number;
  attendancePercentage: number;
}
