-- ClassGuard SQLite Initial Schema
-- Enforces relational integrity, indexes, and duplicate attendance prevention

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('ADMIN', 'LECTURER')),
  full_name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  matric_number TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  department TEXT NOT NULL,
  level TEXT NOT NULL,
  email TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  has_face_enrolled INTEGER NOT NULL DEFAULT 0,
  qr_credential TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_students_matric ON students(matric_number);
CREATE INDEX IF NOT EXISTS idx_students_department ON students(department);

CREATE TABLE IF NOT EXISTS lecturers (
  id TEXT PRIMARY KEY,
  staff_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  department TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  department TEXT NOT NULL,
  level TEXT NOT NULL,
  credit_units INTEGER NOT NULL DEFAULT 3,
  lecturer_id TEXT REFERENCES lecturers(id),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(code);

CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  academic_session TEXT NOT NULL,
  semester TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ENROLLED',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(student_id, course_id, academic_session, semester)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  lecturer_id TEXT NOT NULL REFERENCES lecturers(id),
  title TEXT NOT NULL,
  session_date TEXT NOT NULL,
  opening_time TEXT NOT NULL,
  closing_time TEXT NOT NULL,
  late_threshold_minutes INTEGER NOT NULL DEFAULT 15,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('SCHEDULED', 'ACTIVE', 'CLOSED', 'CANCELLED')),
  public_key TEXT,
  private_key TEXT,
  qr_rotate_seconds INTEGER NOT NULL DEFAULT 30,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_course ON attendance_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON attendance_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON attendance_sessions(status);

CREATE TABLE IF NOT EXISTS face_templates (
  id TEXT PRIMARY KEY,
  student_id TEXT UNIQUE NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  matric_number TEXT NOT NULL,
  embedding TEXT NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'FaceRecognitionNet-128D',
  version TEXT NOT NULL DEFAULT '1.0',
  sample_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_face_templates_student ON face_templates(student_id);
CREATE INDEX IF NOT EXISTS idx_face_templates_matric ON face_templates(matric_number);

CREATE TABLE IF NOT EXISTS attendance_records (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id),
  matric_number TEXT NOT NULL,
  student_name TEXT NOT NULL,
  course_id TEXT NOT NULL REFERENCES courses(id),
  session_id TEXT NOT NULL REFERENCES attendance_sessions(id),
  timestamp TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PRESENT', 'LATE', 'EXCUSED')),
  verification_method TEXT NOT NULL CHECK(verification_method IN ('FACE_VERIFIED', 'QR_FALLBACK', 'MANUAL_OVERRIDE', 'TEST_SIMULATION', 'QR_AND_FACE')),
  similarity_score REAL,
  liveness_passed INTEGER DEFAULT 1,
  kiosk_id TEXT,
  notes TEXT,
  sync_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'FAILED')),
  synced_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(student_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_student_session ON attendance_records(student_id, session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_course ON attendance_records(course_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sync ON attendance_records(sync_status);

CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'SYNCED', 'FAILED')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TEXT NOT NULL,
  synced_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  username TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT NOT NULL,
  ip_address TEXT,
  timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
