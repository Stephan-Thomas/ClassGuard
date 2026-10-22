# ClassGuard: Desktop-Based Student Attendance Tracking & Monitoring System Using QR Code and Facial Verification

**Final-Year University Computer Science Capstone Project**  
*Academic Year: 2025/2026*

---

## 1. Project Description

**ClassGuard** is a robust, offline-first desktop attendance tracking and monitoring system designed to eliminate academic attendance impersonation ("buddy signing" and proxy scanning). The system enforces a two-factor physical verification protocol at classroom entrances:

1. **What the classroom presents:** A dynamic, session-specific QR code asymmetrically signed with Ed25519 and rotated every 30 seconds by the lecturer.
2. **Who the student is:** A locally executed 1-to-1 facial verification matching the student's live facial feature embedding against their enrolled biometric vector without communicating with any external cloud service.

Attendance is recorded directly into a local SQLite database, allowing continuous operation even when the campus network is down. When internet connectivity becomes available, unsynchronized attendance events are transferred idempotently to the central MongoDB database.

---

## 2. Key Features

- **True Desktop Application:** Built with Electron, React, TypeScript, and SQLite.
- **Two Operational Modes:**
  - **Administration & Lecturer Console:** User authentication, student management, facial enrollment, course allocations, session initiation, dynamic QR presentation, live attendee monitoring, audit trails, and reporting.
  - **Dedicated Student Kiosk:** Fullscreen, distraction-free student interface requiring no login, featuring rapid matriculation number lookup, camera QR scanning, 1-to-1 facial verification, and an automatic 5-second privacy reset.
- **Asymmetric QR Cryptography:** Tokens are signed using Ed25519 private keys. The offline kiosk validates tokens locally using public keys without API calls.
- **Local Neural Network Inference:** Face detection, 68-point facial landmark alignment, and 128-dimensional L2-normalized feature extraction run locally in-app.
- **Biometric Privacy by Design:** Raw camera photographs are processed in volatile memory and purged immediately; only anonymized 128D mathematical vectors are retained.
- **Offline-First & Idempotent:** Records persist in local SQLite with strict `UNIQUE(student_id, session_id)` constraints. Re-syncing re-transmits only pending records without duplicate record creation.
- **Comprehensive Reporting:** Automated compliance percentage calculations, present/late/absent lists upon session closure, and one-click CSV export.
- **Single-PC Demonstration Workflow:** Evaluators on a single laptop can test the full verification pipeline using the built-in demo simulator shortcuts without requiring two physical computers.

---

## 3. Technology Stack

| Layer | Technologies |
|---|---|
| **Desktop Shell** | Electron 31, Node.js v24, TypeScript |
| **Frontend Framework** | React 18, React Router v6, Vite |
| **Styling** | Tailwind CSS v4, Lucide React, Recharts |
| **Local Database** | SQLite via `sql.js` (WebAssembly engine with file persistence) |
| **Central Backend** | Express.js, TypeScript, Mongoose, Zod |
| **Central Database** | MongoDB |
| **Cryptography** | Ed25519 (Node.js `crypto` & Web Crypto API) |
| **Computer Vision** | `@vladmandic/face-api`, `jsQR` (Real-time optical decoding) |
| **Testing** | Vitest (16 comprehensive academic scenarios) |
| **Packaging** | Electron Builder (Windows NSIS / Portable) |

---

## 4. Default Demo Credentials

The database comes pre-seeded with fictional university accounts and 16 student records:

| Role | Email | Password | Access Level |
|---|---|---|---|
| **System Administrator** | `admin@classguard.edu` | `Admin@123` | Full administrative control, student enrollment, courses, audit logs |
| **Lecturer (Dr. Alan Turing)** | `turing@classguard.edu` | `Lecturer@123` | Assigned courses (CSC 401, CSC 403), start session, QR screen, live monitor |
| **Student (Kiosk Entrance)** | *(No login required)* | Enter matriculation number: `CSC/2021/001` through `CSC/2021/016` | Fullscreen attendance kiosk |

---

## 5. Prerequisites

- **Node.js:** v18.0.0 or later (v24.13.0 verified)
- **npm:** v9.0.0 or later
- **Operating System:** Windows 10/11 (macOS and Linux also supported)
- **Webcam:** Any built-in or USB camera (optional: single-PC simulation provided)

---

## 6. Installation & Quick Start

### Step 1: Install Dependencies
From the repository root:
```bash
npm install
```

### Step 2: Seed Demonstrative University Data
Initialize the SQLite database with 16 students, 5 courses, 3 lecturers, 58 enrollments, and biometric embeddings:
```bash
npm run seed
```

### Step 3: Run the Complete Application

To run the **Electron Desktop Application**:
```bash
npm run dev
```

To run the **Central Express API Server** (optional for central sync):
```bash
npm run dev:api
```

To run both concurrently:
```bash
npm run dev:all
```

---

## 7. Windows Packaging & Installer

To compile and package the Windows desktop installer (`.exe`):
```bash
npm run package:win
```
The installer will be generated in `apps/desktop/release/`.

---

## 8. Step-by-Step User Workflows

