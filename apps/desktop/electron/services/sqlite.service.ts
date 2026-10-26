import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { SqliteDatabaseClient } from './db-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import {
  Student,
  Course,
  Lecturer,
  Enrollment,
  AttendanceSession,
  AttendanceRecord,
  VerificationMethod,
  FaceTemplate,
  AuditLog,
  SyncEvent,
} from '@classguard/shared';

export class DesktopDatabaseService {
  private static instance: DesktopDatabaseService;
  private client: SqliteDatabaseClient;
  private initialized = false;

  private constructor() {
    // Resolve database file path across monorepo cwd variations
    const candidatePaths = [
      path.resolve(process.cwd(), 'database', 'classguard.sqlite'),
      path.resolve(process.cwd(), '..', '..', 'database', 'classguard.sqlite'),
      path.resolve(process.cwd(), '..', 'database', 'classguard.sqlite'),
      path.resolve(__dirname, '../../../../database/classguard.sqlite'),
    ];
    const dbPath = candidatePaths.find((p) => fs.existsSync(p)) || candidatePaths[0];
    this.client = new SqliteDatabaseClient(dbPath);
  }

  public static getInstance(): DesktopDatabaseService {
    if (!DesktopDatabaseService.instance) {
      DesktopDatabaseService.instance = new DesktopDatabaseService();
    }
    return DesktopDatabaseService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.client.init();
    this.client.migrate();
    this.initialized = true;
  }

  public setClient(client: SqliteDatabaseClient): void {
    this.client = client;
    this.initialized = true;
  }

  // --- Users & Auth ---
  public getUserByEmail(email: string): any {
    return this.client.queryOne(
      'SELECT id, username, email, password_hash as passwordHash, role, full_name as fullName, active FROM users WHERE email = ?',
      [email.toLowerCase()]
    );
  }

  public getUserById(id: string): any {
    return this.client.queryOne(
      'SELECT id, username, email, password_hash as passwordHash, role, full_name as fullName, active FROM users WHERE id = ?',
      [id]
    );
  }

  public getUsers(): any[] {
    return this.client.query(
      'SELECT id, username, email, role, full_name as fullName, active FROM users'
    );
  }

