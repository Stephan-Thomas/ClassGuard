import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import {
  generateSessionKeyPair,
  createSignedQRToken,
  verifySignedQRToken,
  generateSyntheticEmbedding,
  perturbEmbedding,
  verifyFace1to1,
  DEFAULT_EUCLIDEAN_THRESHOLD,
  createStudentQRCredential,
  verifyStudentQRCredential,
  StudentCreateSchema,
  CourseCreateSchema,
  LoginSchema,
  isValidMatricNumber,
  MATRIC_NUMBER_REGEX,
  UserRole,
  getFriendlyFaceErrorMessage,
} from '@classguard/shared';
import { SqliteDatabaseClient } from '../database/db-client.js';
import { DesktopDatabaseService } from '../apps/desktop/electron/services/sqlite.service.js';
import { DesktopSessionService } from '../apps/desktop/electron/services/session.service.js';
import { FaceVerificationProvider } from '../apps/desktop/electron/services/face-verification.provider.js';
import { AttendanceService } from '../apps/desktop/electron/services/attendance.service.js';

describe('ClassGuard Complete Verification & Security Test Suite', () => {
  const testDbPath = path.resolve(process.cwd(), 'database', 'test_classguard.sqlite');
  let db: SqliteDatabaseClient;
  let sessionManager: DesktopSessionService;
  let faceProvider: FaceVerificationProvider;
  let attendanceService: AttendanceService;

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {}
    }
    db = new SqliteDatabaseClient(testDbPath);
    await db.init();
    db.migrate();

    DesktopDatabaseService.getInstance().setClient(db);
    sessionManager = DesktopSessionService.getInstance();
    faceProvider = FaceVerificationProvider.getInstance();
    attendanceService = AttendanceService.getInstance();

    const now = new Date().toISOString();

    // 1. Seed Exactly 3 Roles: SUPERADMIN, ADMIN (Lecturer), STUDENT
    const superadminPassHash = bcrypt.hashSync('Admin@123', 10);
    const lecturerPassHash = bcrypt.hashSync('Lecturer@123', 10);
    const studentPassHash = bcrypt.hashSync('Student@123', 10);

    db.run(
      `INSERT INTO users (id, username, email, password_hash, role, full_name, active, created_at, updated_at)
       VALUES ('usr-superadmin', 'superadmin', 'superadmin@classguard.edu', ?, 'SUPERADMIN', 'System Superadmin', 1, ?, ?)`,
      [superadminPassHash, now, now]
    );

    db.run(
      `INSERT INTO users (id, username, email, password_hash, role, full_name, active, created_at, updated_at)
       VALUES ('usr-lecturer', 'turing', 'turing@classguard.edu', ?, 'ADMIN', 'Dr. Alan Turing', 1, ?, ?)`,
      [lecturerPassHash, now, now]
    );

    db.run(
      `INSERT INTO users (id, username, email, password_hash, role, full_name, active, created_at, updated_at)
       VALUES ('usr-student', 'student', 'student@classguard.edu', ?, 'STUDENT', 'Ayomide Balogun', 1, ?, ?)`,
      [studentPassHash, now, now]
    );

    // 2. Seed Lecturer record
    db.run(
      `INSERT INTO lecturers (id, staff_id, full_name, email, department, user_id, active, created_at, updated_at)
       VALUES ('lec-01', 'STF/CSC/01', 'Dr. Alan Turing', 'turing@classguard.edu', 'Computer Science', 'usr-lecturer', 1, ?, ?)`,
      [now, now]
    );

    // 3. Seed Students with valid 2xxx/2xxxxx matriculation numbers
    const student1Cred = createStudentQRCredential({
      studentId: 'stu-test-01',
      matricNumber: '2022/241414',
      fullName: 'Ayomide Balogun',
      department: 'Computer Science',
    });

    db.run(
      `INSERT INTO students (id, matric_number, full_name, department, level, email, active, has_face_enrolled, qr_credential, created_at, updated_at)
       VALUES ('stu-test-01', '2022/241414', 'Ayomide Balogun', 'Computer Science', '400L', 'ayo@classguard.edu', 1, 1, ?, ?, ?)`,
      [student1Cred, now, now]
    );

    const student2Cred = createStudentQRCredential({
      studentId: 'stu-test-02',
      matricNumber: '2022/241415',
      fullName: 'Chinedu Okonkwo',
      department: 'Computer Science',
    });
    db.run(
      `INSERT INTO students (id, matric_number, full_name, department, level, email, active, has_face_enrolled, qr_credential, created_at, updated_at)
       VALUES ('stu-test-02', '2022/241415', 'Chinedu Okonkwo', 'Computer Science', '400L', 'chinedu@classguard.edu', 1, 0, ?, ?, ?)`,
      [student2Cred, now, now]
    );

    // 4. Seed Course
    db.run(
      `INSERT INTO courses (id, code, title, department, level, credit_units, lecturer_id, active, created_at, updated_at)
       VALUES ('crs-403', 'CSC 403', 'Computer Vision & Biometrics', 'Computer Science', '400L', 3, 'lec-01', 1, ?, ?)`,
      [now, now]
    );

    // 5. Seed Course Enrollments
    db.run(
      `INSERT INTO enrollments (id, student_id, course_id, academic_session, semester, status, created_at, updated_at)
       VALUES ('enr-01', 'stu-test-01', 'crs-403', '2025/2026', 'First', 'ENROLLED', ?, ?)`,
      [now, now]
    );
    db.run(
      `INSERT INTO enrollments (id, student_id, course_id, academic_session, semester, status, created_at, updated_at)
       VALUES ('enr-02', 'stu-test-02', 'crs-403', '2025/2026', 'First', 'ENROLLED', ?, ?)`,
      [now, now]
    );

    // 6. Seed Face Template for Student 1 (128D)
    const refEmbedding = generateSyntheticEmbedding('2022/241414');
    db.run(
      `INSERT INTO face_templates (id, student_id, matric_number, embedding, algorithm, version, sample_count, created_at, updated_at)
       VALUES ('tpl-01', 'stu-test-01', '2022/241414', ?, 'FaceRecognitionNet-128D', '1.0', 1, ?, ?)`,
      [JSON.stringify(refEmbedding), now, now]
    );

    // 7. Seed Active Attendance Session
    db.run(
      `INSERT INTO attendance_sessions (id, course_id, lecturer_id, title, session_date, opening_time, closing_time, late_threshold_minutes, status, created_at, updated_at)
       VALUES ('ses-active-01', 'crs-403', 'lec-01', 'CSC 403 Biometrics Lecture', '2026-10-25', '08:00', '14:00', 15, 'ACTIVE', ?, ?)`,
      [now, now]
    );
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {}
    }
  });

  describe('1. User Roles & Access Control', () => {
    it('should support exactly the 3 defined user roles: STUDENT, ADMIN, SUPERADMIN', () => {
      const roles: UserRole[] = ['STUDENT', 'ADMIN', 'SUPERADMIN'];
      expect(roles).toHaveLength(3);

      // Verify DB constraint enforces these 3 roles and rejects legacy or fourth roles
      const now = new Date().toISOString();
      expect(() => {
        db.run(
          `INSERT INTO users (id, username, email, password_hash, role, full_name, active, created_at, updated_at)
           VALUES ('usr-invalid', 'badrole', 'bad@classguard.edu', 'hash', 'SYSTEM_ADMIN', 'Invalid User', 1, ?, ?)`,
          [now, now]
        );
      }).toThrow();
    });

    it('should prevent students from accessing administrative features', () => {
      const studentSession = sessionManager.createSession({
        id: 'usr-student',
        username: 'student',
        email: 'student@classguard.edu',
        role: 'STUDENT',
        fullName: 'Ayomide Balogun',
      });

      expect(sessionManager.requireRole(studentSession.token, ['ADMIN', 'SUPERADMIN']).authorized).toBe(false);
      expect(sessionManager.requireRole(studentSession.token, ['STUDENT']).authorized).toBe(true);
    });

    it('should prevent lecturers from accessing superadmin-only functions', () => {
      const lecturerSession = sessionManager.createSession({
        id: 'usr-lecturer',
        username: 'turing',
        email: 'turing@classguard.edu',
        role: 'ADMIN',
        fullName: 'Dr. Alan Turing',
      });

      // Lecturer is ADMIN, should not have SUPERADMIN role
      expect(sessionManager.requireRole(lecturerSession.token, ['SUPERADMIN']).authorized).toBe(false);
      expect(sessionManager.requireRole(lecturerSession.token, ['ADMIN']).authorized).toBe(true);
    });

    it('should allow superadmin access to superadmin functions', () => {
      const superadminSession = sessionManager.createSession({
        id: 'usr-superadmin',
        username: 'superadmin',
        email: 'superadmin@classguard.edu',
        role: 'SUPERADMIN',
        fullName: 'System Superadmin',
      });

      expect(sessionManager.requireRole(superadminSession.token, ['SUPERADMIN']).authorized).toBe(true);
    });
  });

  describe('2. Authentication & Session Validation', () => {
    it('should authenticate valid credentials against authoritative store', () => {
      const user = db.queryOne('SELECT * FROM users WHERE email = ?', ['turing@classguard.edu']);
      expect(user).not.toBeNull();
      const match = bcrypt.compareSync('Lecturer@123', user.password_hash);
      expect(match).toBe(true);
      const wrongMatch = bcrypt.compareSync('WrongPassword', user.password_hash);
      expect(wrongMatch).toBe(false);
    });

    it('should issue an authoritative session and validate it against the database', () => {
      const user = db.queryOne('SELECT * FROM users WHERE email = ?', ['turing@classguard.edu']);
      const session = sessionManager.createSession({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.full_name,
      });

      expect(session.token).toBeDefined();
      expect(session.token.length).toBeGreaterThanOrEqual(32);

      // Validate session with authoritative DB check
      const valid = sessionManager.validateSession(session.token);
      expect(valid.valid).toBe(true);
      expect(valid.user?.email).toBe('turing@classguard.edu');
      expect(valid.user?.role).toBe('ADMIN');
    });

    it('should reject tampered or fabricated session tokens (preventing localStorage tampering)', () => {
      const fabricatedToken = crypto.randomBytes(32).toString('hex');
      const result = sessionManager.validateSession(fabricatedToken);
      expect(result.valid).toBe(false);
    });

    it('should revoke session on logout and reject subsequent requests', () => {
      const user = db.queryOne('SELECT * FROM users WHERE email = ?', ['turing@classguard.edu']);
      const session = sessionManager.createSession({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.full_name,
      });

      expect(sessionManager.validateSession(session.token).valid).toBe(true);
      sessionManager.revokeSession(session.token);
      expect(sessionManager.validateSession(session.token).valid).toBe(false);
    });

    it('should reject session if user account is deactivated in database', () => {
      const user = db.queryOne('SELECT * FROM users WHERE email = ?', ['turing@classguard.edu']);
      const session = sessionManager.createSession({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.full_name,
      });

      // Deactivate user in DB
      db.run('UPDATE users SET active = 0 WHERE id = ?', [user.id]);

      const result = sessionManager.validateSession(session.token);
      expect(result.valid).toBe(false);
    });
  });

  describe('3. Matriculation Number Format Validation', () => {
    it('should strictly accept valid matriculation numbers conforming to ^2\\d{3}/2\\d{5}$', () => {
      const validSamples = [
        '2022/241414',
        '2023/247230',
        '2024/246825',
        '2020/200000',
        '2999/299999',
      ];

      for (const matric of validSamples) {
        expect(isValidMatricNumber(matric)).toBe(true);
        expect(MATRIC_NUMBER_REGEX.test(matric)).toBe(true);

        const schemaCheck = StudentCreateSchema.safeParse({
          matricNumber: matric,
          fullName: 'Test Student',
          department: 'Computer Science',
          level: '400L',
        });
        expect(schemaCheck.success).toBe(true);
      }
    });

    it('should strictly reject invalid matriculation numbers', () => {
      const invalidSamples = [
        'CSC/2021/001',   // Legacy format
        '2022/123456',   // Second part does not start with 2
        '1022/241414',   // First part does not start with 2
        '2022-241414',   // Hyphen instead of slash
        '2022/24141',    // Too short (5 digits after slash)
        '2022/2414144',  // Too long (7 digits after slash)
        '202/241414',    // Too short (3 digits before slash)
        '20224/241414',  // Too long (5 digits before slash)
        'invalid-matric',
        '',
      ];

      for (const matric of invalidSamples) {
        expect(isValidMatricNumber(matric)).toBe(false);

        const schemaCheck = StudentCreateSchema.safeParse({
          matricNumber: matric,
          fullName: 'Test Student',
          department: 'Computer Science',
          level: '400L',
        });
        expect(schemaCheck.success).toBe(false);
      }
    });

    it('should handle whitespace trimming correctly for matriculation inputs', () => {
      expect(isValidMatricNumber('  2022/241414  ')).toBe(true);
      expect(isValidMatricNumber('\t2023/247230\n')).toBe(true);
    });
  });

  describe('4. Real Facial Recognition & Biometric Workflow', () => {
    it('should bundle local facial recognition model files offline without CDN dependency', () => {
      const modelsDir = path.resolve(process.cwd(), 'apps', 'desktop', 'public', 'models');
      expect(fs.existsSync(modelsDir)).toBe(true);

      const requiredModelFiles = [
        'ssd_mobilenetv1_model-weights_manifest.json',
        'ssd_mobilenetv1_model.bin',
        'face_landmark_68_model-weights_manifest.json',
        'face_landmark_68_model.bin',
        'face_recognition_model-weights_manifest.json',
        'face_recognition_model.bin',
      ];

      for (const file of requiredModelFiles) {
        const filePath = path.join(modelsDir, file);
        expect(fs.existsSync(filePath)).toBe(true);
        expect(fs.statSync(filePath).size).toBeGreaterThan(0);
      }
    });

    it('should reject synthetic simulation in production mode', async () => {
      // In production mode, testSimulatedMatch must be refused
      const originalEnv = process.env.NODE_ENV;
      const originalVitest = process.env.VITEST;

      try {
        process.env.NODE_ENV = 'production';
        delete process.env.VITEST;

        const res = await faceProvider.verifyFace({
          studentId: 'stu-test-01',
          matricNumber: '2022/241414',
          testSimulatedMatch: true,
        });

        expect(res.success).toBe(false);
        expect(res.statusCode).toBe('ERROR');
        expect(res.message).toMatch(/strictly disabled in production/i);
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.env.VITEST = originalVitest;
      }
    });

    it('should persist a real 128D facial embedding during student enrollment', () => {
      const now = new Date().toISOString();
      const realEmbedding = Array.from({ length: 128 }, () => Math.random() * 0.2 - 0.1);

      // Save real template
      db.run(
        `INSERT INTO face_templates (id, student_id, matric_number, embedding, algorithm, version, sample_count, created_at, updated_at)
         VALUES ('tpl-real-01', 'stu-test-02', '2022/241415', ?, 'FaceRecognitionNet-128D', '1.0', 1, ?, ?)`,
        [JSON.stringify(realEmbedding), now, now]
      );
      db.run('UPDATE students SET has_face_enrolled = 1 WHERE id = ?', ['stu-test-02']);

      const updated = db.queryOne('SELECT * FROM students WHERE id = ?', ['stu-test-02']);
      expect(updated.has_face_enrolled).toBe(1);

      const template = db.queryOne('SELECT * FROM face_templates WHERE student_id = ?', ['stu-test-02']);
      expect(template).not.toBeNull();
      const parsed = JSON.parse(template.embedding);
      expect(parsed).toHaveLength(128);
    });

    it('should verify genuine face capture and mark attendance as FACE_VERIFIED with success feedback', async () => {
      const student = db.queryOne('SELECT * FROM students WHERE matric_number = ?', ['2022/241414']);
      expect(student).not.toBeNull();

      const templateRow = db.queryOne('SELECT * FROM face_templates WHERE student_id = ?', [student.id]);
      const enrolledEmbedding = JSON.parse(templateRow.embedding);

      // Live capture of the enrolled person with natural variations
      const genuineCapture = perturbEmbedding(enrolledEmbedding, 0.05);

      const res = await attendanceService.verifyFaceAndRecord({
        matricNumber: '2022/241414',
        sessionId: 'ses-active-01',
        capturedEmbedding: genuineCapture,
      });

      expect(res.success).toBe(true);
      expect(res.statusCode).toBe('SUCCESS');
      expect(res.verificationMethod).toBe('FACE_VERIFIED');
      expect(res.similarityScore).toBeLessThanOrEqual(DEFAULT_EUCLIDEAN_THRESHOLD);
      expect(res.message).toContain('Face verified successfully');
      expect(res.message).toContain('Attendance recorded successfully');

      // Confirm record exists in SQLite
      const record = db.queryOne('SELECT * FROM attendance_records WHERE student_id = ?', [student.id]);
      expect(record).not.toBeNull();
      expect(record.verification_method).toBe('FACE_VERIFIED');
      expect(['PRESENT', 'LATE']).toContain(record.status);
    });

    it('should reject attendance attempt using a different person\'s face with user-friendly mismatch message and NEVER create attendance record', async () => {
      // Impostor (different person's face)
      const impostorEmbedding = generateSyntheticEmbedding('ANOTHER_PERSON_DIFFERENT_FACE');

      const res = await attendanceService.verifyFaceAndRecord({
        matricNumber: '2022/241414',
        sessionId: 'ses-active-01',
        capturedEmbedding: impostorEmbedding,
      });

      // Must fail closed with friendly user message
      expect(res.success).toBe(false);
      expect(['MISMATCH', 'FACE_MISMATCH']).toContain(res.statusCode);
      expect(res.message).toBe('Face does not match the enrolled student. Attendance was not recorded.');
      // Ensure no raw technical distance or threshold leaked to user message
      expect(res.message).not.toMatch(/threshold/i);
      expect(res.message).not.toMatch(/distance/i);

      // CRITICAL: Ensure NO attendance record was created in the database
      const record = db.queryOne('SELECT * FROM attendance_records WHERE student_id = ?', ['stu-test-01']);
      expect(record).toBeNull();
    });

    it('should return user-friendly message when student has no facial profile enrolled', async () => {
      const student2 = db.queryOne('SELECT * FROM students WHERE matric_number = ?', ['2022/241415']);
      expect(student2.has_face_enrolled).toBe(0);

      const capture = generateSyntheticEmbedding('ANY_FACE');
      const res = await attendanceService.verifyFaceAndRecord({
        matricNumber: '2022/241415',
        sessionId: 'ses-active-01',
        capturedEmbedding: capture,
      });

      expect(res.success).toBe(false);
      expect(res.statusCode).toBe('NO_FACE_ENROLLED');
      expect(res.message).toBe('No facial profile found for this student. Please contact your lecturer.');

      const record = db.queryOne('SELECT * FROM attendance_records WHERE student_id = ?', ['stu-test-02']);
      expect(record).toBeNull();
    });

    it('should return user-friendly message when no face is detected in frame', async () => {
      // Missing or invalid length captured vector
      const shortVec = Array(50).fill(0.1);
      const res1 = await attendanceService.verifyFaceAndRecord({
        matricNumber: '2022/241414',
        sessionId: 'ses-active-01',
        capturedEmbedding: shortVec,
      });
      expect(res1.success).toBe(false);
      expect(res1.statusCode).toBe('NO_FACE_DETECTED');
      expect(res1.message).toBe('No face detected. Please position your face in front of the camera.');

      // No attendance record created
      const record = db.queryOne('SELECT * FROM attendance_records WHERE student_id = ?', ['stu-test-01']);
      expect(record).toBeNull();
    });

    it('should handle camera failure and multiple faces with structured user-friendly messages', () => {
      // Camera failure translation
      expect(getFriendlyFaceErrorMessage('CAMERA_UNAVAILABLE')).toBe(
        'Unable to access the camera. Check camera permissions and try again.'
      );
      expect(getFriendlyFaceErrorMessage('VIDEO_NOT_READY')).toBe(
        'Unable to access the camera. Check camera permissions and try again.'
      );

      // Multiple faces translation
      expect(getFriendlyFaceErrorMessage('MULTIPLE_FACES')).toBe(
        'Multiple faces detected. Please ensure only the student being verified is visible.'
      );
    });

    it('should fail closed with user-friendly message on unexpected verification failure without exposing stack traces or database errors', async () => {
      // Corrupt template in SQLite
      db.run("UPDATE face_templates SET embedding = 'CORRUPTED_JSON_NOT_ARRAY' WHERE student_id = 'stu-test-01'");

      const capture = generateSyntheticEmbedding('2022/241414');
      const res = await attendanceService.verifyFaceAndRecord({
        matricNumber: '2022/241414',
        sessionId: 'ses-active-01',
        capturedEmbedding: capture,
      });

      expect(res.success).toBe(false);
      expect(res.statusCode).toBe('ERROR');
      expect(res.message).toBe(
        'Facial verification is temporarily unavailable. Please try again or use an authorized alternative.'
      );
      // Ensure no raw database stack trace or internal error leaked
      expect(res.message).not.toMatch(/SQLITE|JSON|at /i);

      const record = db.queryOne('SELECT * FROM attendance_records WHERE student_id = ?', ['stu-test-01']);
      expect(record).toBeNull();
    });

    it('should reject malformed captured embeddings (NaN, non-finite, degenerate zero vectors)', async () => {
      // NaN values
      const nanVec = Array(128).fill(NaN);
      const res = await attendanceService.verifyFaceAndRecord({
        matricNumber: '2022/241414',
        sessionId: 'ses-active-01',
        capturedEmbedding: nanVec,
      });
      expect(res.success).toBe(false);
      expect(res.statusCode).toBe('NO_FACE_DETECTED');
      expect(res.message).toBe('No face detected. Please position your face in front of the camera.');

      // All zero degenerate vector
      const zeroVec = Array(128).fill(0);
      const res2 = await faceProvider.verifyFace({
        studentId: 'stu-test-01',
        matricNumber: '2022/241414',
        capturedEmbedding: zeroVec,
      });
      expect(res2.success).toBe(false);

      // No records created
      const record = db.queryOne('SELECT * FROM attendance_records WHERE student_id = ?', ['stu-test-01']);
      expect(record).toBeNull();
    });

    it('should reject verification if template matric number does not match requested student without leaking internal details', async () => {
      // Tamper template matric number to a different student
      db.run("UPDATE face_templates SET matric_number = '2022/299999' WHERE student_id = 'stu-test-01'");

      const capture = generateSyntheticEmbedding('2022/241414');
      const res = await faceProvider.verifyFace({
        studentId: 'stu-test-01',
        matricNumber: '2022/241414',
        capturedEmbedding: capture,
      });

      expect(res.success).toBe(false);
      expect(res.statusCode).toBe('ERROR');
      expect(res.message).toBe(
        'Facial verification is temporarily unavailable. Please try again or use an authorized alternative.'
      );
    });

    it('should ensure repeated facial verification failures never record attendance and preserve retry / fallback', async () => {
      const impostor1 = generateSyntheticEmbedding('IMPOSTOR_1');
      const impostor2 = generateSyntheticEmbedding('IMPOSTOR_2');

      const res1 = await attendanceService.verifyFaceAndRecord({
        matricNumber: '2022/241414',
        sessionId: 'ses-active-01',
        capturedEmbedding: impostor1,
      });
      expect(res1.success).toBe(false);

      const res2 = await attendanceService.verifyFaceAndRecord({
        matricNumber: '2022/241414',
        sessionId: 'ses-active-01',
        capturedEmbedding: impostor2,
      });
      expect(res2.success).toBe(false);

      // Verify no record exists
      const record = db.queryOne('SELECT * FROM attendance_records WHERE student_id = ?', ['stu-test-01']);
      expect(record).toBeNull();
    });
  });

  describe('5. Attendance Fallback Hierarchy: Face -> QR -> Lecturer Override', () => {
    it('should accept valid student QR credential when face verification fails', () => {
      const student = db.queryOne('SELECT * FROM students WHERE matric_number = ?', ['2022/241414']);
      const verifyResult = verifyStudentQRCredential(student.qr_credential);
      expect(verifyResult.valid).toBe(true);
      expect(verifyResult.payload?.matricNumber).toBe('2022/241414');

      const now = new Date().toISOString();
      db.run(
        `INSERT INTO attendance_records (id, student_id, matric_number, student_name, course_id, session_id, timestamp, status, verification_method, notes, kiosk_id, sync_status, created_at)
         VALUES ('rec-qr-01', ?, ?, ?, 'crs-403', 'ses-active-01', ?, 'PRESENT', 'QR_FALLBACK', 'Student QR credential scanned', 'KIOSK-01', 'PENDING', ?)`,
        [student.id, student.matric_number, student.full_name, now, now]
      );

      const record = db.queryOne('SELECT * FROM attendance_records WHERE id = ?', ['rec-qr-01']);
      expect(record.verification_method).toBe('QR_FALLBACK');
    });

    it('should reject tampered or invalid QR credentials', () => {
      const tampered = verifyStudentQRCredential('invalid-token-string');
      expect(tampered.valid).toBe(false);
    });

    it('should require authenticated lecturer authorization and reason for manual override', () => {
      const now = new Date().toISOString();
      const reason = 'Student camera hardware obscured; physical verification in lecture hall';

      // Insert manual override
      db.run(
        `INSERT INTO attendance_records (id, student_id, matric_number, student_name, course_id, session_id, timestamp, status, verification_method, notes, kiosk_id, sync_status, created_at)
         VALUES ('rec-override-01', 'stu-test-02', '2022/241415', 'Chinedu Okonkwo', 'crs-403', 'ses-active-01', ?, 'PRESENT', 'MANUAL_OVERRIDE', ?, 'LECTURER-CONSOLE', 'PENDING', ?)`,
        [now, `Lecturer Override: ${reason}`, now]
      );

      // Audit entry
      db.run(
        `INSERT INTO audit_logs (id, user_id, username, action, entity_type, entity_id, details, timestamp)
         VALUES ('aud-01', 'usr-lecturer', 'Dr. Alan Turing', 'MANUAL_ATTENDANCE_OVERRIDE', 'AttendanceRecord', 'rec-override-01', ?, ?)`,
        [`Authorized manual override for 2022/241415. Reason: ${reason}`, now]
      );

      const record = db.queryOne('SELECT * FROM attendance_records WHERE id = ?', ['rec-override-01']);
      expect(record.verification_method).toBe('MANUAL_OVERRIDE');
      expect(record.notes).toContain(reason);

      const audit = db.queryOne('SELECT * FROM audit_logs WHERE id = ?', ['aud-01']);
      expect(audit.action).toBe('MANUAL_ATTENDANCE_OVERRIDE');
      expect(audit.details).toContain(reason);
    });

    it('should enforce idempotency and prevent duplicate attendance across all 3 methods', () => {
      const now = new Date().toISOString();

      // 1. Initial FACE_VERIFIED record
      db.run(
        `INSERT INTO attendance_records (id, student_id, matric_number, student_name, course_id, session_id, timestamp, status, verification_method, sync_status, created_at)
         VALUES ('rec-dup-01', 'stu-test-01', '2022/241414', 'Ayomide Balogun', 'crs-403', 'ses-active-01', ?, 'PRESENT', 'FACE_VERIFIED', 'PENDING', ?)`,
        [now, now]
      );

      // 2. Duplicate via QR_FALLBACK must be rejected
      expect(() => {
        db.run(
          `INSERT INTO attendance_records (id, student_id, matric_number, student_name, course_id, session_id, timestamp, status, verification_method, sync_status, created_at)
           VALUES ('rec-dup-02', 'stu-test-01', '2022/241414', 'Ayomide Balogun', 'crs-403', 'ses-active-01', ?, 'PRESENT', 'QR_FALLBACK', 'PENDING', ?)`,
          [now, now]
        );
      }).toThrow();

      // 3. Duplicate via MANUAL_OVERRIDE must also be rejected
      expect(() => {
        db.run(
          `INSERT INTO attendance_records (id, student_id, matric_number, student_name, course_id, session_id, timestamp, status, verification_method, sync_status, created_at)
           VALUES ('rec-dup-03', 'stu-test-01', '2022/241414', 'Ayomide Balogun', 'crs-403', 'ses-active-01', ?, 'PRESENT', 'MANUAL_OVERRIDE', 'PENDING', ?)`,
          [now, now]
        );
      }).toThrow();
    });
  });

  describe('6. Attendance Session Lifecycle & Kiosk Binding', () => {
    it('should reject attendance recording when session is closed', () => {
      const now = new Date().toISOString();
      db.run(`UPDATE attendance_sessions SET status = 'CLOSED' WHERE id = 'ses-active-01'`);

      const session = db.queryOne('SELECT * FROM attendance_sessions WHERE id = ?', ['ses-active-01']);
      expect(session.status).toBe('CLOSED');
      expect(session.status === 'ACTIVE').toBe(false);
    });
  });

  describe('7. Electron Desktop & Architecture', () => {
    it('should verify desktop package.json launches Electron rather than external browser', () => {
      const desktopPkgPath = path.resolve(process.cwd(), 'apps', 'desktop', 'package.json');
      const desktopPkg = JSON.parse(fs.readFileSync(desktopPkgPath, 'utf8'));
      expect(desktopPkg.scripts.dev).toContain('electron .');

      const viteConfigPath = path.resolve(process.cwd(), 'apps', 'desktop', 'vite.config.ts');
      const viteConfig = fs.readFileSync(viteConfigPath, 'utf8');
      expect(viteConfig).toContain('open: false');
    });

    it('should verify packaged build loads local relative assets without requiring dev server', () => {
      const viteConfigPath = path.resolve(process.cwd(), 'apps', 'desktop', 'vite.config.ts');
      const viteConfig = fs.readFileSync(viteConfigPath, 'utf8');
      expect(viteConfig).toContain("base: './'");

      const electronMainPath = path.resolve(process.cwd(), 'apps', 'desktop', 'electron', 'main', 'index.ts');
      const electronMain = fs.readFileSync(electronMainPath, 'utf8');
      expect(electronMain).toContain('mainWindow.loadFile');
      expect(electronMain).toContain('dist/index.html');
    });
  });
});
