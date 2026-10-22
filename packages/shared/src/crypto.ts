import crypto from 'node:crypto';
import { QRTokenPayload, SignedQRToken, StudentQRCredentialPayload, SignedStudentCredential } from './types.js';
import { SignedQRTokenSchema, SignedStudentCredentialSchema } from './schemas.js';

/**
 * Generate an Ed25519 keypair for session QR signing and verification.
 * Ed25519 provides compact signatures (64 bytes) and strong asymmetric security.
 */
export function generateSessionKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  return { publicKey, privateKey };
}

/**
 * Serialize an object with sorted keys so signature verification is deterministic.
 */
export function canonicalJsonStringify(obj: Record<string, any>): string {
  const sortedKeys = Object.keys(obj).sort();
  const sortedObj: Record<string, any> = {};
  for (const key of sortedKeys) {
    sortedObj[key] = obj[key];
  }
  return JSON.stringify(sortedObj);
}

/**
 * Create a cryptographically signed QR token with a unique nonce and short lifespan.
 */
export function createSignedQRToken(params: {
  sessionId: string;
  courseId: string;
  courseCode: string;
  privateKeyPem: string;
  publicKeyPem: string;
  ttlSeconds?: number;
}): { tokenObject: SignedQRToken; tokenString: string } {
  const ttl = params.ttlSeconds ?? 30;
  const now = Date.now();
  const expiresAt = now + ttl * 1000;
  const tokenId = crypto.randomUUID();
  const nonce = crypto.randomBytes(8).toString('hex');

  const payload: QRTokenPayload = {
    sessionId: params.sessionId,
    courseId: params.courseId,
    courseCode: params.courseCode,
    tokenId,
    issuedAt: now,
    expiresAt,
    nonce,
  };

  const canonicalPayload = canonicalJsonStringify(payload);
  const signature = crypto.sign(null, Buffer.from(canonicalPayload, 'utf8'), params.privateKeyPem);

  const tokenObject: SignedQRToken = {
    payload,
    signature: signature.toString('base64'),
    publicKey: params.publicKeyPem,
  };

  const tokenString = JSON.stringify(tokenObject);
  return { tokenObject, tokenString };
}

export interface QRVerificationResult {
  valid: boolean;
  error?: string;
  payload?: QRTokenPayload;
}

/**
 * Verify a signed QR token string offline using public-key cryptography.
 * Checks structure, signature authenticity, and clock expiration.
 */
export function verifySignedQRToken(
  tokenInput: string | SignedQRToken,
  options?: {
    expectedPublicKey?: string;
    expectedSessionId?: string;
    expectedCourseId?: string;
    clockToleranceSeconds?: number;
  }
): QRVerificationResult {
  try {
    let parsed: SignedQRToken;
    if (typeof tokenInput === 'string') {
      parsed = JSON.parse(tokenInput);
    } else {
      parsed = tokenInput;
    }

    const parseResult = SignedQRTokenSchema.safeParse(parsed);
    if (!parseResult.success) {
      return { valid: false, error: 'Malformed QR token format: schema validation failed' };
    }

    const { payload, signature, publicKey } = parseResult.data;

    // Check public key consistency if expected key was provisioned
    const keyToUse = options?.expectedPublicKey || publicKey;
    if (options?.expectedPublicKey && options.expectedPublicKey.trim() !== publicKey.trim()) {
      return { valid: false, error: 'Token signed by unauthorized public key' };
    }

    // Check session ID if expected
    if (options?.expectedSessionId && payload.sessionId !== options.expectedSessionId) {
      return { valid: false, error: `Token session ID mismatch: expected ${options.expectedSessionId}` };
    }

    // Check course ID if expected
    if (options?.expectedCourseId && payload.courseId !== options.expectedCourseId) {
      return { valid: false, error: `Token course ID mismatch: expected ${options.expectedCourseId}` };
    }

    // Verify cryptographic signature
    const canonicalPayload = canonicalJsonStringify(payload);
    const signatureBuffer = Buffer.from(signature, 'base64');
    const isSignatureValid = crypto.verify(
      null,
      Buffer.from(canonicalPayload, 'utf8'),
      keyToUse,
      signatureBuffer
    );

    if (!isSignatureValid) {
      return { valid: false, error: 'Invalid cryptographic signature: QR code has been tampered with' };
    }

    // Check expiration
    const toleranceMs = (options?.clockToleranceSeconds ?? 5) * 1000;
    const now = Date.now();
    if (now > payload.expiresAt + toleranceMs) {
      const expiredBySeconds = Math.round((now - payload.expiresAt) / 1000);
      return { valid: false, error: `QR code expired ${expiredBySeconds}s ago. Please rescan current token.` };
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: `QR verification failed: ${err.message || 'unknown error'}` };
  }
}

