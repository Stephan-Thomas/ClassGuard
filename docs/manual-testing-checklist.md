# ClassGuard: Evaluation & Manual Testing Checklist

This checklist guides examiners, supervisors, and developers through validating the complete system workflows during project defense and practical evaluation.

---

## 1. System Initialization & Seeding

- [ ] Open a terminal in the project root:
  ```bash
  npm run seed
  ```
  **Expected Result:** Database initializes 16 fictional students, 3 lecturers, 5 courses, 58 enrollments, and 128D facial templates into `database/classguard.sqlite`.

---

## 2. Starting the Application

- [ ] Start the desktop application:
  ```bash
  npm run dev
  ```
  **Expected Result:** The Electron window starts up with the dark graphite aesthetic and displays the ClassGuard Sign In screen.

---

## 3. Administrative Console Validation

- [ ] **Login:** Click the "Admin Console" quick-login button (`admin@classguard.edu` / `Admin@123`).
  - **Result:** You arrive at the Dashboard displaying verified students (16), courses (5), and active session.
- [ ] **Student Roster:** Navigate to the **Students** tab.
  - **Result:** Filter or search by matriculation number (e.g. `CSC/2021/001`). View the green "Enrolled" biometric status badges.
- [ ] **Facial Biometric Enrollment:** Click "Enroll Face" on any student.
  - **Result:** The camera modal appears with an oval guide. Test live face capture or click "Use Test Biometric" to update the 128D embedding.
- [ ] **Courses & Enrollments:** Navigate to the **Courses** tab.
  - **Result:** Click `CSC 403: Computer Vision & Biometrics` to inspect enrolled students. Click "Enroll Student" to register another student.

---

## 4. Lecturer Session & Dynamic QR Workflow

- [ ] Navigate to the **Sessions** tab.
- [ ] Click **New Attendance Session**.
  - Select course `CSC 403`.
  - Enter topic: `Lecture 5: Neural Face Recognition`.
  - Set opening time and closing time.
  - Click **Start Session & Generate Keys**.
  - **Result:** Unique Ed25519 signing keypair is generated and the session status changes to `ACTIVE`.
- [ ] Navigate to **Lecturer QR Screen**.
  - **Result:** A dynamic high-contrast QR code is displayed with a 30-second countdown bar. Every 30 seconds, the token rotates with a fresh cryptographic signature.
  - Click **Copy Active Signed Token** (useful for single-PC testing).

---

## 5. Attendance Kiosk & Biometric Verification

- [ ] Click **Launch Student Kiosk** (or navigate to `/kiosk`).
  - **Result:** Dedicated student kiosk mode opens with no login required.
- [ ] **Step 1: Student Identification:**
  - Type or click a demo student pill (e.g. `CSC/2021/001: Ayomide Balogun`).
  - Click **Continue to QR Scan**.
- [ ] **Step 2: QR Token Validation:**
  - Hold the dynamic QR code in front of the webcam OR click **Simulate QR Scan** (single-PC demo).
  - **Result:** Kiosk verifies the Ed25519 cryptographic signature, validates session window, and proceeds to facial verification.
- [ ] **Step 3: Facial Verification:**
  - Center your face in the oval guide and click **Verify Live Face** (or click **Test Biometric Match**).
  - **Result:** Green glowing banner appears: `STATUS: PRESENT`, student name `Ayomide Balogun`, Biometric confidence score (e.g. `96%`).
  - **Auto-Reset:** Watch the 5-second countdown automatically purge camera buffers and reset the kiosk for the next student.

---

## 6. Security & Negative Test Cases

- [ ] **Duplicate Attendance Prevention:**
  - Re-enter `CSC/2021/001` on the kiosk for the same session.
  - **Result:** Kiosk displays red rejection: `ALREADY_MARKED - Attendance already recorded for Ayomide Balogun`. Duplicate is prevented by SQLite database constraint!
- [ ] **Unenrolled Student Rejection:**
  - Enter student `SWE/2021/013` for course `CSC 403` (if not enrolled).
  - **Result:** Kiosk rejects with: `Student is NOT enrolled in this course`.
- [ ] **Staff Authorization Override:**
  - When a verification fails, click **Staff Override**.
  - Select reason (e.g. `Camera lighting or physical occlusion exception`).
  - Click **Grant Override**.
  - **Result:** Attendance is authorized and logged with staff override notes in the audit trail.

---

## 7. Live Attendance Monitoring & Reports

- [ ] Return to **Live Monitor** in the console.
  - **Result:** Live attendee stream lists newly checked-in students with timestamps and verification methods.
- [ ] Click **Close Session**.
  - **Result:** Session closes. Enrolled students who did not check in are now officially flagged as **Absent**.
- [ ] Navigate to **Reports**.
  - Select `CSC 403`.
  - **Result:** Student compliance percentages are calculated using `(Attended / Closed Sessions) * 100`.
  - Click **Export CSV** to download `CSC 403_Attendance_Report.csv`.

---

## 8. Offline Resilience Test

- [ ] Disconnect your computer from Wi-Fi / Ethernet.
- [ ] Run attendance checks at the kiosk.
  - **Result:** Scans succeed offline; records are saved to SQLite with status `PENDING`.
- [ ] Reconnect to Wi-Fi.
- [ ] Navigate to **Sync Queue** and click **Sync Now**.
  - **Result:** Pending records are batch-transferred to central MongoDB without duplicates.
