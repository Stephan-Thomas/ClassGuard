import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { SqliteDatabaseClient } from '../db-client.js';
import { generateSyntheticEmbedding, generateSessionKeyPair, createStudentQRCredential } from '@classguard/shared';

export async function runSeed(customDbPath?: string) {
  console.log('--- Initializing ClassGuard Database Seeding ---');
  const db = new SqliteDatabaseClient(customDbPath);
  await db.init();
  db.migrate();

  console.log('Schema migration applied.');

  // Password hashes
  const adminPasswordHash = bcrypt.hashSync('Admin@123', 10);
  const lecturerPasswordHash = bcrypt.hashSync('Lecturer@123', 10);
  const now = new Date().toISOString();

  // 1. Users
  const adminId = 'usr-admin-001';
  const lecturerUserId = 'usr-lecturer-001';

  db.run(
    `INSERT OR REPLACE INTO users (id, username, email, password_hash, role, full_name, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [adminId, 'admin', 'admin@classguard.edu', adminPasswordHash, 'ADMIN', 'System Administrator', now, now]
  );

  db.run(
    `INSERT OR REPLACE INTO users (id, username, email, password_hash, role, full_name, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [lecturerUserId, 'turing', 'turing@classguard.edu', lecturerPasswordHash, 'LECTURER', 'Dr. Alan Turing', now, now]
  );

  console.log('Seed: Created Admin and Lecturer users.');

  // 2. Lecturers
  const lecturers = [
    { id: 'lec-001', staffId: 'STF/CSC/01', fullName: 'Dr. Alan Turing', email: 'turing@classguard.edu', dept: 'Computer Science', userId: lecturerUserId },
    { id: 'lec-002', staffId: 'STF/CSC/02', fullName: 'Dr. Ada Lovelace', email: 'lovelace@classguard.edu', dept: 'Computer Science' },
    { id: 'lec-003', staffId: 'STF/SWE/01', fullName: 'Dr. Grace Hopper', email: 'hopper@classguard.edu', dept: 'Software Engineering' },
  ];

  for (const l of lecturers) {
    db.run(
      `INSERT OR REPLACE INTO lecturers (id, staff_id, full_name, email, department, user_id, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [l.id, l.staffId, l.fullName, l.email, l.dept, l.userId || null, now, now]
    );
  }
  console.log(`Seed: Inserted ${lecturers.length} lecturers.`);

  // 3. Courses
  const courses = [
    { id: 'crs-001', code: 'CSC 401', title: 'Distributed Systems & Cloud Computing', dept: 'Computer Science', level: '400L', units: 3, lecId: 'lec-001' },
    { id: 'crs-002', code: 'CSC 403', title: 'Computer Vision & Biometrics', dept: 'Computer Science', level: '400L', units: 3, lecId: 'lec-001' },
    { id: 'crs-003', code: 'CSC 405', title: 'Applied Cryptography & Security', dept: 'Computer Science', level: '400L', units: 3, lecId: 'lec-002' },
    { id: 'crs-004', code: 'SWE 407', title: 'Software Architecture & Design', dept: 'Software Engineering', level: '400L', units: 3, lecId: 'lec-003' },
    { id: 'crs-005', code: 'CSC 409', title: 'Database Systems & Data Warehousing', dept: 'Computer Science', level: '400L', units: 3, lecId: 'lec-002' },
  ];

  for (const c of courses) {
    db.run(
      `INSERT OR REPLACE INTO courses (id, code, title, department, level, credit_units, lecturer_id, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [c.id, c.code, c.title, c.dept, c.level, c.units, c.lecId, now, now]
    );
  }
  console.log(`Seed: Inserted ${courses.length} courses.`);

  // 4. Students (16 fictional students)
  const students = [
    { id: 'stu-001', matric: 'CSC/2021/001', name: 'Ayomide Balogun', dept: 'Computer Science', level: '400L' },
    { id: 'stu-002', matric: 'CSC/2021/002', name: 'Chinedu Okonkwo', dept: 'Computer Science', level: '400L' },
    { id: 'stu-003', matric: 'CSC/2021/003', name: 'Fatima Abubakar', dept: 'Computer Science', level: '400L' },
    { id: 'stu-004', matric: 'CSC/2021/004', name: 'Emeka Nwosu', dept: 'Computer Science', level: '400L' },
    { id: 'stu-005', matric: 'CSC/2021/005', name: 'Zainab Danjuma', dept: 'Computer Science', level: '400L' },
    { id: 'stu-006', matric: 'CSC/2021/006', name: 'Babatunde Fashola', dept: 'Computer Science', level: '400L' },
    { id: 'stu-007', matric: 'CSC/2021/007', name: 'Ngozi Eze', dept: 'Computer Science', level: '400L' },
    { id: 'stu-008', matric: 'CSC/2021/008', name: 'Tariq Al-Mansoor', dept: 'Computer Science', level: '400L' },
    { id: 'stu-009', matric: 'CSC/2021/009', name: 'Kehinde Adeleke', dept: 'Computer Science', level: '400L' },
    { id: 'stu-010', matric: 'CSC/2021/010', name: 'Blessing Udoh', dept: 'Computer Science', level: '400L' },
    { id: 'stu-011', matric: 'SWE/2021/011', name: 'David Adeyemi', dept: 'Software Engineering', level: '400L' },
    { id: 'stu-012', matric: 'SWE/2021/012', name: 'Grace Oladipo', dept: 'Software Engineering', level: '400L' },
    { id: 'stu-013', matric: 'SWE/2021/013', name: 'Ibrahim Musa', dept: 'Software Engineering', level: '400L' },
    { id: 'stu-014', matric: 'CSC/2021/014', name: 'Precious Johnson', dept: 'Computer Science', level: '400L' },
    { id: 'stu-015', matric: 'CSC/2021/015', name: 'Samuel Kalu', dept: 'Computer Science', level: '400L' },
    { id: 'stu-016', matric: 'CSC/2021/016', name: 'Halima Bello', dept: 'Computer Science', level: '400L' },
  ];

  for (const s of students) {
    const studentCred = createStudentQRCredential({
      studentId: s.id,
      matricNumber: s.matric,
      fullName: s.name,
      department: s.dept,
    });

    db.run(
      `INSERT OR REPLACE INTO students (id, matric_number, full_name, department, level, email, active, has_face_enrolled, qr_credential, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?)`,
      [s.id, s.matric, s.name, s.dept, s.level, `${s.matric.replace(/\//g, '.').toLowerCase()}@student.classguard.edu`, studentCred, now, now]
    );

    // Face biometric template
    const syntheticVector = generateSyntheticEmbedding(s.matric);
    db.run(
      `INSERT OR REPLACE INTO face_templates (id, student_id, matric_number, embedding, algorithm, version, sample_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'FaceRecognitionNet-128D', '1.0', 1, ?, ?)`,
      [`tpl-${s.id}`, s.id, s.matric, JSON.stringify(syntheticVector), now, now]
    );
  }
  console.log(`Seed: Inserted ${students.length} students with facial biometric embeddings.`);

  // 5. Enrollments: Enroll all CSC students into CSC 401, CSC 403, and CSC 405
  let enrollmentCount = 0;
  for (const s of students) {
    const coursesToEnroll = s.dept === 'Computer Science' ? ['crs-001', 'crs-002', 'crs-003', 'crs-005'] : ['crs-001', 'crs-004'];
    for (const cId of coursesToEnroll) {
      db.run(
        `INSERT OR REPLACE INTO enrollments (id, student_id, course_id, academic_session, semester, status, created_at, updated_at)
         VALUES (?, ?, ?, '2025/2026', 'First', 'ENROLLED', ?, ?)`,
        [`enr-${s.id}-${cId}`, s.id, cId, now, now]
      );
      enrollmentCount++;
    }
  }
  console.log(`Seed: Inserted ${enrollmentCount} course enrollments.`);

  // 6. Attendance Sessions
  const sessionKeyPair = generateSessionKeyPair();

  const sessions = [
    {
      id: 'ses-csc403-active',
      courseId: 'crs-002',
      lecturerId: 'lec-001',
      title: 'CSC 403: Face Recognition Architectures',
      date: new Date().toISOString().split('T')[0],
      opening: '09:00',
      closing: '12:00',
      lateThreshold: 15,
      status: 'ACTIVE',
      pubKey: sessionKeyPair.publicKey,
      privKey: sessionKeyPair.privateKey,
    },
    {
      id: 'ses-csc401-closed',
      courseId: 'crs-001',
      lecturerId: 'lec-001',
      title: 'CSC 401: Distributed Consensus & Raft',
      date: '2026-10-15',
      opening: '10:00',
      closing: '12:00',
      lateThreshold: 15,
      status: 'CLOSED',
      pubKey: sessionKeyPair.publicKey,
      privKey: sessionKeyPair.privateKey,
    },
  ];

  for (const s of sessions) {
    db.run(
      `INSERT OR REPLACE INTO attendance_sessions (id, course_id, lecturer_id, title, session_date, opening_time, closing_time, late_threshold_minutes, status, public_key, private_key, qr_rotate_seconds, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 30, ?, ?)`,
      [s.id, s.courseId, s.lecturerId, s.title, s.date, s.opening, s.closing, s.lateThreshold, s.status, s.pubKey, s.privKey, now, now]
    );
  }
  console.log(`Seed: Inserted ${sessions.length} sessions.`);

  // 7. Attendance Records for closed session (CSC 401)
  const attendedStudentIds = ['stu-001', 'stu-002', 'stu-003', 'stu-004', 'stu-005', 'stu-006', 'stu-007', 'stu-008', 'stu-011', 'stu-012'];
  for (let i = 0; i < attendedStudentIds.length; i++) {
    const stuId = attendedStudentIds[i];
    const stu = students.find((x) => x.id === stuId)!;
    const status = i < 8 ? 'PRESENT' : 'LATE';
    const checkInTime = new Date(`2026-10-15T${i < 8 ? '10:05:00' : '10:22:00'}Z`).toISOString();

    db.run(
      `INSERT OR REPLACE INTO attendance_records (id, student_id, matric_number, student_name, course_id, session_id, timestamp, status, verification_method, similarity_score, liveness_passed, kiosk_id, notes, sync_status, created_at)
       VALUES (?, ?, ?, ?, 'crs-001', 'ses-csc401-closed', ?, ?, 'QR_AND_FACE', 94.5, 1, 'KIOSK-MAIN-01', ?, 'SYNCED', ?)`,
      [
        `att-rec-${stu.id}-csc401`,
        stu.id,
        stu.matric,
        stu.name,
        checkInTime,
        status,
        status === 'LATE' ? 'Arrived after late threshold' : 'On-time verification',
        now,
      ]
    );
  }
  console.log(`Seed: Inserted ${attendedStudentIds.length} sample attendance records.`);

  // 8. Audit log entry
  db.run(
    `INSERT INTO audit_logs (id, user_id, username, action, entity_type, entity_id, details, timestamp)
     VALUES (?, ?, ?, 'SYSTEM_SEED', 'System', 'ALL', 'Database initialized with demonstrative seed data', ?)`,
    [crypto.randomUUID(), adminId, 'admin', now]
  );

  db.save();
  db.close();
  console.log('--- Seeding Completed Successfully! ---');
}

// Execute if run directly
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  runSeed().catch((err) => {
    console.error('Seed script failed:', err);
    process.exit(1);
  });
}