  // --- Students ---
  public getStudents(search?: string): Student[] {
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      return this.client.query(
        `SELECT id, matric_number as matricNumber, full_name as fullName, department, level, email, active, has_face_enrolled as hasFaceEnrolled, qr_credential as qrCredential, created_at as createdAt, updated_at as updatedAt
         FROM students
         WHERE matric_number LIKE ? OR full_name LIKE ?
         ORDER BY matric_number ASC`,
        [term, term]
      );
    }
    return this.client.query(
      `SELECT id, matric_number as matricNumber, full_name as fullName, department, level, email, active, has_face_enrolled as hasFaceEnrolled, qr_credential as qrCredential, created_at as createdAt, updated_at as updatedAt
       FROM students
       ORDER BY matric_number ASC`
    );
  }

  public getStudentByMatric(matric: string): Student | null {
    return this.client.queryOne(
      `SELECT id, matric_number as matricNumber, full_name as fullName, department, level, email, active, has_face_enrolled as hasFaceEnrolled, qr_credential as qrCredential, created_at as createdAt, updated_at as updatedAt
       FROM students
       WHERE matric_number = ?`,
      [matric.trim().toUpperCase()]
    );
  }

  public getStudentById(id: string): Student | null {
    return this.client.queryOne(
      `SELECT id, matric_number as matricNumber, full_name as fullName, department, level, email, active, has_face_enrolled as hasFaceEnrolled, qr_credential as qrCredential, created_at as createdAt, updated_at as updatedAt
       FROM students
       WHERE id = ?`,
      [id]
    );
  }

  public createStudent(data: {
    matricNumber: string;
    fullName: string;
    department: string;
    level: string;
    email?: string;
    qrCredential?: string;
  }): Student {
    const id = `stu-${Date.now()}`;
    const now = new Date().toISOString();
    this.client.run(
      `INSERT INTO students (id, matric_number, full_name, department, level, email, active, has_face_enrolled, qr_credential, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?)`,
      [id, data.matricNumber.toUpperCase(), data.fullName, data.department, data.level, data.email || null, data.qrCredential || null, now, now]
    );
    return this.getStudentById(id)!;
  }

  public updateStudent(
    id: string,
    data: {
      fullName?: string;
      department?: string;
      level?: string;
      email?: string;
      active?: boolean;
    }
  ): Student | null {
    const student = this.getStudentById(id);
    if (!student) return null;
    const now = new Date().toISOString();
    this.client.run(
      `UPDATE students
       SET full_name = coalesce(?, full_name),
           department = coalesce(?, department),
           level = coalesce(?, level),
           email = coalesce(?, email),
           active = coalesce(?, active),
           updated_at = ?
       WHERE id = ?`,
      [
        data.fullName ?? null,
        data.department ?? null,
        data.level ?? null,
        data.email ?? null,
        data.active !== undefined ? (data.active ? 1 : 0) : null,
        now,
        id,
      ]
    );
    return this.getStudentById(id);
  }

  public deleteStudent(id: string): boolean {
    const res = this.client.run(`DELETE FROM students WHERE id = ?`, [id]);
    return res.changes > 0;
  }

  public updateStudentQrCredential(studentId: string, credentialString: string): void {
    const now = new Date().toISOString();
    this.client.run(`UPDATE students SET qr_credential = ?, updated_at = ? WHERE id = ?`, [
      credentialString,
      now,
      studentId,
    ]);
  }

  // --- Biometric Face Templates ---
  public enrollFaceTemplate(studentId: string, embedding: number[]): void {
    const student = this.getStudentById(studentId);
    if (!student) throw new Error('Student not found');

    const id = `tpl-${studentId}`;
    const now = new Date().toISOString();
    const embeddingJson = JSON.stringify(embedding);

    this.client.run(
      `INSERT OR REPLACE INTO face_templates (id, student_id, matric_number, embedding, algorithm, version, sample_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'FaceRecognitionNet-128D', '1.0', 1, ?, ?)`,
      [id, studentId, student.matricNumber, embeddingJson, now, now]
    );

    this.client.run(
      `UPDATE students SET has_face_enrolled = 1, updated_at = ? WHERE id = ?`,
      [now, studentId]
    );
  }

  public getFaceTemplateByStudentId(studentId: string): FaceTemplate | null {
    const row = this.client.queryOne(
      `SELECT id, student_id as studentId, matric_number as matricNumber, embedding, algorithm, version, sample_count as sampleCount, created_at as createdAt, updated_at as updatedAt
       FROM face_templates
       WHERE student_id = ?`,
      [studentId]
    );
    if (!row) return null;
    let embedding: number[] | null = null;
    if (typeof row.embedding === 'string') {
      try {
        embedding = JSON.parse(row.embedding);
      } catch {
        console.error(`[SQLite] Corrupted face template JSON for studentId: ${studentId}`);
        embedding = null;
      }
    } else if (Array.isArray(row.embedding)) {
      embedding = row.embedding;
    }

    return {
      ...row,
      embedding: embedding as any,
    };
  }

  public getFaceTemplateByMatric(matric: string): FaceTemplate | null {
    const student = this.getStudentByMatric(matric);
    if (!student) return null;
    return this.getFaceTemplateByStudentId(student.id);
  }

  public deleteFaceTemplate(studentId: string): void {
    const now = new Date().toISOString();
    this.client.run(`DELETE FROM face_templates WHERE student_id = ?`, [studentId]);
    this.client.run(`UPDATE students SET has_face_enrolled = 0, updated_at = ? WHERE id = ?`, [now, studentId]);
  }

  // --- Courses ---
  public getCourses(): Course[] {
    return this.client.query(
      `SELECT c.id, c.code, c.title, c.department, c.level, c.credit_units as creditUnits, c.lecturer_id as lecturerId, l.full_name as lecturerName, c.active, c.created_at as createdAt, c.updated_at as updatedAt
       FROM courses c
       LEFT JOIN lecturers l ON c.lecturer_id = l.id
       ORDER BY c.code ASC`
    );
  }

  public getCourseById(id: string): Course | null {
    return this.client.queryOne(
      `SELECT c.id, c.code, c.title, c.department, c.level, c.credit_units as creditUnits, c.lecturer_id as lecturerId, l.full_name as lecturerName, c.active, c.created_at as createdAt, c.updated_at as updatedAt
       FROM courses c
       LEFT JOIN lecturers l ON c.lecturer_id = l.id
       WHERE c.id = ?`,
      [id]
    );
  }

  public createCourse(data: { code: string; title: string; department: string; level: string; creditUnits: number; lecturerId?: string }): Course {
    const id = `crs-${Date.now()}`;
    const now = new Date().toISOString();
    this.client.run(
      `INSERT INTO courses (id, code, title, department, level, credit_units, lecturer_id, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, data.code.toUpperCase(), data.title, data.department, data.level, data.creditUnits, data.lecturerId || null, now, now]
    );
    return this.getCourseById(id)!;
  }

  // --- Lecturers ---
  public getLecturers(): Lecturer[] {
    return this.client.query(
      `SELECT id, staff_id as staffId, full_name as fullName, email, department, user_id as userId, active, created_at as createdAt, updated_at as updatedAt
       FROM lecturers
       ORDER BY full_name ASC`
    );
  }

  // --- Enrollments ---
  public getEnrollmentsByCourse(courseId: string): Enrollment[] {
    return this.client.query(
      `SELECT e.id, e.student_id as studentId, e.course_id as courseId, e.academic_session as academicSession, e.semester, e.status, e.created_at as createdAt, e.updated_at as updatedAt,
              s.matric_number as studentMatric, s.full_name as studentName, s.has_face_enrolled as hasFaceEnrolled
       FROM enrollments e
       JOIN students s ON e.student_id = s.id
       WHERE e.course_id = ? AND e.status = 'ENROLLED'
       ORDER BY s.matric_number ASC`,
      [courseId]
    );
  }

  public isStudentEnrolled(studentId: string, courseId: string): boolean {
    const row = this.client.queryOne(
      `SELECT id FROM enrollments WHERE student_id = ? AND course_id = ? AND status = 'ENROLLED'`,
      [studentId, courseId]
    );
    return !!row;
  }

  public enrollStudent(studentId: string, courseId: string, academicSession = '2025/2026', semester = 'First'): void {
    const id = `enr-${studentId}-${courseId}`;
    const now = new Date().toISOString();
    this.client.run(
      `INSERT OR REPLACE INTO enrollments (id, student_id, course_id, academic_session, semester, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'ENROLLED', ?, ?)`,
      [id, studentId, courseId, academicSession, semester, now, now]
    );
  }

  // --- Attendance Sessions ---
  public getSessions(courseId?: string): AttendanceSession[] {
    let sql = `SELECT s.id, s.course_id as courseId, c.code as courseCode, c.title as courseTitle,
                      s.lecturer_id as lecturerId, l.full_name as lecturerName,
                      s.title, s.session_date as sessionDate, s.opening_time as openingTime, s.closing_time as closingTime,
                      s.late_threshold_minutes as lateThresholdMinutes, s.status, s.public_key as publicKey,
                      s.qr_rotate_seconds as qrRotateSeconds, s.created_at as createdAt, s.updated_at as updatedAt
               FROM attendance_sessions s
               JOIN courses c ON s.course_id = c.id
               JOIN lecturers l ON s.lecturer_id = l.id`;

    if (courseId) {
      sql += ` WHERE s.course_id = ? ORDER BY s.session_date DESC, s.opening_time DESC`;
      return this.client.query(sql, [courseId]);
    } else {
      sql += ` ORDER BY s.session_date DESC, s.opening_time DESC`;
      return this.client.query(sql);
    }
  }

  public getSessionById(id: string): AttendanceSession | null {
    return this.client.queryOne(
      `SELECT s.id, s.course_id as courseId, c.code as courseCode, c.title as courseTitle,
              s.lecturer_id as lecturerId, l.full_name as lecturerName,
              s.title, s.session_date as sessionDate, s.opening_time as openingTime, s.closing_time as closingTime,
              s.late_threshold_minutes as lateThresholdMinutes, s.status, s.public_key as publicKey, s.private_key as privateKey,
              s.qr_rotate_seconds as qrRotateSeconds, s.created_at as createdAt, s.updated_at as updatedAt
       FROM attendance_sessions s
       JOIN courses c ON s.course_id = c.id
       JOIN lecturers l ON s.lecturer_id = l.id
       WHERE s.id = ?`,
      [id]
    );
  }

  public createSession(data: {
    courseId: string;
    lecturerId: string;
    title: string;
    sessionDate: string;
    openingTime: string;
    closingTime: string;
    lateThresholdMinutes: number;
    publicKey?: string;
    privateKey?: string;
    qrRotateSeconds?: number;
  }): AttendanceSession {
    const id = `ses-${Date.now()}`;
    const now = new Date().toISOString();
    this.client.run(
      `INSERT INTO attendance_sessions (id, course_id, lecturer_id, title, session_date, opening_time, closing_time, late_threshold_minutes, status, public_key, private_key, qr_rotate_seconds, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?)`,
      [
        id,
        data.courseId,
        data.lecturerId,
        data.title,
        data.sessionDate,
        data.openingTime,
        data.closingTime,
        data.lateThresholdMinutes || 15,
        data.publicKey || null,
        data.privateKey || null,
        data.qrRotateSeconds || 30,
        now,
        now,
      ]
    );
    return this.getSessionById(id)!;
  }

  public closeSession(id: string): void {
    const now = new Date().toISOString();
    this.client.run(`UPDATE attendance_sessions SET status = 'CLOSED', updated_at = ? WHERE id = ?`, [now, id]);
  }

  // --- Attendance Records ---
  public getAttendanceRecord(studentId: string, sessionId: string): AttendanceRecord | null {
    return this.client.queryOne(
      `SELECT id, student_id as studentId, matric_number as matricNumber, student_name as studentName,
              course_id as courseId, session_id as sessionId, timestamp, status, verification_method as verificationMethod,
              similarity_score as similarityScore, liveness_passed as livenessPassed, kiosk_id as kioskId, notes,
              sync_status as syncStatus, synced_at as syncedAt, created_at as createdAt
       FROM attendance_records
       WHERE student_id = ? AND session_id = ?`,
      [studentId, sessionId]
    );
  }

  public getRecordsBySession(sessionId: string): AttendanceRecord[] {
    return this.client.query(
      `SELECT id, student_id as studentId, matric_number as matricNumber, student_name as studentName,
              course_id as courseId, session_id as sessionId, timestamp, status, verification_method as verificationMethod,
              similarity_score as similarityScore, liveness_passed as livenessPassed, kiosk_id as kioskId, notes,
              sync_status as syncStatus, synced_at as syncedAt, created_at as createdAt
       FROM attendance_records
       WHERE session_id = ?
       ORDER BY timestamp DESC`,
      [sessionId]
    );
  }

  public getRecordsByCourse(courseId: string): AttendanceRecord[] {
    return this.client.query(
      `SELECT id, student_id as studentId, matric_number as matricNumber, student_name as studentName,
              course_id as courseId, session_id as sessionId, timestamp, status, verification_method as verificationMethod,
              similarity_score as similarityScore, liveness_passed as livenessPassed, kiosk_id as kioskId, notes,
              sync_status as syncStatus, synced_at as syncedAt, created_at as createdAt
       FROM attendance_records
       WHERE course_id = ?
       ORDER BY timestamp DESC`,
      [courseId]
    );
  }

  public insertAttendanceRecord(record: {
    id: string;
    studentId: string;
    matricNumber: string;
    studentName: string;
    courseId: string;
    sessionId: string;
    timestamp: string;
    status: 'PRESENT' | 'LATE' | 'EXCUSED';
    verificationMethod: VerificationMethod;
    similarityScore?: number;
    livenessPassed?: boolean;
    kioskId?: string;
    notes?: string;
  }): AttendanceRecord {
    const now = new Date().toISOString();
    // Insert record with uniqueness constraint
    this.client.run(
      `INSERT INTO attendance_records (id, student_id, matric_number, student_name, course_id, session_id, timestamp, status, verification_method, similarity_score, liveness_passed, kiosk_id, notes, sync_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
      [
        record.id,
        record.studentId,
        record.matricNumber,
        record.studentName,
        record.courseId,
        record.sessionId,
        record.timestamp,
        record.status,
        record.verificationMethod,
        record.similarityScore ?? null,
        record.livenessPassed ? 1 : 0,
        record.kioskId || 'KIOSK-01',
        record.notes || null,
        now,
      ]
    );

    // Queue for central synchronization
    this.client.run(
      `INSERT INTO sync_queue (id, event_type, entity_id, payload, status, retry_count, created_at)
       VALUES (?, 'ATTENDANCE_RECORDED', ?, ?, 'PENDING', 0, ?)`,
      [`sync-${record.id}`, record.id, JSON.stringify(record), now]
    );

    return this.getAttendanceRecord(record.studentId, record.sessionId)!;
  }

  // --- Synchronization ---
  public getPendingSyncRecords(): AttendanceRecord[] {
    return this.client.query(
      `SELECT id, student_id as studentId, matric_number as matricNumber, student_name as studentName,
              course_id as courseId, session_id as sessionId, timestamp, status, verification_method as verificationMethod,
              similarity_score as similarityScore, liveness_passed as livenessPassed, kiosk_id as kioskId, notes,
              sync_status as syncStatus, synced_at as syncedAt, created_at as createdAt
       FROM attendance_records
       WHERE sync_status = 'PENDING'`
    );
  }

  public markRecordsSynced(acknowledgedIds: string[]): void {
    const now = new Date().toISOString();
    for (const id of acknowledgedIds) {
      this.client.run(
        `UPDATE attendance_records SET sync_status = 'SYNCED', synced_at = ? WHERE id = ?`,
        [now, id]
      );
      this.client.run(
        `UPDATE sync_queue SET status = 'SYNCED', synced_at = ? WHERE entity_id = ?`,
        [now, id]
      );
    }
  }

  public getSyncStatus(): { pendingCount: number; syncedCount: number; lastSyncedAt?: string } {
    const pendingRow = this.client.queryOne(`SELECT COUNT(*) as cnt FROM attendance_records WHERE sync_status = 'PENDING'`);
    const syncedRow = this.client.queryOne(`SELECT COUNT(*) as cnt FROM attendance_records WHERE sync_status = 'SYNCED'`);
    const lastRow = this.client.queryOne(`SELECT synced_at FROM attendance_records WHERE synced_at IS NOT NULL ORDER BY synced_at DESC LIMIT 1`);

    return {
      pendingCount: pendingRow?.cnt || 0,
      syncedCount: syncedRow?.cnt || 0,
      lastSyncedAt: lastRow?.synced_at || undefined,
    };
  }

  // --- Audit Logs ---
  public logAudit(userId: string | undefined, username: string | undefined, action: string, entityType: string, entityId: string | undefined, details: string): void {
    const id = `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    this.client.run(
      `INSERT INTO audit_logs (id, user_id, username, action, entity_type, entity_id, details, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId || null, username || null, action, entityType, entityId || null, details, now]
    );
  }

  public getAuditLogs(limit = 100): AuditLog[] {
    return this.client.query(
      `SELECT id, user_id as userId, username, action, entity_type as entityType, entity_id as entityId, details, ip_address as ipAddress, timestamp
       FROM audit_logs
       ORDER BY timestamp DESC
       LIMIT ?`,
      [limit]
    );
  }

  // --- Superadmin / Lecturer Management ---
  public createLecturerUser(data: { staffId: string; fullName: string; email: string; department: string; password?: string }): { success: boolean; lecturer?: Lecturer; error?: string } {
    try {
      const existingLecturer = this.client.queryOne('SELECT id FROM lecturers WHERE email = ? OR staff_id = ?', [data.email.toLowerCase(), data.staffId.trim().toUpperCase()]);
      if (existingLecturer) {
        return { success: false, error: 'A lecturer with this email or staff ID already exists.' };
      }
      const existingUser = this.getUserByEmail(data.email);
      if (existingUser) {
        return { success: false, error: 'A user account with this email already exists.' };
      }

      const userId = `usr-lec-${Date.now()}`;
      const lecturerId = `lec-${Date.now()}`;
      const now = new Date().toISOString();
      const password = data.password || 'Lecturer@123';
      const passwordHash = bcrypt.hashSync(password, 10);
      const username = data.email.split('@')[0] || `lec_${Date.now()}`;

      // Insert user account with role ADMIN (Lecturer)
      this.client.run(
        `INSERT INTO users (id, username, email, password_hash, role, full_name, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'ADMIN', ?, 1, ?, ?)`,
        [userId, username, data.email.toLowerCase(), passwordHash, data.fullName, now, now]
      );

      // Insert lecturer record
      this.client.run(
        `INSERT INTO lecturers (id, staff_id, full_name, email, department, user_id, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [lecturerId, data.staffId.trim().toUpperCase(), data.fullName, data.email.toLowerCase(), data.department, userId, now, now]
      );

      return {
        success: true,
        lecturer: this.client.queryOne('SELECT id, staff_id as staffId, full_name as fullName, email, department, user_id as userId, active, created_at as createdAt, updated_at as updatedAt FROM lecturers WHERE id = ?', [lecturerId]) ?? undefined,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public toggleLecturerActive(lecturerId: string, active: boolean): boolean {
    const now = new Date().toISOString();
    const lecturer = this.client.queryOne('SELECT user_id as userId FROM lecturers WHERE id = ?', [lecturerId]);
    this.client.run('UPDATE lecturers SET active = ?, updated_at = ? WHERE id = ?', [active ? 1 : 0, now, lecturerId]);
    if (lecturer?.userId) {
      this.client.run('UPDATE users SET active = ?, updated_at = ? WHERE id = ?', [active ? 1 : 0, now, lecturer.userId]);
    }
    return true;
  }

  public getSuperadminStats(): any {
    const lecturers = this.client.queryOne('SELECT COUNT(*) as count FROM lecturers');
    const courses = this.client.queryOne('SELECT COUNT(*) as count FROM courses');
    const activeSessions = this.client.queryOne("SELECT COUNT(*) as count FROM attendance_sessions WHERE status = 'ACTIVE'");
    const totalSessions = this.client.queryOne('SELECT COUNT(*) as count FROM attendance_sessions');
    const auditLogs = this.client.queryOne('SELECT COUNT(*) as count FROM audit_logs');
    const syncStatus = this.getSyncStatus();

    return {
      lecturersCount: lecturers?.count || 0,
      coursesCount: courses?.count || 0,
      activeSessionsCount: activeSessions?.count || 0,
      totalSessionsCount: totalSessions?.count || 0,
      auditLogsCount: auditLogs?.count || 0,
      pendingSyncCount: syncStatus.pendingCount,
      syncedCount: syncStatus.syncedCount,
      deviceStatus: 'HEALTHY_LOCAL_STATION',
    };
  }

  // --- Student Attendance History & Summary ---
  public getStudentAttendanceHistory(matricNumber: string): AttendanceRecord[] {
    const student = this.getStudentByMatric(matricNumber);
    if (!student) return [];
    return this.client.query(
      `SELECT r.id, r.student_id as studentId, r.matric_number as matricNumber, r.student_name as studentName,
              r.course_id as courseId, c.code as courseCode, r.session_id as sessionId, s.title as sessionTitle,
              r.timestamp, r.status, r.verification_method as verificationMethod,
              r.similarity_score as similarityScore, r.sync_status as syncStatus, r.created_at as createdAt
       FROM attendance_records r
       LEFT JOIN courses c ON r.course_id = c.id
       LEFT JOIN attendance_sessions s ON r.session_id = s.id
       WHERE r.student_id = ?
       ORDER BY r.timestamp DESC`,
      [student.id]
    );
  }

  public getStudentAttendanceSummary(matricNumber: string): any {
    const student = this.getStudentByMatric(matricNumber);
    if (!student) return null;

    const enrollments = this.client.query(
      `SELECT e.course_id as courseId, c.code as courseCode, c.title as courseTitle
       FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       WHERE e.student_id = ? AND e.status = 'ENROLLED'`,
      [student.id]
    );

    const records = this.client.query(
      `SELECT course_id as courseId, status FROM attendance_records WHERE student_id = ?`,
      [student.id]
    );

    const summaries = enrollments.map((e: any) => {
      const closedSessions = this.client.query(
        `SELECT id FROM attendance_sessions WHERE course_id = ? AND status = 'CLOSED'`,
        [e.courseId]
      );
      const studentRecords = records.filter((r: any) => r.courseId === e.courseId);
      const presentCount = studentRecords.filter((r: any) => r.status === 'PRESENT').length;
      const lateCount = studentRecords.filter((r: any) => r.status === 'LATE').length;
      const totalAttended = presentCount + lateCount;
      const eligible = closedSessions.length;
      const percentage = eligible > 0 ? Math.min(100, Math.round((totalAttended / eligible) * 100)) : 100;

      return {
        courseId: e.courseId,
        courseCode: e.courseCode,
        courseTitle: e.courseTitle,
        presentCount,
        lateCount,
        totalAttended,
        eligibleSessions: eligible,
        attendancePercentage: percentage,
      };
    });

    return {
      student,
      courseSummaries: summaries,
      totalCourses: enrollments.length,
    };
  }
}
