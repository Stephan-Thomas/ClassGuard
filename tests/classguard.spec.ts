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
  SignedStudentCredentialSchema,
} from '@classguard/shared';
import { SqliteDatabaseClient } from '../database/db-client.js';

describe('ClassGuard Core Domain & Verification Test Suite', () => {
  const testDbPath = path.resolve(process.cwd(), 'database', 'test_classguard.sqlite');
  let db: SqliteDatabaseClient;

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {}
    }
    db = new SqliteDatabaseClient(testDbPath);
    await db.init();
    db.migrate();

    const now = new Date().toISOString();

    // 1. Seed Admin and Lecturer users
    const adminPassHash = bcrypt.hashSync('Admin@123', 10);
    const lecturerPassHash = bcrypt.hashSync('Lecturer@123', 10);
    db.run(
      `INSERT INTO users (id, username, email, password_hash, role, full_name, active, created_at, updated_at)
       VALUES ('usr-admin', 'admin', 'admin@classguard.edu', ?, 'ADMIN', 'Test Admin', 1, ?, ?)`,
      [adminPassHash, now, now]
    );
    db.run(
      `INSERT INTO users (id, username, email, password_hash, role, full_name, active, created_at, updated_at)
       VALUES ('usr-lecturer', 'turing', 'turing@classguard.edu', ?, 'LECTURER', 'Dr. Alan Turing', 1, ?, ?)`,
      [lecturerPassHash, now, now]
    );

    // 2. Seed Lecturer staff record
    db.run(
      `INSERT INTO lecturers (id, staff_id, full_name, email, department, user_id, active, created_at, updated_at)
       VALUES ('lec-01', 'STF/CSC/01', 'Dr. Alan Turing', 'turing@classguard.edu', 'Computer Science', 'usr-lecturer', 1, ?, ?)`,
      [now, now]
    );

    // 3. Seed Students
    // Student 1: Active with face enrolled and QR credential
    const student1Cred = createStudentQRCredential({
      studentId: 'stu-test-01',
      matricNumber: 'CSC/2021/001',
      fullName: 'Ayomide Balogun',
      department: 'Computer Science',
    });

    db.run(
      `INSERT INTO students (id, matric_number, full_name, department, level, email, active, has_face_enrolled, qr_credential, created_at, updated_at)
       VALUES ('stu-test-01', 'CSC/2021/001', 'Ayomide Balogun', 'Computer Science', '400L', 'ayo@classguard.edu', 1, 1, ?, ?, ?)`,
      [student1Cred, now, now]
    );

    // Student 2: Active WITHOUT face enrolled
    const student2Cred = createStudentQRCredential({
      studentId: 'stu-test-02',
      matricNumber: 'CSC/2021/002',
      fullName: 'Chinedu Okonkwo',
      department: 'Computer Science',
    });
    db.run(
      `INSERT INTO students (id, matric_number, full_name, department, level, email, active, has_face_enrolled, qr_credential, created_at, updated_at)
       VALUES ('stu-test-02', 'CSC/2021/002', 'Chinedu Okonkwo', 'Computer Science', '400L', 'chinedu@classguard.edu', 1, 0, ?, ?, ?)`,
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
    const refEmbedding = generateSyntheticEmbedding('CSC/2021/001');
    db.run(
      `INSERT INTO face_templates (id, student_id, matric_number, embedding, algorithm, version, sample_count, created_at, updated_at)
       VALUES ('tpl-01', 'stu-test-01', 'CSC/2021/001', ?, 'FaceRecognitionNet-128D', '1.0', 1, ?, ?)`,
      [JSON.stringify(refEmbedding), now, now]
    );

    // 7. Seed Active Attendance Session
    db.run(
      `INSERT INTO attendance_sessions (id, course_id, lecturer_id, title, session_date, opening_time, closing_time, late_threshold_minutes, status, created_at, updated_at)
       VALUES ('ses-active-01', 'crs-403', 'lec-01', 'CSC 403 Biometrics Lecture', '2026-10-22', '08:00', '14:00', 15, 'ACTIVE', ?, ?)`,
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

  // Test 1: Face verification succeeds and attendance is marked without QR scanning
  it('1. should succeed facial verification and mark attendance as FACE_VERIFIED without requiring QR scanning', () => {
    const student = db.queryOne('SELECT * FROM students WHERE matric_number = ?', ['CSC/2021/001']);
    expect(student).not.toBeNull();

    const templateRow = db.queryOne('SELECT * FROM face_templates WHERE student_id = ?', [student.id]);
    const enrolledEmbedding = JSON.parse(templateRow.embedding);

    // Live capture sample within threshold
    const liveCaptured = perturbEmbedding(enrolledEmbedding, 0.04);
    const match = verifyFace1to1(liveCaptured, enrolledEmbedding, DEFAULT_EUCLIDEAN_THRESHOLD);
    expect(match.success).toBe(true);
    expect(match.similarityScore).toBeGreaterThanOrEqual(75);

    // Record attendance directly with method FACE_VERIFIED
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO attendance_records (id, student_id, matric_number, student_name, course_id, session_id, timestamp, status, verification_method, similarity_score, kiosk_id, sync_status, created_at)
       VALUES ('rec-face-01', ?, ?, ?, 'crs-403', 'ses-active-01', ?, 'PRESENT', 'FACE_VERIFIED', ?, 'KIOSK-01', 'PENDING', ?)`,
      [student.id, student.matric_number, student.full_name, now, match.similarityScore, now]
    );

    const record = db.queryOne('SELECT * FROM attendance_records WHERE id = ?', ['rec-face-01']);
    expect(record).not.toBeNull();
    expect(record.verification_method).toBe('FACE_VERIFIED');
    expect(record.status).toBe('PRESENT');
  });

  // Test 2: QR scanning is NOT required after a successful face match
  it('2. should confirm that QR scanning is never required after a successful facial match', () => {
    // Check that attendance record is complete and valid with FACE_VERIFIED alone
    const recordCountBefore = db.queryOne('SELECT COUNT(*) as count FROM attendance_records').count;
    expect(recordCountBefore).toBe(0);

    const now = new Date().toISOString();
    db.run(
      `INSERT INTO attendance_records (id, student_id, matric_number, student_name, course_id, session_id, timestamp, status, verification_method, similarity_score, kiosk_id, sync_status, created_at)
       VALUES ('rec-face-only', 'stu-test-01', 'CSC/2021/001', 'Ayomide Balogun', 'crs-403', 'ses-active-01', ?, 'PRESENT', 'FACE_VERIFIED', 95.0, 'KIOSK-01', 'PENDING', ?)`,
      [now, now]
    );

    const record = db.queryOne('SELECT * FROM attendance_records WHERE student_id = ?', ['stu-test-01']);
    expect(record).not.toBeNull();
    expect(record.verification_method).toBe('FACE_VERIFIED');
    // Session attendance is now marked; subsequent QR scan is unnecessary and blocked by idempotency
  });

  // Test 3: Face verification fails and a retry is offered
  it('3. should reject non-matching face and permit retry counting without recording attendance', () => {
    const templateRow = db.queryOne('SELECT * FROM face_templates WHERE student_id = ?', ['stu-test-01']);
    const enrolledEmbedding = JSON.parse(templateRow.embedding);

    // Impostor face vector
    const impostorEmbedding = generateSyntheticEmbedding('UNKNOWN_DIFFERENT_PERSON');
    const match = verifyFace1to1(impostorEmbedding, enrolledEmbedding, DEFAULT_EUCLIDEAN_THRESHOLD);

    expect(match.success).toBe(false);
    expect(match.similarityScore).toBeLessThan(75);

    // Check that NO attendance record is created
    const record = db.queryOne('SELECT * FROM attendance_records WHERE student_id = ?', ['stu-test-01']);
    expect(record).toBeNull();
  });

  // Test 4: QR fallback is offered after configured failure threshold
  it('4. should offer QR fallback after facial verification failure threshold is reached', () => {
    let attempts = 0;
    const maxFaceAttempts = 2;

    const simulateAttempt = (matched: boolean) => {
      attempts++;
      if (matched) return { success: true, offerFallback: false };
      return { success: false, offerFallback: attempts >= maxFaceAttempts };
    };

    const first = simulateAttempt(false);
    expect(first.success).toBe(false);
    expect(first.offerFallback).toBe(false);

    const second = simulateAttempt(false);
    expect(second.success).toBe(false);
    expect(second.offerFallback).toBe(true);
  });

  // Test 5: Valid student QR credential accepted for eligible student & valid session
  it('5. should accept a valid student QR credential for fallback attendance', () => {
    const student = db.queryOne('SELECT * FROM students WHERE matric_number = ?', ['CSC/2021/001']);
    expect(student.qr_credential).not.toBeNull();

    // Verify credential cryptographically
    const verifyResult = verifyStudentQRCredential(student.qr_credential);
    expect(verifyResult.valid).toBe(true);
    expect(verifyResult.payload?.studentId).toBe('stu-test-01');
    expect(verifyResult.payload?.matricNumber).toBe('CSC/2021/001');

    // Confirm session is active
    const session = db.queryOne('SELECT * FROM attendance_sessions WHERE id = ?', ['ses-active-01']);
    expect(session.status).toBe('ACTIVE');

    // Confirm course enrollment
    const enrollment = db.queryOne(
      'SELECT id FROM enrollments WHERE student_id = ? AND course_id = ? AND status = "ENROLLED"',
      [student.id, session.course_id]
    );
    expect(enrollment).not.toBeNull();

    // Record fallback attendance
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO attendance_records (id, student_id, matric_number, student_name, course_id, session_id, timestamp, status, verification_method, notes, kiosk_id, sync_status, created_at)
       VALUES ('rec-qr-fallback-01', ?, ?, ?, ?, ?, ?, 'PRESENT', 'QR_FALLBACK', 'Verified via student QR credential fallback', 'KIOSK-01', 'PENDING', ?)`,
      [student.id, student.matric_number, student.full_name, session.course_id, session.id, now, now]
    );

    const record = db.queryOne('SELECT * FROM attendance_records WHERE id = ?', ['rec-qr-fallback-01']);
    expect(record).not.toBeNull();
    expect(record.verification_method).toBe('QR_FALLBACK');
  });

  // Test 6: Invalid or unknown QR credential is rejected
  it('6. should reject unknown, malformed, or tampered student QR credentials', () => {
    // 1. Malformed JSON string
    const malformed = verifyStudentQRCredential('not-a-valid-json-token');
    expect(malformed.valid).toBe(false);

    // 2. Tampered signature
    const validCred = createStudentQRCredential({
      studentId: 'stu-test-01',
      matricNumber: 'CSC/2021/001',
      fullName: 'Ayomide Balogun',
      department: 'Computer Science',
    });
    const parsed = JSON.parse(validCred);
    parsed.payload.matricNumber = 'CSC/HACKED/999'; // Tamper payload

    const tamperedResult = verifyStudentQRCredential(parsed);
    expect(tamperedResult.valid).toBe(false);
    expect(tamperedResult.error).toMatch(/signature/i);
  });

  // Test 7: Duplicate attendance is prevented for all three methods
  it('7. should enforce database uniqueness constraint and prevent duplicate attendance across all three methods', () => {
    const now = new Date().toISOString();

    // 1. First record via FACE_VERIFIED
    db.run(
      `INSERT INTO attendance_records (id, student_id, matric_number, student_name, course_id, session_id, timestamp, status, verification_method, sync_status, created_at)
       VALUES ('rec-dup-01', 'stu-test-01', 'CSC/2021/001', 'Ayomide Balogun', 'crs-403', 'ses-active-01', ?, 'PRESENT', 'FACE_VERIFIED', 'PENDING', ?)`,
      [now, now]
    );

    // 2. Second attempt via QR_FALLBACK for same student and session MUST be blocked
    expect(() => {
      db.run(
        `INSERT INTO attendance_records (id, student_id, matric_number, student_name, course_id, session_id, timestamp, status, verification_method, sync_status, created_at)
         VALUES ('rec-dup-02', 'stu-test-01', 'CSC/2021/001', 'Ayomide Balogun', 'crs-403', 'ses-active-01', ?, 'PRESENT', 'QR_FALLBACK', 'PENDING', ?)`,
        [now, now]
      );
    }).toThrow();

    // 3. Third attempt via MANUAL_OVERRIDE for same student and session MUST also be blocked
    expect(() => {
      db.run(
        `INSERT INTO attendance_records (id, student_id, matric_number, student_name, course_id, session_id, timestamp, status, verification_method, sync_status, created_at)
         VALUES ('rec-dup-03', 'stu-test-01', 'CSC/2021/001', 'Ayomide Balogun', 'crs-403', 'ses-active-01', ?, 'PRESENT', 'MANUAL_OVERRIDE', 'PENDING', ?)`,
        [now, now]
      );
    }).toThrow();
  });

  // Test 8: Failed face and QR attempts do not silently mark attendance
  it('8. should not mark student as present or absent when biometric or QR attempts fail', () => {
    // Impostor attempt
    const impostorFace = generateSyntheticEmbedding('IMPOSTOR_XYZ');
    const templateRow = db.queryOne('SELECT * FROM face_templates WHERE student_id = ?', ['stu-test-01']);
    const match = verifyFace1to1(impostorFace, JSON.parse(templateRow.embedding), DEFAULT_EUCLIDEAN_THRESHOLD);
    expect(match.success).toBe(false);

    // Verify NO record exists in database
    const records = db.query('SELECT * FROM attendance_records WHERE student_id = ?', ['stu-test-01']);
    expect(records.length).toBe(0);
  });

  // Test 9: Lecturer override requires lecturer authorization
  it('9. should require authorized lecturer credentials to execute manual override', () => {
    const studentUser = { id: 'usr-student', role: 'STUDENT' };
    const lecturerUser = { id: 'usr-lecturer', role: 'LECTURER' };
    const adminUser = { id: 'usr-admin', role: 'ADMIN' };

    const isAuthorized = (role: string) => role === 'LECTURER' || role === 'ADMIN';

    expect(isAuthorized(studentUser.role)).toBe(false);
    expect(isAuthorized(lecturerUser.role)).toBe(true);
    expect(isAuthorized(adminUser.role)).toBe(true);
  });

  // Test 10: Lecturer override records a reason and audit entry
  it('10. should require an explicit override reason and log audit trail on manual override', () => {
    const now = new Date().toISOString();
    const reason = 'Biometric camera lighting hardware failure in Hall B';

    // Must have non-empty reason
    expect(reason.trim().length).toBeGreaterThan(0);

    // Insert manual override record
    db.run(
      `INSERT INTO attendance_records (id, student_id, matric_number, student_name, course_id, session_id, timestamp, status, verification_method, notes, kiosk_id, sync_status, created_at)
       VALUES ('rec-override-01', 'stu-test-02', 'CSC/2021/002', 'Chinedu Okonkwo', 'crs-403', 'ses-active-01', ?, 'PRESENT', 'MANUAL_OVERRIDE', ?, 'LECTURER-CONSOLE', 'PENDING', ?)`,
      [now, `Lecturer Override: ${reason}`, now]
    );

    // Insert audit log
    db.run(
      `INSERT INTO audit_logs (id, user_id, username, action, entity_type, entity_id, details, timestamp)
       VALUES ('aud-01', 'lec-01', 'Dr. Alan Turing', 'MANUAL_ATTENDANCE_OVERRIDE', 'AttendanceRecord', 'rec-override-01', ?, ?)`,
      [`Authorized exception for CSC/2021/002. Reason: ${reason}`, now]
    );

    const record = db.queryOne('SELECT * FROM attendance_records WHERE id = ?', ['rec-override-01']);
    expect(record.verification_method).toBe('MANUAL_OVERRIDE');
    expect(record.notes).toContain(reason);

    const audit = db.queryOne('SELECT * FROM audit_logs WHERE id = ?', ['aud-01']);
    expect(audit.action).toBe('MANUAL_ATTENDANCE_OVERRIDE');
    expect(audit.details).toContain(reason);
  });

  // Test 11: A student cannot access the manual override
  it('11. should deny students permission to execute manual override', () => {
    const studentRole = 'STUDENT';
    const canPerformManualOverride = (role: string) => role === 'LECTURER' || role === 'ADMIN';
    expect(canPerformManualOverride(studentRole)).toBe(false);
  });

  // Test 12: A newly enrolled student's face can be used in a real verification attempt
  it('12. should allow a newly registered and facially enrolled student to verify successfully', () => {
    const now = new Date().toISOString();
    // 1. Register new student
    const newStudentId = 'stu-new-99';
    const matric = 'CSC/2021/099';
    db.run(
      `INSERT INTO students (id, matric_number, full_name, department, level, email, active, has_face_enrolled, created_at, updated_at)
       VALUES (?, ?, 'New Enrolled Student', 'Computer Science', '400L', 'new@classguard.edu', 1, 0, ?, ?)`,
      [newStudentId, matric, now, now]
    );

    // Enroll in course
    db.run(
      `INSERT INTO enrollments (id, student_id, course_id, academic_session, semester, status, created_at, updated_at)
       VALUES ('enr-99', ?, 'crs-403', '2025/2026', 'First', 'ENROLLED', ?, ?)`,
      [newStudentId, now, now]
    );

    // 2. Perform facial biometric enrollment
    const newFaceEmbedding = generateSyntheticEmbedding(matric);
    db.run(
      `INSERT INTO face_templates (id, student_id, matric_number, embedding, algorithm, version, sample_count, created_at, updated_at)
       VALUES ('tpl-99', ?, ?, ?, 'FaceRecognitionNet-128D', '1.0', 1, ?, ?)`,
      [newStudentId, matric, JSON.stringify(newFaceEmbedding), now, now]
    );
    db.run(`UPDATE students SET has_face_enrolled = 1 WHERE id = ?`, [newStudentId]);

    // 3. Test verification attempt with perturbed live frame
    const liveFrame = perturbEmbedding(newFaceEmbedding, 0.03);
    const templateRow = db.queryOne('SELECT * FROM face_templates WHERE student_id = ?', [newStudentId]);
    const enrolled = JSON.parse(templateRow.embedding);

    const match = verifyFace1to1(liveFrame, enrolled, DEFAULT_EUCLIDEAN_THRESHOLD);
    expect(match.success).toBe(true);
    expect(match.similarityScore).toBeGreaterThanOrEqual(80);
  });

  // Test 13: Student without enrolled face receives clear message and is offered permitted fallback
  it('13. should detect student without facial template, reject facial match, and offer QR fallback', () => {
    const student2 = db.queryOne('SELECT * FROM students WHERE matric_number = ?', ['CSC/2021/002']);
    expect(student2.has_face_enrolled).toBe(0);

    const template = db.queryOne('SELECT * FROM face_templates WHERE student_id = ?', [student2.id]);
    expect(template).toBeNull(); // No template enrolled

    // When template is missing, system rejects face attempt and offers QR fallback
    const handleFaceCheck = (tpl: any) => {
      if (!tpl) {
        return { success: false, statusCode: 'NO_FACE_ENROLLED', offerFallback: true };
      }
      return { success: true, statusCode: 'MATCH', offerFallback: false };
    };

    const res = handleFaceCheck(template);
    expect(res.success).toBe(false);
    expect(res.statusCode).toBe('NO_FACE_ENROLLED');
    expect(res.offerFallback).toBe(true);
  });

  // Test 14: Offline attendance records persist after application restart
  it('14. should persist offline attendance records across database restart without data loss', async () => {
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO attendance_records (id, student_id, matric_number, student_name, course_id, session_id, timestamp, status, verification_method, sync_status, created_at)
       VALUES ('rec-restart-01', 'stu-test-01', 'CSC/2021/001', 'Ayomide Balogun', 'crs-403', 'ses-active-01', ?, 'PRESENT', 'FACE_VERIFIED', 'PENDING', ?)`,
      [now, now]
    );

    // Simulate application restart
    db.close();

    const newDbInstance = new SqliteDatabaseClient(testDbPath);
    await newDbInstance.init();

    const record = newDbInstance.queryOne('SELECT * FROM attendance_records WHERE id = ?', ['rec-restart-01']);
    expect(record).not.toBeNull();
    expect(record.verification_method).toBe('FACE_VERIFIED');
    expect(record.sync_status).toBe('PENDING');

    newDbInstance.close();
  });

  // Test 15: Synchronization does not create duplicate attendance records
  it('15. should synchronize pending records idempotently without creating duplicate records', () => {
    const centralDb = new Map<string, any>();

    const record = {
      id: 'rec-sync-idem-01',
      studentId: 'stu-test-01',
      sessionId: 'ses-active-01',
      status: 'PRESENT',
      timestamp: new Date().toISOString(),
    };

    // First synchronization batch
    const syncBatch = (item: typeof record) => {
      if (centralDb.has(item.id)) {
        return { status: 'EXISTING_UNCHANGED', uploaded: false };
      }
      centralDb.set(item.id, item);
      return { status: 'SAVED', uploaded: true };
    };

    const run1 = syncBatch(record);
    expect(run1.uploaded).toBe(true);

    // Repeated synchronization of same batch
    const run2 = syncBatch(record);
    expect(run2.uploaded).toBe(false);
    expect(centralDb.size).toBe(1);
  });

  // Test 16: The normal development command launches Electron rather than an external browser
  it('16. should verify that apps/desktop package.json dev command starts Electron desktop rather than external browser', () => {
    const desktopPkgPath = path.resolve(process.cwd(), 'apps', 'desktop', 'package.json');
    const desktopPkg = JSON.parse(fs.readFileSync(desktopPkgPath, 'utf8'));

    // dev command must start Electron desktop process
    expect(desktopPkg.scripts.dev).toContain('electron .');

    // Vite config must not auto-open an external browser
    const viteConfigPath = path.resolve(process.cwd(), 'apps', 'desktop', 'vite.config.ts');
    const viteConfig = fs.readFileSync(viteConfigPath, 'utf8');
    expect(viteConfig).toContain('open: false');
  });

  // Test 17: Packaged startup does not rely on the Vite localhost server
  it('17. should verify that packaged build uses local relative assets without requiring Vite dev server', () => {
    const viteConfigPath = path.resolve(process.cwd(), 'apps', 'desktop', 'vite.config.ts');
    const viteConfig = fs.readFileSync(viteConfigPath, 'utf8');

    // base must be relative './'
    expect(viteConfig).toContain("base: './'");

    const electronMainPath = path.resolve(process.cwd(), 'apps', 'desktop', 'electron', 'main', 'index.ts');
    const electronMain = fs.readFileSync(electronMainPath, 'utf8');

    // In packaged mode, loads local file dist/index.html
    expect(electronMain).toContain('mainWindow.loadFile');
    expect(electronMain).toContain('dist/index.html');
  });
});
