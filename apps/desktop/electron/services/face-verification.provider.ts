import { verifyFace1to1, DEFAULT_EUCLIDEAN_THRESHOLD, VerificationResult } from '@classguard/shared';
import { DesktopDatabaseService } from './sqlite.service.js';

export interface FaceVerificationParams {
  studentId: string;
  matricNumber: string;
  capturedEmbedding?: number[];
  testSimulatedMatch?: boolean;
  threshold?: number;
}

export interface ProviderFaceResult {
  success: boolean;
  statusCode: 'MATCH' | 'MISMATCH' | 'FACE_MISMATCH' | 'NO_FACE_ENROLLED' | 'CAMERA_UNAVAILABLE' | 'NO_FACE_DETECTED' | 'ERROR';
  similarityScore: number;
  threshold: number;
  message: string;
  details?: Record<string, any>;
}

export class FaceVerificationProvider {
  private static instance: FaceVerificationProvider;
  private db: DesktopDatabaseService;

  private constructor() {
    this.db = DesktopDatabaseService.getInstance();
  }

  public static getInstance(): FaceVerificationProvider {
    if (!FaceVerificationProvider.instance) {
      FaceVerificationProvider.instance = new FaceVerificationProvider();
    }
    return FaceVerificationProvider.instance;
  }

  /**
   * Run 1-to-1 facial verification against the student's enrolled biometric template.
   * Offline, deterministic, and locally evaluated.
   */
  public async verifyFace(params: FaceVerificationParams): Promise<ProviderFaceResult> {
    try {
      const threshold = params.threshold ?? DEFAULT_EUCLIDEAN_THRESHOLD;

      // 1. Retrieve enrolled biometric template
      const template = this.db.getFaceTemplateByStudentId(params.studentId);
      if (!template) {
        console.log(`[FaceProvider] No face template found for studentId: ${params.studentId} (${params.matricNumber})`);
        return {
          success: false,
          statusCode: 'NO_FACE_ENROLLED',
          similarityScore: 0,
          threshold,
          message: 'No facial profile found for this student. Please contact your lecturer.',
        };
      }

      // Verify that template strictly matches the requested student identity
      if (template.matricNumber && params.matricNumber) {
        const enrolledMatric = template.matricNumber.trim().toUpperCase();
        const requestedMatric = params.matricNumber.trim().toUpperCase();
        if (enrolledMatric !== requestedMatric) {
          console.error(`[FaceProvider] Identity mismatch: enrolled=${enrolledMatric}, requested=${requestedMatric}`);
          return {
            success: false,
            statusCode: 'ERROR',
            similarityScore: 0,
            threshold,
            message: 'Facial verification is temporarily unavailable. Please try again or use an authorized alternative.',
          };
        }
      }

      if (!Array.isArray(template.embedding) || template.embedding.length !== 128) {
        console.error(`[FaceProvider] Corrupted template for studentId: ${params.studentId}`);
        return {
          success: false,
          statusCode: 'ERROR',
          similarityScore: 0,
          threshold,
          message: 'Facial verification is temporarily unavailable. Please try again or use an authorized alternative.',
        };
      }

      // 2. Automated test simulation hook (strictly isolated for automated headless test suite)
      if (params.testSimulatedMatch) {
        if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
          return {
            success: false,
            statusCode: 'ERROR',
            similarityScore: 0,
            threshold,
            message: 'Synthetic biometric simulation is strictly disabled in production attendance workflows.',
          };
        }
        return {
          success: true,
          statusCode: 'MATCH',
          similarityScore: 0.15,
          threshold,
          message: 'Face verified successfully',
        };
      }

      // 3. Validate captured embedding
      if (
        !params.capturedEmbedding ||
        !Array.isArray(params.capturedEmbedding) ||
        params.capturedEmbedding.length !== 128 ||
        !params.capturedEmbedding.every((v) => typeof v === 'number' && Number.isFinite(v))
      ) {
        console.warn(`[FaceProvider] Invalid or missing captured embedding for student: ${params.matricNumber}`);
        return {
          success: false,
          statusCode: 'NO_FACE_DETECTED',
          similarityScore: 0,
          threshold,
          message: 'No face detected. Please position your face in front of the camera.',
        };
      }

      // 4. Run Euclidean distance 1-to-1 matching
      const matchResult: VerificationResult = verifyFace1to1(
        params.capturedEmbedding,
        template.embedding,
        threshold
      );

      if (matchResult.success) {
        console.log(`[FaceProvider] Biometric match confirmed (score: ${matchResult.similarityScore}, threshold: ${threshold})`);
        return {
          success: true,
          statusCode: 'MATCH',
          similarityScore: matchResult.similarityScore,
          threshold,
          message: 'Face verified successfully',
          details: matchResult.details,
        };
      } else {
        console.log(`[FaceProvider] Biometric mismatch evaluated (score: ${matchResult.similarityScore}, threshold: ${threshold})`);
        return {
          success: false,
          statusCode: 'FACE_MISMATCH',
          similarityScore: matchResult.similarityScore,
          threshold,
          message: 'Face does not match the enrolled student. Attendance was not recorded.',
          details: matchResult.details,
        };
      }
    } catch (err: any) {
      console.error('[FaceProvider] Unexpected verification error:', err.message || err);
      return {
        success: false,
        statusCode: 'ERROR',
        similarityScore: 0,
        threshold: DEFAULT_EUCLIDEAN_THRESHOLD,
        message: 'Facial verification is temporarily unavailable. Please try again or use an authorized alternative.',
      };
    }
  }
}
