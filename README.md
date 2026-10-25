# ClassGuard: Desktop Student Attendance Tracking & Monitoring System

**ClassGuard** is an offline-capable Electron + React + TypeScript desktop application for higher-education student attendance tracking. It uses local SQLite storage for continuous resilience, 1-to-1 facial verification as the primary attendance method, student QR credentials as the fallback, and lecturer manual override as the audited last resort.

---

## 1. System Architecture & Attendance Workflow

ClassGuard enforces a strict 3-tier attendance verification hierarchy:

```
[Student approaches kiosk / camera]
           │
           ▼
[Primary: 1-to-1 Facial Verification]
   ├── Match (Euclidean Distance <= 0.60) ──► Mark Attendance Immediately (FACE_VERIFIED)
   │                                          (No QR scan required)
   └── Mismatch / Face Not Enrolled / Lighting Failure
           │
           ▼
[Fallback: Student QR Credential]
   ├── Valid Cryptographic Student Card ───► Mark Fallback Attendance (QR_FALLBACK)
   └── Credential Lost / Scanner Hardware Unavailable
           │
           ▼
[Last Resort: Lecturer Manual Override]
   └── Authenticated Lecturer Search + Mandatory Reason ──► Mark Exception (MANUAL_OVERRIDE)
                                                            + Log Audit Trail Entry
```

### Complete Offline Operation
- **Local Neural Network Weights:** Facial recognition models are bundled directly in `apps/desktop/public/models` and copied to `dist/models`. The application operates 100% offline without requiring internet access or CDN connectivity.
- **Biometric Representations:** High-resolution camera streams are processed locally in memory. Only normalized 128-dimensional floating-point vectors are stored in SQLite. Raw face images are never retained.
- **Idempotency:** Strict SQLite `UNIQUE(student_id, session_id)` constraints prevent duplicate attendance marks across all three verification methods.

---

## 2. User Roles & Permissions

The application implements exactly three roles:

| Role | Default Seed Email | Password | Access Level & Scope |
|---|---|---|---|
| **SUPERADMIN** | `admin@classguard.edu` | `Admin@123` | **IT Personnel:** Manage lecturer accounts (activate/deactivate), inspect system-wide audit trails, view offline station infrastructure. Biometric template operations are strictly isolated and inaccessible. |
| **ADMIN (Lecturer)** | `turing@classguard.edu` | `Lecturer@123` | **Classroom Lecturer:** Manage student records and facial enrollment, manage assigned courses, create & control attendance sessions, launch bound attendance kiosk, monitor live attendance, perform audited manual overrides, and export reports. |
| **STUDENT** | `student@classguard.edu` | `Student@123` | **Student Portal:** View personal attendance statistics, check-in history, and course attendance percentages. Administrative and lecturer controls are strictly blocked. |

---

## 3. Matriculation Number Format Specification

All student identifiers must strictly adhere to the university standard:

$$\mathbf{\text{Format: }} \mathbf{\text{2xxx/2xxxxx}}$$

- **Regular Expression:** `^2\d{3}\/2\d{5}$`
- **Specification:** Exactly four digits beginning with `2`, followed by a forward slash `/`, followed by six digits beginning with `2`.
- **Valid Examples:**
  - `2022/241414`
  - `2023/247230`
  - `2024/246825`
- **Invalid Examples (strictly rejected in frontend and backend):**
  - `CSC/2021/001` (legacy alphanumeric format)
  - `2022/123456` (second segment does not begin with 2)
  - `1022/241414` (first segment does not begin with 2)
  - `2022-241414` (hyphen instead of forward slash)
  - `2022/24141` (insufficient digits)

---

## 4. Attendance Kiosk Workflow

The kiosk is protected from unauthenticated access and cannot be opened independently from the public login screen:

1. **Lecturer Signs In:** Lecturer logs in via the clean login form (`turing@classguard.edu` / `Lecturer@123`).
2. **Selects Course & Starts Session:** In the Dashboard or Sessions view, clicks **Start Attendance Session**.
3. **Session Initialized:** An active session is created in the local SQLite database.
4. **Launches Attendance Kiosk:** The lecturer clicks **Open Attendance Kiosk** within the active session card, opening the interface bound to that specific session (`/kiosk?session=<session_id>`).
5. **Student Step-Up:**
   - Student enters their matriculation number (e.g. `2022/241414`).
   - The webcam detects their face, extracts the live 128D embedding, and compares it against the enrolled template using Euclidean distance.
   - Upon a match (distance $\le 0.60$), attendance is recorded immediately as `FACE_VERIFIED`.
   - The kiosk displays a confirmation card and automatically resets after 5 seconds.
6. **Fallback Options:**
   - If face verification fails after retries, or if the student has no enrolled face template, the kiosk displays a clear **Use QR Fallback** button.
   - The student presents their student QR credential to the webcam.
7. **Session Closure:** When the lecturer closes the session from the dashboard or live monitor, the kiosk rejects any further attendance attempts and returns to a safe waiting state.

---

## 5. Technology Stack

