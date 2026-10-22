# ClassGuard: System Architecture & Design Document

**Final-Year Computer Science University Project**  
**Title:** Design and Implementation of a Desktop-Based Student Attendance Tracking and Monitoring System Using QR Code and Facial Verification  

---

## 1. Executive Summary

ClassGuard is an offline-first, tamper-resistant desktop application developed using Electron, React, TypeScript, and SQLite, paired with a centralized Node.js/Express and MongoDB synchronization backend. The application addresses lecture attendance impersonation (buddy signing) through a two-factor physical verification protocol:

1. **Dynamic Session Token (What you scan):** Asymmetrically signed with Ed25519 and rotated every 30 seconds by the lecturer.
2. **Local Facial Verification (Who you are):** High-dimensional 1-to-1 facial feature matching executed strictly on the kiosk workstation with zero external cloud dependencies.

---

## 2. Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│                   Lecturer Laptop                      │
│   • Displays Rotating Dynamic QR Code (30s)           │
│   • Signs payloads with private Ed25519 key            │
│   • Monitors live student entries                      │
└───────────────────────────▲────────────────────────────┘
                            │ (Visual Optical Channel)
┌───────────────────────────┴────────────────────────────┐
│              Designated Attendance Kiosk               │
│   • Fullscreen Student UI (No login required)          │
│   • Step 1: Matriculation Number Entry                 │
│   • Step 2: Webcam Scans Lecturer QR Code              │
│   • Step 3: Local 1-to-1 Facial Verification           │
│   • Local SQLite Database Storage (Offline-First)      │
│   • Background Idempotent Synchronization Queue        │
└───────────────────────────┬────────────────────────────┘
                            │ (When Network Connectivity Exists)
┌───────────────────────────▼────────────────────────────┐
│             Central Node.js / Express API              │
│   • MongoDB Persistent Central Store                   │
│   • Idempotent Batch Synchronization Endpoint          │
│   • Kiosk Offline Provisioning Packages                │
│   • Academic Audit & Compliance Reporting              │
└────────────────────────────────────────────────────────┘
```

---

## 3. Cryptographic Token Generation & Verification

To eliminate man-in-the-middle attacks, screen captures, and replay attacks, session QR tokens use public-key cryptography (Ed25519):

### 3.1 Token Payload Structure
```json
{
  "payload": {
    "sessionId": "ses-csc403-active",
    "courseId": "crs-002",
    "courseCode": "CSC 403",
    "tokenId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "issuedAt": 1774224000000,
    "expiresAt": 1774224030000,
    "nonce": "a1f89c02e5b741d3"
  },
  "signature": "MC4CAQACBQCe...base64...",
  "publicKey": "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA...\n-----END PUBLIC KEY-----"
}
```

### 3.2 Verification Flow on the Kiosk
1. **Canonical Serialization:** The payload keys are deterministically sorted.
2. **Signature Verification:** The public key validates the signature against the canonical payload.
3. **Clock Evaluation:** Kiosk clock verifies `currentTime <= expiresAt + tolerance`.
4. **Internal Consistency:** Matches `sessionId` and `courseId` against local schedule.

---

## 4. Local Biometric Facial Verification Pipeline

```
[Live Webcam Feed]
        │
        ▼
[Face Detection (TinyFaceDetector / SSD)]
        │
        ▼
[68-Point Facial Landmark Alignment]
        │
        ▼
[FaceRecognitionNet (ResNet-34 Feature Extractor)]
        │
        ▼
[128-Dimensional L2-Normalized Embedding Vector]
        │
        ▼
[1-to-1 Euclidean Distance vs Enrolled Template]
        │
        ├── Distance <= 0.50 ──> [VERIFIED MATCH]
        └── Distance >  0.50 ──> [REJECTED (FACE_MISMATCH)]
```

### 4.1 Biometric Privacy and Security
- **No Raw Image Retention:** Camera buffers are processed in memory and released immediately. No photographs are saved to disk or transmitted across networks.
- **Vector Anonymization:** Only 128-dimensional floating-point vectors are stored in SQLite and central database.
- **GDPR / Privacy Compliance:** Administrators can revoke and purge biometric templates on demand.

---

## 5. Offline-First Synchronization & Idempotency

### 5.1 SQLite Uniqueness Constraint
Attendance records in SQLite and MongoDB enforce a strict uniqueness constraint:
```sql
UNIQUE(student_id, session_id)
```
Even if a student attempts multiple scans or an upload packet is transmitted repeatedly, duplicate entries are physically prohibited at the database engine level.

### 5.2 Conflict Reconciliation Rules
1. If the kiosk already marked a student as `PRESENT`, central re-sync respects the initial timestamp and kiosk identifier.
2. If network fails mid-transfer, items remain `PENDING` in the local `sync_queue` and will re-attempt on next connection.