export const DEFAULT_STUDENT_CREDENTIAL_SECRET = 'ClassGuard-Student-Credential-Master-Key-2026';

export interface StudentQRVerificationResult {
  valid: boolean;
  error?: string;
  payload?: StudentQRCredentialPayload;
}

/**
 * Generate a unique, student-specific, cryptographically signed QR credential.
 * Uses opaque identifiers and an HMAC-SHA256 signature to guarantee integrity
 * without leaking sensitive PII in the QR code.
 */
export function createStudentQRCredential(params: {
  studentId: string;
  matricNumber: string;
  fullName: string;
  department: string;
  credentialCode?: string;
  secretKey?: string;
}): string {
  const credentialCode = params.credentialCode || crypto.randomBytes(16).toString('hex');
  const payload: StudentQRCredentialPayload = {
    type: 'STUDENT_CREDENTIAL',
    studentId: params.studentId,
    matricNumber: params.matricNumber.trim().toUpperCase(),
    fullName: params.fullName.trim(),
    department: params.department.trim(),
    credentialCode,
    issuedAt: Date.now(),
  };

  const secret = params.secretKey || DEFAULT_STUDENT_CREDENTIAL_SECRET;
  const canonical = canonicalJsonStringify(payload);
  const signature = crypto.createHmac('sha256', secret).update(canonical).digest('hex');

  const signedObj: SignedStudentCredential = {
    payload,
    signature,
  };

  return JSON.stringify(signedObj);
}

/**
 * Validate a student-specific QR credential offline.
 * Rejects unknown, malformed, or tampered credentials.
 */
export function verifyStudentQRCredential(
  credentialInput: string | SignedStudentCredential,
  options?: {
    expectedMatricNumber?: string;
    expectedStudentId?: string;
    secretKey?: string;
  }
): StudentQRVerificationResult {
  try {
    let parsed: SignedStudentCredential;
    if (typeof credentialInput === 'string') {
      parsed = JSON.parse(credentialInput);
    } else {
      parsed = credentialInput;
    }

    const parseResult = SignedStudentCredentialSchema.safeParse(parsed);
    if (!parseResult.success) {
      return { valid: false, error: 'Malformed student QR credential: schema validation failed' };
    }

    const { payload, signature } = parseResult.data;

    // Verify HMAC signature
    const secret = options?.secretKey || DEFAULT_STUDENT_CREDENTIAL_SECRET;
    const canonical = canonicalJsonStringify(payload);
    const expectedSig = crypto.createHmac('sha256', secret).update(canonical).digest('hex');

    if (signature !== expectedSig) {
      return { valid: false, error: 'Cryptographic signature mismatch: student QR credential is invalid or tampered' };
    }

    if (options?.expectedMatricNumber && payload.matricNumber !== options.expectedMatricNumber.trim().toUpperCase()) {
      return {
        valid: false,
        error: `Student credential matriculation mismatch: expected ${options.expectedMatricNumber}, found ${payload.matricNumber}`,
      };
    }

    if (options?.expectedStudentId && payload.studentId !== options.expectedStudentId) {
      return {
        valid: false,
        error: `Student credential ID mismatch: expected ${options.expectedStudentId}`,
      };
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: `Student credential validation error: ${err.message || 'unknown error'}` };
  }
}

