import { z } from 'zod';

export const MATRIC_NUMBER_REGEX = /^2\d{3}\/2\d{5}$/;

export function isValidMatricNumber(matric: string): boolean {
  if (!matric || typeof matric !== 'string') return false;
  return MATRIC_NUMBER_REGEX.test(matric.trim());
}

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const StudentCreateSchema = z.object({
  matricNumber: z
    .string()
    .trim()
    .regex(MATRIC_NUMBER_REGEX, 'Matriculation number must match format 2xxx/2xxxxx (e.g. 2022/241414)'),
  fullName: z.string().min(2).max(120).trim(),
  department: z.string().min(2).max(100).trim(),
  level: z.string().min(2).max(20).trim(),
  email: z.string().email().optional().or(z.literal('')),
});

export const LecturerCreateSchema = z.object({
  staffId: z.string().min(3).max(30).trim(),
  fullName: z.string().min(2).max(120).trim(),
  email: z.string().email(),
  department: z.string().min(2).max(100).trim(),
});

export const CourseCreateSchema = z.object({
  code: z.string().min(3).max(20).trim(),
  title: z.string().min(3).max(150).trim(),
  department: z.string().min(2).max(100).trim(),
  level: z.string().min(2).max(20).trim(),
  creditUnits: z.number().int().min(1).max(10),
  lecturerId: z.string().optional(),
});

export const EnrollmentCreateSchema = z.object({
  studentId: z.string().min(1),
  courseId: z.string().min(1),
  academicSession: z.string().min(4).max(20).default('2025/2026'),
  semester: z.string().min(3).max(20).default('First'),
});

export const AttendanceSessionCreateSchema = z.object({
  courseId: z.string().min(1),
  lecturerId: z.string().min(1),
  title: z.string().min(3).max(100),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  openingTime: z.string().min(4),
  closingTime: z.string().min(4),
  lateThresholdMinutes: z.number().int().min(0).max(180).default(15),
  qrRotateSeconds: z.number().int().min(10).max(120).default(30),
});

export const QRTokenPayloadSchema = z.object({
  sessionId: z.string().min(1),
  courseId: z.string().min(1),
  courseCode: z.string().min(1),
  tokenId: z.string().min(1),
  issuedAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  nonce: z.string().min(1),
});

export const SignedQRTokenSchema = z.object({
  payload: QRTokenPayloadSchema,
  signature: z.string().min(1),
  publicKey: z.string().min(1),
});

export const StudentQRCredentialPayloadSchema = z.object({
  type: z.literal('STUDENT_CREDENTIAL'),
  studentId: z.string().min(1),
  matricNumber: z.string().min(1),
  fullName: z.string().min(1),
  department: z.string().min(1),
  credentialCode: z.string().min(1),
  issuedAt: z.number().int().positive(),
  expiresAt: z.number().int().positive().optional(),
});

export const SignedStudentCredentialSchema = z.object({
  payload: StudentQRCredentialPayloadSchema,
  signature: z.string().min(1),
});

export const RecordAttendanceSchema = z.object({
  matricNumber: z.string().min(3).trim(),
  qrTokenString: z.string().optional(),
  capturedEmbedding: z.array(z.number()).length(128).optional(),
  testSimulatedMatch: z.boolean().optional(),
  manualOverride: z.boolean().optional(),
  overrideReason: z.string().optional(),
  kioskId: z.string().optional(),
});

export const RecordFaceAttendanceSchema = z.object({
  matricNumber: z.string().min(3).trim(),
  sessionId: z.string().optional(),
  courseId: z.string().optional(),
  capturedEmbedding: z.array(z.number()).length(128).optional(),
  testSimulatedMatch: z.boolean().optional(),
  kioskId: z.string().optional(),
});

export const RecordQrFallbackAttendanceSchema = z.object({
  studentQrCredentialString: z.string().min(10),
  sessionId: z.string().optional(),
  courseId: z.string().optional(),
  matricNumber: z.string().optional(),
  kioskId: z.string().optional(),
});

export const LecturerManualOverrideSchema = z.object({
  studentId: z.string().min(1),
  sessionId: z.string().min(1),
  lecturerId: z.string().min(1),
  overrideReason: z.string().min(2, 'Please provide an override reason or explanation'),
  kioskId: z.string().optional(),
});

export const SyncBatchSchema = z.object({
  records: z.array(
    z.object({
      id: z.string().uuid().or(z.string().min(10)),
      studentId: z.string(),
      courseId: z.string(),
      sessionId: z.string(),
      matricNumber: z.string(),
      studentName: z.string(),
      timestamp: z.string(),
      status: z.enum(['PRESENT', 'LATE', 'EXCUSED']),
      verificationMethod: z.enum(['FACE_VERIFIED', 'QR_FALLBACK', 'MANUAL_OVERRIDE', 'TEST_SIMULATION', 'QR_AND_FACE']),
      similarityScore: z.number().optional(),
      livenessPassed: z.boolean().optional(),
      notes: z.string().optional(),
      createdAt: z.string(),
    })
  ),
  sourceKioskId: z.string().optional(),
});
