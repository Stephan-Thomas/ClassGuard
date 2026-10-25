import mongoose, { Schema, Document, Types } from 'mongoose';
import { UserRole } from '@classguard/shared';

export interface IUserDoc extends Document {
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  fullName: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUserDoc>(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: ['STUDENT', 'ADMIN', 'SUPERADMIN'] },
    fullName: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const UserModel = mongoose.models.User || mongoose.model<IUserDoc>('User', UserSchema);

export interface IStudentDoc extends Document {
  matricNumber: string;
  fullName: string;
  department: string;
  level: string;
  email?: string;
  active: boolean;
  hasFaceEnrolled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const StudentSchema = new Schema<IStudentDoc>(
  {
    matricNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },
    fullName: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    level: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    active: { type: Boolean, default: true },
    hasFaceEnrolled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const StudentModel = mongoose.models.Student || mongoose.model<IStudentDoc>('Student', StudentSchema);

export interface ILecturerDoc extends Document {
  staffId: string;
  fullName: string;
  email: string;
  department: string;
  userId?: Types.ObjectId | string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LecturerSchema = new Schema<ILecturerDoc>(
  {
    staffId: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    department: { type: String, required: true, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const LecturerModel = mongoose.models.Lecturer || mongoose.model<ILecturerDoc>('Lecturer', LecturerSchema);

export interface ICourseDoc extends Document {
  code: string;
  title: string;
  department: string;
  level: string;
  creditUnits: number;
  lecturerId?: Types.ObjectId | string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CourseSchema = new Schema<ICourseDoc>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    title: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    level: { type: String, required: true, trim: true },
    creditUnits: { type: Number, required: true, default: 3 },
    lecturerId: { type: Schema.Types.ObjectId, ref: 'Lecturer' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const CourseModel = mongoose.models.Course || mongoose.model<ICourseDoc>('Course', CourseSchema);

export interface IEnrollmentDoc extends Document {
  studentId: Types.ObjectId | string;
  courseId: Types.ObjectId | string;
  academicSession: string;
  semester: string;
  status: 'ENROLLED' | 'DROPPED';
  createdAt: Date;
  updatedAt: Date;
}

const EnrollmentSchema = new Schema<IEnrollmentDoc>(
  {
    studentId: { type: Schema.Types.ObjectId as any, ref: 'Student', required: true },
    courseId: { type: Schema.Types.ObjectId as any, ref: 'Course', required: true },
    academicSession: { type: String, required: true, default: '2025/2026' },
    semester: { type: String, required: true, default: 'First' },
    status: { type: String, required: true, enum: ['ENROLLED', 'DROPPED'], default: 'ENROLLED' },
  },
  { timestamps: true }
);
EnrollmentSchema.index({ studentId: 1, courseId: 1, academicSession: 1, semester: 1 }, { unique: true });

export const EnrollmentModel = mongoose.models.Enrollment || mongoose.model<IEnrollmentDoc>('Enrollment', EnrollmentSchema);

export interface IAttendanceSessionDoc extends Document {
  courseId: Types.ObjectId | string;
  lecturerId: Types.ObjectId | string;
  title: string;
  sessionDate: string;
  openingTime: string;
  closingTime: string;
  lateThresholdMinutes: number;
  status: 'SCHEDULED' | 'ACTIVE' | 'CLOSED' | 'CANCELLED';
  publicKey?: string;
  qrRotateSeconds: number;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSessionSchema = new Schema<IAttendanceSessionDoc>(
  {
    courseId: { type: Schema.Types.ObjectId as any, ref: 'Course', required: true },
    lecturerId: { type: Schema.Types.ObjectId as any, ref: 'Lecturer', required: true },
    title: { type: String, required: true, trim: true },
    sessionDate: { type: String, required: true },
    openingTime: { type: String, required: true },
    closingTime: { type: String, required: true },
    lateThresholdMinutes: { type: Number, default: 15 },
    status: { type: String, required: true, enum: ['SCHEDULED', 'ACTIVE', 'CLOSED', 'CANCELLED'], default: 'ACTIVE' },
    publicKey: { type: String },
    qrRotateSeconds: { type: Number, default: 30 },
  },
  { timestamps: true }
);

export const AttendanceSessionModel =
  mongoose.models.AttendanceSession || mongoose.model<IAttendanceSessionDoc>('AttendanceSession', AttendanceSessionSchema);

export interface IAttendanceRecordDoc extends Document {
  clientRecordId: string;
  studentId: Types.ObjectId | string;
  matricNumber: string;
  studentName: string;
  courseId: Types.ObjectId | string;
  sessionId: Types.ObjectId | string;
  timestamp: Date;
  status: 'PRESENT' | 'LATE' | 'EXCUSED';
  verificationMethod: 'QR_AND_FACE' | 'MANUAL_OVERRIDE' | 'TEST_SIMULATION';
  similarityScore?: number;
  livenessPassed?: boolean;
  kioskId?: string;
  notes?: string;
  syncStatus: 'SYNCED';
  syncedAt: Date;
  createdAt: Date;
}

const AttendanceRecordSchema = new Schema<IAttendanceRecordDoc>(
  {
    clientRecordId: { type: String, required: true, unique: true },
    studentId: { type: Schema.Types.ObjectId as any, ref: 'Student', required: true },
    matricNumber: { type: String, required: true, uppercase: true },
    studentName: { type: String, required: true },
    courseId: { type: Schema.Types.ObjectId as any, ref: 'Course', required: true },
    sessionId: { type: Schema.Types.ObjectId as any, ref: 'AttendanceSession', required: true },
    timestamp: { type: Date, required: true },
    status: { type: String, required: true, enum: ['PRESENT', 'LATE', 'EXCUSED'] },
    verificationMethod: { type: String, required: true, enum: ['FACE_VERIFIED', 'QR_FALLBACK', 'MANUAL_OVERRIDE', 'QR_AND_FACE', 'TEST_SIMULATION'] },
    similarityScore: { type: Number },
    livenessPassed: { type: Boolean, default: true },
    kioskId: { type: String },
    notes: { type: String },
    syncStatus: { type: String, default: 'SYNCED' },
    syncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
// Enforce unique attendance per student per session centrally
AttendanceRecordSchema.index({ studentId: 1, sessionId: 1 }, { unique: true });

export const AttendanceRecordModel =
  mongoose.models.AttendanceRecord || mongoose.model<IAttendanceRecordDoc>('AttendanceRecord', AttendanceRecordSchema);

export interface IFaceTemplateDoc extends Document {
  studentId: Types.ObjectId | string;
  matricNumber: string;
  embedding: number[];
  algorithm: string;
  version: string;
  sampleCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const FaceTemplateSchema = new Schema<IFaceTemplateDoc>(
  {
    studentId: { type: Schema.Types.ObjectId as any, ref: 'Student', required: true, unique: true },
    matricNumber: { type: String, required: true, uppercase: true },
    embedding: { type: [Number], required: true },
    algorithm: { type: String, default: 'FaceRecognitionNet-128D' },
    version: { type: String, default: '1.0' },
    sampleCount: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export const FaceTemplateModel =
  mongoose.models.FaceTemplate || mongoose.model<IFaceTemplateDoc>('FaceTemplate', FaceTemplateSchema);

export interface IAuditLogDoc extends Document {
  userId?: string;
  username?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details: string;
  ipAddress?: string;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLogDoc>(
  {
    userId: { type: String },
    username: { type: String },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String },
    details: { type: String, required: true },
    ipAddress: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const AuditLogModel = mongoose.models.AuditLog || mongoose.model<IAuditLogDoc>('AuditLog', AuditLogSchema);
