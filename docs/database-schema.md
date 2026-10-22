# ClassGuard: Database Schema & Data Dictionary

ClassGuard maintains database parity between the local embedded **SQLite** database on the workstation and the centralized **MongoDB** datastore.

---

## 1. Relational Entities (SQLite)

### 1.1 `users`
Administrative and academic accounts for console access.
- `id` (TEXT, PRIMARY KEY): Unique identifier (e.g. `usr-admin-001`).
- `username` (TEXT, UNIQUE, NOT NULL): Login handle.
- `email` (TEXT, UNIQUE, NOT NULL): Contact & authentication address.
- `password_hash` (TEXT, NOT NULL): Bcrypt 10-round salted hash.
- `role` (TEXT, NOT NULL): `'ADMIN' | 'LECTURER'`.
- `full_name` (TEXT, NOT NULL): Display name.
- `active` (INTEGER, NOT NULL DEFAULT 1): Account status flag.
- `created_at` / `updated_at` (TEXT, ISO-8601).

### 1.2 `students`
University student records.
- `id` (TEXT, PRIMARY KEY): Unique identifier.
- `matric_number` (TEXT, UNIQUE, NOT NULL): Student matriculation ID (e.g. `CSC/2021/001`).
- `full_name` (TEXT, NOT NULL): Official name.
- `department` (TEXT, NOT NULL): Academic department.
- `level` (TEXT, NOT NULL): Academic level (e.g. `400L`).
- `email` (TEXT): Institutional email.
- `active` (INTEGER, NOT NULL DEFAULT 1).
- `has_face_enrolled` (INTEGER, NOT NULL DEFAULT 0): Biometric registration indicator.

### 1.3 `courses`
Academic courses available for attendance tracking.
- `id` (TEXT, PRIMARY KEY).
- `code` (TEXT, UNIQUE, NOT NULL): Course code (e.g. `CSC 403`).
- `title` (TEXT, NOT NULL): Full course title.
- `department` (TEXT, NOT NULL).
- `level` (TEXT, NOT NULL).
- `credit_units` (INTEGER, NOT NULL DEFAULT 3).
- `lecturer_id` (TEXT, FOREIGN KEY -> `lecturers.id`).

### 1.4 `enrollments`
Student course registration mappings.
- `id` (TEXT, PRIMARY KEY).
- `student_id` (TEXT, FOREIGN KEY -> `students.id`).
- `course_id` (TEXT, FOREIGN KEY -> `courses.id`).
- `academic_session` (TEXT, NOT NULL): e.g. `2025/2026`.
- `semester` (TEXT, NOT NULL): `First` | `Second`.
- `status` (TEXT, NOT NULL DEFAULT 'ENROLLED').
- **Constraint:** `UNIQUE(student_id, course_id, academic_session, semester)`.

### 1.5 `attendance_sessions`
Lecturer-initiated attendance windows.
- `id` (TEXT, PRIMARY KEY).
- `course_id` (TEXT, FOREIGN KEY -> `courses.id`).
- `lecturer_id` (TEXT, FOREIGN KEY -> `lecturers.id`).
- `title` (TEXT, NOT NULL): Session lecture topic.
- `session_date` (TEXT, NOT NULL): YYYY-MM-DD.
- `opening_time` (TEXT, NOT NULL): Scheduled start (HH:mm).
- `closing_time` (TEXT, NOT NULL): Scheduled end (HH:mm).
- `late_threshold_minutes` (INTEGER, DEFAULT 15): Grace period for on-time arrival.
- `status` (TEXT, NOT NULL): `'SCHEDULED' | 'ACTIVE' | 'CLOSED' | 'CANCELLED'`.
- `public_key` (TEXT): Ed25519 public key.
- `private_key` (TEXT): Ed25519 private key (stored only on creating workstation).
- `qr_rotate_seconds` (INTEGER, DEFAULT 30).

### 1.6 `face_templates`
Biometric mathematical representations.
- `id` (TEXT, PRIMARY KEY).
- `student_id` (TEXT, UNIQUE, FOREIGN KEY -> `students.id`).
- `matric_number` (TEXT, NOT NULL).
- `embedding` (TEXT, NOT NULL): JSON serialized array of 128 float values.
- `algorithm` (TEXT, DEFAULT 'FaceRecognitionNet-128D').
- `version` (TEXT, DEFAULT '1.0').
- `sample_count` (INTEGER, DEFAULT 1).

### 1.7 `attendance_records`
Verified attendance records.
- `id` (TEXT, PRIMARY KEY): Client UUID.
- `student_id` (TEXT, FOREIGN KEY -> `students.id`).
- `matric_number` (TEXT, NOT NULL).
- `student_name` (TEXT, NOT NULL).
- `course_id` (TEXT, FOREIGN KEY -> `courses.id`).
- `session_id` (TEXT, FOREIGN KEY -> `attendance_sessions.id`).
- `timestamp` (TEXT, NOT NULL): ISO-8601.
- `status` (TEXT, NOT NULL): `'PRESENT' | 'LATE' | 'EXCUSED'`.
- `verification_method` (TEXT, NOT NULL): `'QR_AND_FACE' | 'MANUAL_OVERRIDE' | 'TEST_SIMULATION'`.
- `similarity_score` (REAL): Biometric match percentage.
- `liveness_passed` (INTEGER, DEFAULT 1).
- `kiosk_id` (TEXT): Station ID.
- `sync_status` (TEXT, DEFAULT 'PENDING'): `'PENDING' | 'SYNCED' | 'CONFLICT'`.
- **Constraint:** `UNIQUE(student_id, session_id)` (Strict duplicate prevention).

### 1.8 `sync_queue`
Offline queue manager.
- `id` (TEXT, PRIMARY KEY).
- `event_type` (TEXT, NOT NULL): `'ATTENDANCE_RECORDED'`.
- `entity_id` (TEXT, NOT NULL).
- `payload` (TEXT, NOT NULL): Serialized JSON.
- `status` (TEXT, DEFAULT 'PENDING'): `'PENDING' | 'SYNCED' | 'FAILED'`.
- `retry_count` (INTEGER, DEFAULT 0).
