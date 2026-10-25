import {
  Student,
  createStudentQRCredential,
  generateSyntheticEmbedding,
  isValidMatricNumber,
} from '@classguard/shared';
import { DesktopDatabaseService } from './sqlite.service.js';

export interface StudentEnrollmentStatusItem {
  id: string;
  matricNumber: string;
  fullName: string;
  department: string;
  level: string;
  active: boolean;
  hasFaceEnrolled: boolean;
  facialEnrollmentStatus: 'ENROLLED' | 'NOT_ENROLLED';
  hasQrCredential: boolean;
  qrCredentialStatus: 'ISSUED' | 'NOT_ISSUED';
  accountStatus: 'ACTIVE' | 'INACTIVE';
  qrCredential?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnrollFaceParams {
  studentId: string;
  embedding: number[];
  sampleCount?: number;
  qualityScore?: number;
}

export class EnrollmentService {
  private static instance: EnrollmentService;
  private db: DesktopDatabaseService;

  private constructor() {
    this.db = DesktopDatabaseService.getInstance();
  }

  public static getInstance(): EnrollmentService {
    if (!EnrollmentService.instance) {
      EnrollmentService.instance = new EnrollmentService();
    }
    return EnrollmentService.instance;
  }

  /**
   * Register a new student and automatically generate an initial student QR credential.
   */
  public async registerStudent(data: {
    matricNumber: string;
    fullName: string;
    department: string;
    level: string;
    email?: string;
    courseIds?: string[];
  }): Promise<{ success: boolean; student?: Student; message: string }> {
    try {
      const trimmedMatric = data.matricNumber ? data.matricNumber.trim() : '';
      if (!isValidMatricNumber(trimmedMatric)) {
        return {
          success: false,
          message: `Invalid matriculation number "${trimmedMatric}". Must strictly match format 2xxx/2xxxxx (e.g. 2022/241414).`,
        };
      }

      const existing = this.db.getStudentByMatric(trimmedMatric);
      if (existing) {
        return {
          success: false,
          message: `A student with matriculation number ${trimmedMatric} is already registered.`,
        };
      }

      // Generate student QR credential immediately upon registration
      const tempId = `stu-${Date.now()}`;
      const qrCredential = createStudentQRCredential({
        studentId: tempId,
        matricNumber: data.matricNumber,
        fullName: data.fullName,
        department: data.department,
      });

      const student = this.db.createStudent({
        matricNumber: data.matricNumber,
        fullName: data.fullName,
        department: data.department,
        level: data.level,
        email: data.email,
        qrCredential,
      });

      // Update student ID inside QR credential if generated with real ID
      const finalCredential = createStudentQRCredential({
        studentId: student.id,
        matricNumber: student.matricNumber,
        fullName: student.fullName,
        department: student.department,
      });
      this.db.updateStudentQrCredential(student.id, finalCredential);

      // Assign initial course enrollments if provided
      if (data.courseIds && data.courseIds.length > 0) {
        for (const cId of data.courseIds) {
          try {
            this.db.enrollStudent(student.id, cId);
          } catch {}
        }
      }

      this.db.logAudit(
        undefined,
        'ADMIN',
        'STUDENT_REGISTERED',
        'Student',
        student.id,
        `Student ${student.fullName} (${student.matricNumber}) registered successfully.`
      );

      const refreshed = this.db.getStudentById(student.id)!;
      return {
        success: true,
        student: refreshed,
        message: `Student ${refreshed.fullName} (${refreshed.matricNumber}) registered successfully with QR credential.`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Registration failed: ${err.message}`,
      };
    }
  }

  /**
   * Update student metadata.
   */
  public async updateStudent(
    studentId: string,
    data: {
      fullName?: string;
      department?: string;
      level?: string;
      email?: string;
      active?: boolean;
    }
  ): Promise<{ success: boolean; student?: Student; message: string }> {
    try {
      const student = this.db.updateStudent(studentId, data);
      if (!student) {
        return { success: false, message: 'Student not found.' };
      }

      this.db.logAudit(
        undefined,
        'ADMIN',
        'STUDENT_UPDATED',
        'Student',
        student.id,
        `Student details updated for ${student.fullName} (${student.matricNumber}).`
      );

      return {
        success: true,
        student,
        message: `Student details updated successfully.`,
      };
    } catch (err: any) {
      return { success: false, message: `Update failed: ${err.message}` };
    }
  }

  /**
   * Delete or withdraw a student.
   */
  public async deleteStudent(studentId: string): Promise<{ success: boolean; message: string }> {
    try {
      const student = this.db.getStudentById(studentId);
      if (!student) {
        return { success: false, message: 'Student not found.' };
      }

      // Delete biometric face template
      this.db.deleteFaceTemplate(studentId);

      // Delete student record
      const deleted = this.db.deleteStudent(studentId);
      if (!deleted) {
        return { success: false, message: 'Could not delete student record.' };
      }

      this.db.logAudit(
        undefined,
        'ADMIN',
        'STUDENT_DELETED',
        'Student',
        studentId,
        `Student record for ${student.fullName} (${student.matricNumber}) deleted.`
      );

      return { success: true, message: `Student ${student.fullName} deleted successfully.` };
    } catch (err: any) {
      return { success: false, message: `Deletion failed: ${err.message}` };
    }
  }

  /**
   * Enroll or re-enroll real biometric face embedding for a student.
   * Validates embedding dimensions, saves to face_templates, and updates student record.
   */
  public async enrollFace(params: EnrollFaceParams): Promise<{ success: boolean; message: string }> {
    try {
      const student = this.db.getStudentById(params.studentId);
      if (!student) {
        return { success: false, message: 'Student not found.' };
      }

      if (!params.embedding || !Array.isArray(params.embedding) || params.embedding.length !== 128) {
        return {
          success: false,
          message: 'Invalid facial biometric embedding: Expected a 128-dimensional feature vector.',
        };
      }

      // Check quality/normalization
      let norm = 0;
      for (const val of params.embedding) {
        norm += val * val;
      }
      norm = Math.sqrt(norm);
      if (Math.abs(norm - 1.0) > 0.15) {
        // Normalize L2 vector
        const normalized = params.embedding.map((v) => v / (norm || 1));
        this.db.enrollFaceTemplate(student.id, normalized);
      } else {
        this.db.enrollFaceTemplate(student.id, params.embedding);
      }

      this.db.logAudit(
        undefined,
        'ADMIN',
        'FACE_BIOMETRIC_ENROLLED',
        'FaceTemplate',
        student.id,
        `Facial biometric representation enrolled for student ${student.matricNumber}.`
      );

      return {
        success: true,
        message: `Facial representation successfully enrolled for ${student.fullName} (${student.matricNumber}).`,
      };
    } catch (err: any) {
      return { success: false, message: `Facial enrollment failed: ${err.message}` };
    }
  }

  /**
   * Delete biometric face representation.
   */
  public async deleteFace(studentId: string): Promise<{ success: boolean; message: string }> {
    try {
      const student = this.db.getStudentById(studentId);
      if (!student) {
        return { success: false, message: 'Student not found.' };
      }

      this.db.deleteFaceTemplate(studentId);

      this.db.logAudit(
        undefined,
        'ADMIN',
        'FACE_BIOMETRIC_DELETED',
        'FaceTemplate',
        studentId,
        `Facial biometric template deleted for student ${student.matricNumber}.`
      );

      return {
        success: true,
        message: `Facial template removed for ${student.fullName}. Student can now use QR fallback or re-enroll.`,
      };
    } catch (err: any) {
      return { success: false, message: `Failed to remove face template: ${err.message}` };
    }
  }

  /**
   * Generate or regenerate a unique student QR credential.
   */
  public async generateStudentQrCredential(
    studentId: string
  ): Promise<{ success: boolean; qrCredential?: string; message: string }> {
    try {
      const student = this.db.getStudentById(studentId);
      if (!student) {
        return { success: false, message: 'Student not found.' };
      }

      const qrCredential = createStudentQRCredential({
        studentId: student.id,
        matricNumber: student.matricNumber,
        fullName: student.fullName,
        department: student.department,
      });

      this.db.updateStudentQrCredential(student.id, qrCredential);

      this.db.logAudit(
        undefined,
        'ADMIN',
        'QR_CREDENTIAL_GENERATED',
        'Student',
        student.id,
        `Student QR credential generated/regenerated for ${student.matricNumber}.`
      );

      return {
        success: true,
        qrCredential,
        message: `Student QR credential generated successfully for ${student.fullName}.`,
      };
    } catch (err: any) {
      return { success: false, message: `Failed to generate QR credential: ${err.message}` };
    }
  }

  /**
   * Retrieve enrollment status table overview.
   */
  public getEnrollmentStatusList(search?: string): StudentEnrollmentStatusItem[] {
    const students = this.db.getStudents(search);
    return students.map((s) => ({
      id: s.id,
      matricNumber: s.matricNumber,
      fullName: s.fullName,
      department: s.department,
      level: s.level,
      active: s.active,
      hasFaceEnrolled: s.hasFaceEnrolled,
      facialEnrollmentStatus: s.hasFaceEnrolled ? 'ENROLLED' : 'NOT_ENROLLED',
      hasQrCredential: !!(s.qrCredential && s.qrCredential.length > 20),
      qrCredentialStatus: s.qrCredential && s.qrCredential.length > 20 ? 'ISSUED' : 'NOT_ISSUED',
      accountStatus: s.active ? 'ACTIVE' : 'INACTIVE',
      qrCredential: s.qrCredential,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  }
}