- **Desktop Shell:** Electron 31 (Context Isolation enabled, Node Integration disabled)
- **Frontend:** React 18, TypeScript, Tailwind CSS v4, Lucide React, Recharts
- **Local Storage:** SQLite (via WebAssembly `sql.js` engine with binary file persistence)
- **Biometric Vision:** `@vladmandic/face-api` (local SSD MobileNet v1, 68-point landmarks, 128D Net)
- **Central API (Optional Sync):** Node.js, Express, MongoDB, Mongoose, Zod
- **Testing:** Vitest

---

## 6. Installation & Startup

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Build Shared Packages & Seed Database
Initialize the SQLite database with seed users and 16 student accounts:
```bash
npm run seed
```

### Step 3: Launch Application in Development Mode
Launches the Electron desktop application window:
```bash
npm run dev
```

To run both Electron desktop and the central Express backend concurrently:
```bash
npm run dev:all
```

### Step 4: Package Production Application
Builds the standalone Windows application bundle:
```bash
npm run package:win
```

---

## 7. Manual Testing Procedure: Webcam Face Enrollment & Verification

Follow these steps to test real biometric enrollment and verification end-to-end:

1. **Log In as Lecturer:**
   - Launch the application: `npm run dev`
   - On the login screen, enter `turing@classguard.edu` and `Lecturer@123`. Click **Sign In**.
2. **Register a New Student:**
   - Navigate to **Students & Enrollment**.
   - Click **Add Student**.
   - Enter a valid matriculation number: e.g. `2024/246825`.
   - Enter Full Name: `Test Real Student`.
   - Select Department (`Computer Science`) and Level (`400L`).
   - Click **Register Student**.
3. **Enroll Real Face via Webcam:**
   - In the student table, locate the new student (displaying amber **Not Enrolled**).
   - Click **Enroll Face**.
   - Grant webcam permissions if prompted. Look into the camera within the circular guide.
   - The live feed will detect your face. When framed properly with suitable lighting, click **Capture & Enroll Face**.
   - The model will extract the real 128D embedding and persist it to SQLite.
   - The modal closes and the badge updates to green **Enrolled**.
4. **Start Attendance Session & Verify Face:**
   - Navigate to **Dashboard**. Click **Start Attendance Session**.
   - Select `CSC 403` and click **Create & Activate Session**.
   - On the active session card, click **Open Attendance Kiosk**.
   - In the kiosk, enter `2024/246825` and click **Proceed to Face Check**.
   - Position your face in front of the camera. The real-time recognizer matches your live face against the enrolled vector.
   - Attendance is immediately marked as `PRESENT` with method `FACE_VERIFIED`! No QR scan needed.
5. **Verify Impostor Rejection:**
   - Have another person stand in front of the camera or obscure the face.
   - The verification fails with `Biometric distance exceeded threshold`.
   - After failed attempts, click **Use QR Fallback** to test fallback scanning.

---

## 8. Automated Test Suite

Run the comprehensive Vitest test suite covering all 25 security, role, session, biometric, and idempotency scenarios:

```bash
npm test
```

### Summary of Automated Test Scenarios:
1. **Roles & Access Control:**
   - Exactly 3 user roles: `STUDENT`, `ADMIN`, `SUPERADMIN`.
   - Database constraint rejects legacy or 4th roles.
   - Students blocked from administrative features.
   - Lecturers blocked from superadmin-only functions.
   - Superadmin access permitted to IT console.
2. **Authentication & Session Validation:**
   - Credentials checked against authoritative bcrypt hash.
   - Authoritative session tokens issued with 24-hour expiry.
   - Fabricated/tampered tokens rejected (preventing localStorage tampering).
   - Logout revokes session immediately.
   - Deactivated users rejected on session validation.
3. **Matriculation Validation:**
   - Accepts valid format `^2\d{3}\/2\d{5}$` (e.g. `2022/241414`, `2023/247230`, `2024/246825`).
   - Strictly rejects invalid formats (`CSC/2021/001`, `2022/123456`, `1022/241414`, `2022-241414`).
   - Whitespace trimming handled safely.
4. **Biometric Workflow & Offline Models:**
   - All 6 model weight manifests and `.bin` binaries bundled in `public/models`.
   - Synthetic simulation strictly rejected in production mode.
   - Real 128D embeddings persisted to SQLite during enrollment.
   - Live face match records attendance as `FACE_VERIFIED` without QR scan.
   - Impostor face rejected and offered QR fallback.
   - Unenrolled student offered QR fallback gracefully.
5. **Attendance Fallback & Overrides:**
   - Valid student QR credential accepted for `QR_FALLBACK`.
   - Tampered QR credentials rejected.
   - Manual override requires authenticated lecturer, non-empty reason, and audit log.
   - Students cannot execute manual override.
   - Uniqueness constraint prevents duplicate attendance across all 3 methods.
6. **Session & Architecture:**
   - Closed sessions reject attendance.
   - Electron desktop process launched by default.
   - Packaged build uses relative assets without dev server dependencies.

---

## 9. Security & Known Limitations

- **Liveness Detection:** Basic Eye Aspect Ratio (EAR) blink heuristics detect static printed photographs. However, software-only webcam inference cannot fully prevent high-definition digital screen replay. For high-security environments, infrared/depth-sensing hardware is recommended.
- **Biometric Protection:** Raw facial imagery is never saved to disk. SQLite templates store only the mathematical 128D descriptor. Direct file system access is blocked from the renderer process via Electron context isolation.
