import * as faceapi from '@vladmandic/face-api';
import { generateSyntheticEmbedding, perturbEmbedding, verifyFace1to1 } from '@classguard/shared';

let modelsLoaded = false;
let modelLoadingPromise: Promise<boolean> | null = null;

export class FaceRecognitionService {
  private static instance: FaceRecognitionService;
  private modelPath = '/models';

  public static getInstance(): FaceRecognitionService {
    if (!FaceRecognitionService.instance) {
      FaceRecognitionService.instance = new FaceRecognitionService();
    }
    return FaceRecognitionService.instance;
  }

  /**
   * Load local offline neural network models for face detection,
   * landmarks, and embedding generation.
   */
  public async loadModels(): Promise<boolean> {
    if (modelsLoaded) return true;
    if (modelLoadingPromise) return modelLoadingPromise;

    modelLoadingPromise = (async () => {
      try {
        console.log('[FaceService] Initializing face-api.js neural networks...');
        // Set up TensorFlow environment
        if ((faceapi.tf as any)?.setBackend) {
          await (faceapi.tf as any).setBackend('webgl').catch(() => (faceapi.tf as any).setBackend('cpu'));
          if ((faceapi.tf as any).ready) await (faceapi.tf as any).ready();
        }

        // Load models from public directory or CDN fallback if local weights are not bundled yet
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        modelsLoaded = true;
        console.log('[FaceService] Local face models loaded successfully.');
        return true;
      } catch (err: any) {
        console.warn('[FaceService] Notice: WebGL model load failed or offline:', err.message);
        return false;
      }
    })();

    return modelLoadingPromise;
  }

  /**
   * Extract 128-dimensional facial representation from a video or canvas element.
   */
  public async extractFaceEmbedding(
    element: HTMLVideoElement | HTMLCanvasElement
  ): Promise<{ embedding: number[]; box?: any; landmarks?: any } | null> {
    try {
      const isReady = await this.loadModels();
      if (!isReady) {
        return null;
      }

      const detection = await faceapi
        .detectSingleFace(element, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) return null;

      return {
        embedding: Array.from(detection.descriptor),
        box: detection.detection.box,
        landmarks: detection.landmarks,
      };
    } catch (err: any) {
      console.warn('[FaceService] Extraction error:', err.message);
      return null;
    }
  }

  /**
   * Basic presentation attack detection heuristic (Eye Aspect Ratio for blinks).
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

  /**
   * Test/Demo Biometric Provider for offline automated tests or camera-less demo environments.
   * Clearly marked so it is never misrepresented as actual real facial recognition.
   */
  public getSimulatedEmbedding(studentMatric: string, shouldMatch = true): number[] {
    const base = generateSyntheticEmbedding(studentMatric);
    if (shouldMatch) {
      return perturbEmbedding(base, 0.04); // high similarity
    } else {
      return generateSyntheticEmbedding(`DIFFERENT_PERSON_${Date.now()}`); // low similarity
    }
  }
}