### 8.1 Enrolling a Student & Facial Biometrics
1. Sign in as Administrator (`admin@classguard.edu` / `Admin@123`).
2. Navigate to **Students**.
3. To register a new student, click **Register Student**, fill out matriculation number (e.g. `CSC/2021/017`), full name, and department.
4. Click **Enroll Face** next to the student's record.
5. In the camera modal, position the student's face within the oval guide and click **Capture & Enroll** (or click **Use Test Biometric** for camera-less demonstration).
6. The green **Enrolled** badge will update immediately.

### 8.2 Lecturer Starting an Attendance Session
1. Sign in as Lecturer (`turing@classguard.edu` / `Lecturer@123`).
2. Navigate to **Sessions** and click **New Attendance Session**.
3. Select course `CSC 403`, title `Lecture 5: Biometric Verification`, and specify the session time window and late arrival grace period (e.g. 15 minutes).
4. Click **Start Session & Generate Keys**. An Ed25519 cryptographic keypair is generated.
5. Navigate to **Lecturer QR Screen** to project the dynamic rotating QR code on the lecture hall display.

### 8.3 Student Verification at the Attendance Kiosk
1. From the desktop app, click **Launch Student Kiosk** (or navigate to `/kiosk`).
2. **Step 1:** Enter matriculation number (e.g. `CSC/2021/001`) or click one of the quick test pills.
3. **Step 2:** Point the camera at the lecturer's QR code (or click **Simulate QR Scan** if demonstrating on a single laptop).
4. **Step 3:** Face the camera; the system extracts the 128D embedding and performs 1-to-1 Euclidean distance verification against the enrolled template.
5. **Confirmation:** Green success banner confirms `PRESENT` or `LATE`. The interface resets automatically after 5 seconds.

### 8.4 Closing a Session & Inspecting Absent Students
1. In the console, navigate to **Live Monitor**.
2. Click **Close Session**.
3. All enrolled students who did not check in before closure are automatically marked as **Absent**.
4. Navigate to **Reports** and select the course to view overall percentages and click **Export CSV**.

---

## 9. Automated Test Suite

ClassGuard includes an automated Vitest test suite executing all 16 academic requirements:

```bash
npm test
```

### Verified Scenarios:
1. Student identification and lookup
2. Invalid credentials rejection
3. Asymmetric Ed25519 QR signature validation
4. Expired QR token rejection
5. Tampered QR signature detection
6. Closed session check-in prevention
7. Unenrolled student rejection
8. 1-to-1 facial verification match (distance <= 0.50)
9. Impostor face mismatch rejection (distance > 0.50)
10. Duplicate attendance prevention (SQLite uniqueness constraint)
11. Offline attendance recording to SQLite
12. Data persistence across database/application restarts
13. Central synchronization acknowledgment
14. Idempotent repeated synchronization
15. Role-based access control (Admin vs Lecturer)
16. Zod schema input validation

---

## 10. Technical Documentation

Detailed architectural and schema documentation is provided in the `docs/` folder:
- [System Architecture Document](file:///docs/system-design.md)
- [Database Schema & Data Dictionary](file:///docs/database-schema.md)
- [Central RESTful API Reference](file:///docs/api-documentation.md)
- [Evaluation & Defense Testing Checklist](file:///docs/manual-testing-checklist.md)

---

## 11. Security & Biometric Privacy Notes

- **Biometric Vectors Only:** ClassGuard never saves raw facial photos. Once 128D embeddings are computed, camera frames are purged from memory.
- **Anti-Replay Mechanism:** Each QR token contains a unique 8-byte cryptographic nonce, timestamp, and 30-second expiration.
- **Physical Clock Drift:** Offline kiosks allow a configurable 5-second clock tolerance window.
- **Staff Override Exception:** In the event of temporary facial bandages or extreme lighting failure, authorized staff can execute an audited override exception.

---

## 12. Known Limitations & Future Work

- **Liveness Limitations:** Eye aspect ratio (EAR) blink heuristics detect basic photo cutouts but do not prevent high-resolution video replay or silicon 3D masks. Future work includes depth-sensing camera integration (e.g. Intel RealSense).
- **Physical Clocks:** In disconnected kiosks, system clock changes could theoretically affect token expiry. Production kiosks should lock OS system clock configuration.
- **Multi-Factor Fingerprint Expansion:** The biometric provider is modularized so a USB fingerprint reader SDK can be plugged into the same pipeline in the future.

---

## 13. Project Structure

```text
ClassGuard/
├── apps/
│   ├── desktop/                  # Electron + React + SQLite Desktop Client
│   │   ├── electron/             # Main process, IPC handlers, SQLite services
│   │   ├── src/                  # React UI (Console, Kiosk, Charts, Webcam)
│   │   └── package.json
│   └── api/                      # Central Node.js / Express API
│       ├── src/                  # Controllers, Mongoose models, sync routes
│       └── package.json
├── packages/
│   └── shared/                   # Shared types, Zod schemas, Ed25519 crypto, biometrics
├── database/
│   ├── migrations/               # SQLite migration SQL files
│   ├── seed/                     # University seed dataset
│   └── classguard.sqlite         # Local embedded database
├── docs/                         # System design, schema, API, test checklist
├── tests/                        # 16-scenario Vitest test suite
├── .env.example
├── README.md
└── package.json
```

---

## 14. Academic Defense & Project Attribution

- **Project:** Design and Implementation of a Desktop-Based Student Attendance Tracking and Monitoring System Using QR Code and Facial Verification
- **Institution:** Department of Computer Science
- **Status:** Complete, Functional, Fully Tested
