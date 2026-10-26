import { VerificationResult } from './types.js';

export const DEFAULT_EUCLIDEAN_THRESHOLD = 0.50; // Standard for 128D FaceNet / FaceRecognitionNet
export const DEFAULT_COSINE_THRESHOLD = 0.75;

/**
 * Compute the Euclidean distance between two n-dimensional feature vectors.
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: vector A (${a.length}) vs vector B (${b.length})`);
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Compute the Cosine Similarity between two n-dimensional feature vectors.
 * Returns value between -1 and 1.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: vector A (${a.length}) vs vector B (${b.length})`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Normalize an embedding vector to unit length (L2 norm = 1.0).
 */
export function l2Normalize(vector: number[]): number[] {
  let sumSq = 0;
  for (const v of vector) sumSq += v * v;
  const norm = Math.sqrt(sumSq);
  if (norm === 0) return vector;
  return vector.map((v) => v / norm);
}

/**
 * 1-to-1 Facial Verification comparing a newly captured face embedding
 * against an enrolled reference template.
 */
export function verifyFace1to1(
  capturedEmbedding: number[],
  enrolledEmbedding: number[],
  customThreshold: number = DEFAULT_EUCLIDEAN_THRESHOLD
): VerificationResult {
  const isCapturedValid =
    Array.isArray(capturedEmbedding) &&
    capturedEmbedding.length === 128 &&
    capturedEmbedding.every((v) => typeof v === 'number' && Number.isFinite(v));

  if (!isCapturedValid) {
    return {
      success: false,
      similarityScore: 0,
      threshold: customThreshold,
      message: 'Invalid captured biometric embedding: expected 128 finite numeric values',
    };
  }

  const isEnrolledValid =
    Array.isArray(enrolledEmbedding) &&
    enrolledEmbedding.length === 128 &&
    enrolledEmbedding.every((v) => typeof v === 'number' && Number.isFinite(v));

  if (!isEnrolledValid) {
    return {
      success: false,
      similarityScore: 0,
      threshold: customThreshold,
      message: 'Invalid enrolled biometric template: expected 128 finite numeric values',
    };
  }

  // Reject degenerate/uninitialized vectors (norm near zero)
  let capturedNormSq = 0;
  for (const v of capturedEmbedding) capturedNormSq += v * v;
  if (capturedNormSq < 0.01) {
    return {
      success: false,
      similarityScore: 0,
      threshold: customThreshold,
      message: 'Degenerate captured facial representation: vector magnitude is near zero',
    };
  }

  let enrolledNormSq = 0;
  for (const v of enrolledEmbedding) enrolledNormSq += v * v;
  if (enrolledNormSq < 0.01) {
    return {
      success: false,
      similarityScore: 0,
      threshold: customThreshold,
      message: 'Degenerate enrolled facial template: vector magnitude is near zero',
    };
  }

  const distance = euclideanDistance(capturedEmbedding, enrolledEmbedding);
  const cosSim = cosineSimilarity(capturedEmbedding, enrolledEmbedding);

  const matched = Number.isFinite(distance) && distance <= customThreshold;
  const distanceMetric = Number(distance.toFixed(4));

  return {
    success: matched,
    similarityScore: distanceMetric,
    threshold: customThreshold,
    message: matched
      ? 'Face verified successfully'
      : 'Face does not match the enrolled student. Attendance was not recorded.',
    details: {
      euclideanDistance: distance,
      cosineSimilarity: cosSim,
      thresholdUsed: customThreshold,
    },
  };
}

/**
 * Translate structured facial verification status codes into user-friendly messages.
 * Prevents raw distances, thresholds, or technical diagnostics from leaking to students.
 */
export function getFriendlyFaceErrorMessage(statusCode?: string): string {
  switch (statusCode) {
    case 'FACE_MISMATCH':
    case 'MISMATCH':
      return 'Face does not match the enrolled student. Attendance was not recorded.';
    case 'NO_FACE_DETECTED':
      return 'No face detected. Please position your face in front of the camera.';
    case 'MULTIPLE_FACES':
      return 'Multiple faces detected. Please ensure only the student being verified is visible.';
    case 'NO_FACE_ENROLLED':
      return 'No facial profile found for this student. Please contact your lecturer.';
    case 'CAMERA_UNAVAILABLE':
    case 'CAMERA_ERROR':
    case 'VIDEO_NOT_READY':
      return 'Unable to access the camera. Check camera permissions and try again.';
    case 'ERROR':
    default:
      return 'Facial verification is temporarily unavailable. Please try again or use an authorized alternative.';
  }
}

/**
 * Generate a deterministic synthetic test embedding for mock/seed data.
 */
export function generateSyntheticEmbedding(seed: string): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }

  const raw: number[] = [];
  for (let i = 0; i < 128; i++) {
    const pseudoRandom = Math.sin(hash + i * 1.618) * 10000;
    raw.push(pseudoRandom - Math.floor(pseudoRandom) - 0.5);
  }

  return l2Normalize(raw);
}

/**
 * Produce a slightly perturbed embedding representing the same person in different lighting/angles.
 */
export function perturbEmbedding(baseEmbedding: number[], noiseLevel = 0.08): number[] {
  const perturbed = baseEmbedding.map((val) => val + (Math.random() - 0.5) * noiseLevel);
  return l2Normalize(perturbed);
}
