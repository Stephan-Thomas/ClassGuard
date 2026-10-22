# ClassGuard: Central RESTful API Documentation

Base URL: `http://localhost:4000/api`

---

## 1. Authentication

### `POST /auth/login`
Authenticate admin or lecturer.
- **Request Body:**
  ```json
  {
    "email": "admin@classguard.edu",
    "password": "Admin@123"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "6716f1a8e99e2...",
      "username": "admin",
      "email": "admin@classguard.edu",
      "role": "ADMIN",
      "fullName": "System Administrator"
    }
  }
  ```

### `GET /auth/me`
Returns details of the currently authenticated user token.
- **Headers:** `Authorization: Bearer <TOKEN>`

---

## 2. Students & Biometrics

### `GET /students`
List students with optional search query, department, level, and pagination.
- **Query Params:** `query`, `department`, `level`, `page`, `limit`

### `POST /students` (Admin only)
Register a new student.
- **Request Body:**
  ```json
  {
    "matricNumber": "CSC/2021/020",
    "fullName": "Bolanle Adebayo",
    "department": "Computer Science",
    "level": "400L",
    "email": "bolanle@student.classguard.edu"
  }
  ```

### `POST /students/:id/enroll-face` (Admin only)
Store 128-dimensional facial representation vector.
- **Request Body:**
  ```json
  {
    "embedding": [0.041, -0.012, ..., 0.089],
    "algorithm": "FaceRecognitionNet-128D"
  }
  ```

### `DELETE /students/:id/face` (Admin only)
Permanently remove student facial biometric template (GDPR compliance).

---

## 3. Courses & Enrollments

### `GET /courses`
List all courses with assigned lecturer and student counts.

### `POST /courses` (Admin only)
Create a new course.

### `GET /enrollments/course/:courseId`
List all enrolled students for a course.

### `POST /enrollments/bulk` (Admin only)
Bulk enroll array of student IDs into a course.

---

## 4. Attendance Sessions

### `GET /sessions`
List sessions with course metadata and total attendance counts.

### `POST /sessions`
Create a new attendance session with custom duration and late threshold.

### `POST /sessions/:id/close`
Close an attendance session. Prevents new check-ins and computes final absent roster.

---

## 5. Offline Synchronization

### `POST /sync/push`
Idempotent batch upload of offline attendance records collected at the kiosk.
- **Request Body:**
  ```json
  {
    "sourceKioskId": "KIOSK-MAIN-01",
    "records": [
      {
        "id": "a984f881-37d4-4f01-9c17-094943fcf3a1",
        "studentId": "6716f1a8e99e2b10",
        "courseId": "6716f1a8e99e2b20",
        "sessionId": "6716f1a8e99e2b30",
        "matricNumber": "CSC/2021/001",
        "studentName": "Ayomide Balogun",
        "timestamp": "2026-10-22T09:12:00.000Z",
        "status": "PRESENT",
        "verificationMethod": "QR_AND_FACE",
        "similarityScore": 95.5,
        "livenessPassed": true,
        "createdAt": "2026-10-22T09:12:00.000Z"
      }
    ]
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "syncedCount": 1,
    "duplicateIgnoredCount": 0,
    "acknowledgedIds": ["a984f881-37d4-4f01-9c17-094943fcf3a1"]
  }
  ```

### `GET /sync/provisioning`
Downloads offline package containing active students, courses, enrollments, face templates, and active sessions for offline kiosk operation.

---

## 6. Reports

### `GET /reports/dashboard-stats`
Aggregated high-level statistics: student counts, active sessions, today's scans.

### `GET /reports/course/:courseId`
Full compliance breakdown with percentages and present/late/absent tallies.
