import {
  verifyStudentQRCredential,
  StudentQRCredentialPayload,
  StudentQRVerificationResult,
} from '@classguard/shared';
import { DesktopDatabaseService } from './sqlite.service.js';

export interface QrVerificationParams {
  studentQrCredentialString: string;
  expectedStudentId?: string;
  expectedMatricNumber?: string;
}

export interface ProviderQrResult {
  success: boolean;
  statusCode: 'VALID_CREDENTIAL' | 'INVALID_CREDENTIAL' | 'MALFORMED_CREDENTIAL' | 'CREDENTIAL_MISMATCH' | 'STUDENT_NOT_FOUND' | 'ERROR';
  message: string;
  payload?: StudentQRCredentialPayload;
}

export class QrVerificationProvider {
  private static instance: QrVerificationProvider;
  private db: DesktopDatabaseService;

  private constructor() {
    this.db = DesktopDatabaseService.getInstance();
  }

  public static getInstance(): QrVerificationProvider {
    if (!QrVerificationProvider.instance) {
      QrVerificationProvider.instance = new QrVerificationProvider();
    }
    return QrVerificationProvider.instance;
  }

  /**
   * Validate a student's unique QR credential for fallback attendance.
   * Works completely offline using local cryptographic keys and cached student records.
   */
  public async verifyStudentCredential(params: QrVerificationParams): Promise<ProviderQrResult> {
    try {
      if (!params.studentQrCredentialString || typeof params.studentQrCredentialString !== 'string') {
        return {
          success: false,
          statusCode: 'MALFORMED_CREDENTIAL',
          message: 'Student QR credential was empty or invalid.',
        };
      }

      // 1. Cryptographic validation of student credential
      const verifyResult: StudentQRVerificationResult = verifyStudentQRCredential(
        params.studentQrCredentialString,
        {
          expectedMatricNumber: params.expectedMatricNumber,
          expectedStudentId: params.expectedStudentId,
        }
      );

      if (!verifyResult.valid || !verifyResult.payload) {
        return {
          success: false,
          statusCode: 'INVALID_CREDENTIAL',
          message: verifyResult.error || 'Student QR credential validation failed.',
        };
      }

      const payload = verifyResult.payload;

      // 2. Cross-check student existence and activation in local SQLite database
      const student = this.db.getStudentById(payload.studentId);
      if (!student) {
        return {
          success: false,
          statusCode: 'STUDENT_NOT_FOUND',
          message: `Student identified by QR credential (${payload.matricNumber}) was not found in local system records.`,
        };
      }

      if (!student.active) {
        return {
          success: false,
          statusCode: 'INVALID_CREDENTIAL',
          message: `Student account for ${student.fullName} (${student.matricNumber}) is currently deactivated.`,
        };
      }

      // 3. Confirm matriculation number matches local record
      if (student.matricNumber.trim().toUpperCase() !== payload.matricNumber.trim().toUpperCase()) {
        return {
          success: false,
          statusCode: 'CREDENTIAL_MISMATCH',
          message: 'Student credential does not match the enrolled matriculation record.',
        };
      }

      return {
        success: true,
        statusCode: 'VALID_CREDENTIAL',
        message: `Student QR credential validated for ${student.fullName} (${student.matricNumber}).`,
        payload,
      };
    } catch (err: any) {
      return {
        success: false,
        statusCode: 'ERROR',
        message: `QR verification error: ${err.message || 'unknown error'}`,
      };
    }
  }
}
