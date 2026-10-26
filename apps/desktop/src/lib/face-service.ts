import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;
let modelLoadingPromise: Promise<boolean> | null = null;

export interface FaceExtractionResult {
  success: boolean;
  embedding?: number[];
  box?: { x: number; y: number; width: number; height: number };
  landmarks?: faceapi.FaceLandmarks68;
  score?: number;
  error?: 'NO_FACE_DETECTED' | 'MULTIPLE_FACES' | 'FACE_TOO_FAR' | 'MODEL_UNAVAILABLE' | 'VIDEO_NOT_READY' | 'EXTRACTION_ERROR';
  message?: string;
}

/**
 * Determine local path for offline model files.
 * Works seamlessly in Vite development (HTTP) and packaged Electron (file://).
 */
function getLocalModelUri(): string {
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
    return '/models';
  }
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    const currentHref = window.location.href;
    const baseDir = currentHref.substring(0, currentHref.lastIndexOf('/') + 1);
    return `${baseDir}models`;
  }
  return '/models';
}

export class FaceRecognitionService {
  private static instance: FaceRecognitionService;

  public static getInstance(): FaceRecognitionService {
    if (!FaceRecognitionService.instance) {
      FaceRecognitionService.instance = new FaceRecognitionService();
    }
    return FaceRecognitionService.instance;
  }

  /**
   * Load local offline neural network models for face detection,
   * landmarks, and 128D feature embedding extraction.
   * Never calls external CDNs or remote APIs.
   */
  public async loadModels(): Promise<boolean> {
    if (modelsLoaded) return true;
    if (modelLoadingPromise) return modelLoadingPromise;

    modelLoadingPromise = (async () => {
      try {
        console.log('[FaceService] Loading offline local facial recognition models...');

        // Initialize TensorFlow backend (WebGL preferred with fallback to CPU)
        if ((faceapi.tf as any)?.setBackend) {
          try {
            await (faceapi.tf as any).setBackend('webgl');
          } catch {
            await (faceapi.tf as any).setBackend('cpu');
          }
          if ((faceapi.tf as any).ready) await (faceapi.tf as any).ready();
        }

        const modelUri = getLocalModelUri();
        console.log(`[FaceService] Loading local models from: ${modelUri}`);

        // Load strictly from bundled local model weights and manifests
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(modelUri),
          faceapi.nets.faceLandmark68Net.loadFromUri(modelUri),
          faceapi.nets.faceRecognitionNet.loadFromUri(modelUri),
        ]);

        modelsLoaded = true;
        console.log('[FaceService] Local neural network models loaded successfully and ready for offline inference.');
        return true;
      } catch (err: any) {
        modelsLoaded = false;
        modelLoadingPromise = null;
        console.error('[FaceService] Critical: Local model initialization failed:', err);
        throw new Error(
          `Local facial recognition models could not be loaded from ${getLocalModelUri()}. Ensure offline model files exist in public/models. Details: ${err.message}`
        );
      }
    })();

    return modelLoadingPromise;
  }

  /**
   * Extract actual 128-dimensional L2-normalized facial representation from video or canvas.
   * Enforces single-face detection, adequate framing, and returns descriptive errors on failure.
   */
  public async extractFaceEmbedding(
    element: HTMLVideoElement | HTMLCanvasElement
  ): Promise<FaceExtractionResult> {
    try {
      // Validate element readiness
      if (element instanceof HTMLVideoElement) {
        if (element.readyState < 2 || element.videoWidth === 0 || element.videoHeight === 0) {
          return {
            success: false,
            error: 'VIDEO_NOT_READY',
            message: 'Unable to access the camera. Check camera permissions and try again.',
          };
        }
      }

      const isReady = await this.loadModels();
      if (!isReady) {
        return {
          success: false,
          error: 'MODEL_UNAVAILABLE',
          message: 'Facial verification is temporarily unavailable. Please try again or use an authorized alternative.',
        };
      }

      // Detect ALL faces to prevent multi-person ambiguity during biometric capture
      const detections = await faceapi
        .detectAllFaces(
          element,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
        )
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (!detections || detections.length === 0) {
        return {
          success: false,
          error: 'NO_FACE_DETECTED',
          message: 'No face detected. Please position your face in front of the camera.',
        };
      }

      if (detections.length > 1) {
        return {
          success: false,
          error: 'MULTIPLE_FACES',
          message: 'Multiple faces detected. Please ensure only the student being verified is visible.',
        };
      }

      const single = detections[0];
      const box = single.detection.box;

      // Reject faces that are too small or far away
      if (box.width < 90 || box.height < 90) {
        return {
          success: false,
          error: 'FACE_TOO_FAR',
          message: 'Face is positioned too far from the camera. Please move closer to fill the guide frame.',
        };
      }

      // Descriptor is 128 Float32 values; convert to standard JS number array
      const descriptor = Array.from(single.descriptor);
      if (descriptor.length !== 128) {
        return {
          success: false,
          error: 'EXTRACTION_ERROR',
          message: 'Facial verification is temporarily unavailable. Please try again or use an authorized alternative.',
        };
      }

      return {
        success: true,
        embedding: descriptor,
        box: { x: box.x, y: box.y, width: box.width, height: box.height },
        landmarks: single.landmarks,
        score: single.detection.score,
      };
    } catch (err: any) {
      console.error('[FaceService] Extraction error:', err);
      return {
        success: false,
        error: 'EXTRACTION_ERROR',
        message: 'Facial verification is temporarily unavailable. Please try again or use an authorized alternative.',
      };
    }
  }

  /**
   * Basic presentation attack detection heuristic (Eye Aspect Ratio for blinks).
   * Note: This heuristic verifies dynamic facial movement but does NOT eliminate
   * high-fidelity physical silicone masks or sophisticated 3D replay attacks.
   */
  public detectEyeBlink(landmarks: faceapi.FaceLandmarks68): boolean {
    if (!landmarks) return false;
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    const getEAR = (eye: faceapi.Point[]) => {
      const dist = (p1: faceapi.Point, p2: faceapi.Point) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const vertical = (dist(eye[1], eye[5]) + dist(eye[2], eye[4])) / 2.0;
      const horizontal = dist(eye[0], eye[3]);
      return vertical / horizontal;
    };

    const leftEAR = getEAR(leftEye);
    const rightEAR = getEAR(rightEye);
    const avgEAR = (leftEAR + rightEAR) / 2.0;

    // EAR < 0.22 typically indicates eyes closed in a blink
    return avgEAR < 0.22;
  }
}
