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
  if (!capturedEmbedding || capturedEmbedding.length !== 128) {
    return {
      success: false,
      similarityScore: 0,
      threshold: customThreshold,
      message: 'Invalid captured biometric embedding: expected 128-dimensional vector',
    };
  }

  if (!enrolledEmbedding || enrolledEmbedding.length !== 128) {
    return {
      success: false,
      similarityScore: 0,
      threshold: customThreshold,
      message: 'No valid enrolled biometric template found for this student',
    };
  }

  const distance = euclideanDistance(capturedEmbedding, enrolledEmbedding);
  const cosSim = cosineSimilarity(capturedEmbedding, enrolledEmbedding);

  const matched = distance <= customThreshold;
  // Express similarity metric based on normalized distance
  const distanceMetric = Number(distance.toFixed(4));

  return {
    success: matched,
    similarityScore: distanceMetric,
    threshold: customThreshold,
    message: matched
      ? `Facial verification succeeded (Euclidean distance: ${distance.toFixed(3)} <= threshold: ${customThreshold})`
      : `Facial verification failed (Euclidean distance: ${distance.toFixed(3)} > threshold: ${customThreshold})`,
    details: {
      euclideanDistance: distance,
      cosineSimilarity: cosSim,
      thresholdUsed: customThreshold,
    },
  };
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
