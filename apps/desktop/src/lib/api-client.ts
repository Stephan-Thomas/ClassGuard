import { ClassGuardApi } from '../types/electron.d.js';
import { User } from '@classguard/shared';

// In-memory browser mockup fallback for standalone browser preview / testing
const mockStudents = [
  { id: 'stu-001', matricNumber: '2022/241414', fullName: 'Ayomide Balogun', department: 'Computer Science', level: '400L', email: '2022.241414@student.classguard.edu', active: true, hasFaceEnrolled: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'stu-002', matricNumber: '2022/241415', fullName: 'Chinedu Okonkwo', department: 'Computer Science', level: '400L', email: '2022.241415@student.classguard.edu', active: true, hasFaceEnrolled: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'stu-003', matricNumber: '2022/241416', fullName: 'Fatima Abubakar', department: 'Computer Science', level: '400L', email: '2022.241416@student.classguard.edu', active: true, hasFaceEnrolled: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'stu-004', matricNumber: '2022/241417', fullName: 'Emeka Nwosu', department: 'Computer Science', level: '400L', email: '2022.241417@student.classguard.edu', active: true, hasFaceEnrolled: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'stu-005', matricNumber: '2022/241418', fullName: 'Zainab Danjuma', department: 'Computer Science', level: '400L', email: '2022.241418@student.classguard.edu', active: true, hasFaceEnrolled: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

const mockCourses = [
  { id: 'crs-001', code: 'CSC 401', title: 'Distributed Systems & Cloud Computing', department: 'Computer Science', level: '400L', creditUnits: 3, lecturerName: 'Dr. Alan Turing', active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'crs-002', code: 'CSC 403', title: 'Computer Vision & Biometrics', department: 'Computer Science', level: '400L', creditUnits: 3, lecturerName: 'Dr. Alan Turing', active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'crs-003', code: 'CSC 405', title: 'Applied Cryptography & Security', department: 'Computer Science', level: '400L', creditUnits: 3, lecturerName: 'Dr. Ada Lovelace', active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'crs-004', code: 'SWE 407', title: 'Software Architecture & Design', department: 'Software Engineering', level: '400L', creditUnits: 3, lecturerName: 'Dr. Grace Hopper', active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'crs-005', code: 'CSC 409', title: 'Database Systems & Data Warehousing', department: 'Computer Science', level: '400L', creditUnits: 3, lecturerName: 'Dr. Ada Lovelace', active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

const mockSessions = [
  {
    id: 'ses-csc403-active',
    courseId: 'crs-002',
    courseCode: 'CSC 403',
    courseTitle: 'Computer Vision & Biometrics',
    lecturerId: 'lec-001',
    lecturerName: 'Dr. Alan Turing',
    title: 'CSC 403: Face Recognition Architectures',
    sessionDate: new Date().toISOString().split('T')[0],
    openingTime: '09:00',
    closingTime: '13:00',
    lateThresholdMinutes: 15,
    status: 'ACTIVE' as const,
    qrRotateSeconds: 30,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ses-csc401-closed',
    courseId: 'crs-001',
    courseCode: 'CSC 401',
    courseTitle: 'Distributed Systems & Cloud Computing',
    lecturerId: 'lec-001',
    lecturerName: 'Dr. Alan Turing',
    title: 'CSC 401: Distributed Consensus & Raft',
    sessionDate: '2026-10-15',
    openingTime: '10:00',
    closingTime: '12:00',
    lateThresholdMinutes: 15,
    status: 'CLOSED' as const,
    qrRotateSeconds: 30,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockRecords: any[] = [
  { id: 'rec-1', studentId: 'stu-001', matricNumber: '2022/241414', studentName: 'Ayomide Balogun', courseId: 'crs-001', sessionId: 'ses-csc401-closed', timestamp: '2026-10-15T10:05:00Z', status: 'PRESENT', verificationMethod: 'FACE_VERIFIED', similarityScore: 0.18, syncStatus: 'SYNCED', createdAt: '2026-10-15T10:05:00Z' },
  { id: 'rec-2', studentId: 'stu-002', matricNumber: '2022/241415', studentName: 'Chinedu Okonkwo', courseId: 'crs-001', sessionId: 'ses-csc401-closed', timestamp: '2026-10-15T10:22:00Z', status: 'LATE', verificationMethod: 'FACE_VERIFIED', similarityScore: 0.22, syncStatus: 'SYNCED', createdAt: '2026-10-15T10:22:00Z' },
];

let mockCurrentToken = '';
let mockCurrentUser: User | null = null;

const mockBrowserApi: ClassGuardApi = {
  login: async ({ email, password }) => {
    const trimmed = (email || '').trim().toLowerCase();
    if (trimmed === 'admin@classguard.edu' && password === 'Admin@123') {
      const user: User = { id: 'usr-admin-001', username: 'admin', email: 'admin@classguard.edu', role: 'SUPERADMIN', fullName: 'System IT Administrator', active: true, createdAt: '', updatedAt: '' };
      mockCurrentUser = user;
      mockCurrentToken = 'mock-superadmin-token';
      return { success: true, user, token: mockCurrentToken, expiresAt: Date.now() + 86400000 };
    }
    if (trimmed === 'turing@classguard.edu' && password === 'Lecturer@123') {
      const user: User = { id: 'usr-lecturer-001', username: 'turing', email: 'turing@classguard.edu', role: 'ADMIN', fullName: 'Dr. Alan Turing', active: true, createdAt: '', updatedAt: '' };
      mockCurrentUser = user;
      mockCurrentToken = 'mock-lecturer-token';
      return { success: true, user, token: mockCurrentToken, expiresAt: Date.now() + 86400000 };
    }
    if ((trimmed === 'student@classguard.edu' || trimmed === '2022/241414') && password === 'Student@123') {
      const user: User = { id: 'usr-student-001', username: '2022/241414', email: 'student@classguard.edu', role: 'STUDENT', fullName: 'Ayomide Balogun', active: true, createdAt: '', updatedAt: '' };
      mockCurrentUser = user;
      mockCurrentToken = 'mock-student-token';
      return { success: true, user, token: mockCurrentToken, expiresAt: Date.now() + 86400000 };
    }
    return { success: false, error: 'Invalid email, username, or password' };
  },
  validateSession: async (token: string) => {
    if (token === mockCurrentToken && mockCurrentUser) {
      return { success: true, user: mockCurrentUser };
    }
    if (token === 'mock-superadmin-token') {
      return { success: true, user: { id: 'usr-admin-001', username: 'admin', email: 'admin@classguard.edu', role: 'SUPERADMIN', fullName: 'System IT Administrator', active: true, createdAt: '', updatedAt: '' } };
    }
    if (token === 'mock-lecturer-token') {
      return { success: true, user: { id: 'usr-lecturer-001', username: 'turing', email: 'turing@classguard.edu', role: 'ADMIN', fullName: 'Dr. Alan Turing', active: true, createdAt: '', updatedAt: '' } };
    }
    if (token === 'mock-student-token') {
      return { success: true, user: { id: 'usr-student-001', username: '2022/241414', email: 'student@classguard.edu', role: 'STUDENT', fullName: 'Ayomide Balogun', active: true, createdAt: '', updatedAt: '' } };
    }
    return { success: false, error: 'Session token invalid or expired' };
  },
  logout: async () => {
    mockCurrentUser = null;
    mockCurrentToken = '';
    return { success: true };
  },
  getStudents: async (search) => {
    if (search) {
      return { success: true, data: mockStudents.filter(s => s.matricNumber.includes(search) || s.fullName.includes(search)) };
    }
    return { success: true, data: mockStudents };
  },
  getStudent: async (idOrMatric) => {
    const s = mockStudents.find(x => x.id === idOrMatric || x.matricNumber === idOrMatric);
    return s ? { success: true, data: s } : { success: false, error: 'Student not found' };
  },
  createStudent: async (data) => {
    const newStudent = { id: `stu-${Date.now()}`, ...data, hasFaceEnrolled: false, active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    mockStudents.push(newStudent);
    return { success: true, student: newStudent, data: newStudent };
  },
  updateStudent: async (id, data) => {
    const s = mockStudents.find(x => x.id === id);
    if (!s) return { success: false, error: 'Student not found' };
    Object.assign(s, data, { updatedAt: new Date().toISOString() });
    return { success: true, student: s };
  },
  deleteStudent: async (id) => {
    const idx = mockStudents.findIndex(x => x.id === id);
    if (idx >= 0) mockStudents.splice(idx, 1);
    return { success: true, message: 'Student deleted' };
  },
  enrollFace: async () => {
    return {
      success: false,
      message: 'Facial biometric enrollment requires the ClassGuard desktop application connected to local SQLite storage.',
    };
  },
  deleteFace: async (studentId) => {
    const s = mockStudents.find(x => x.id === studentId);
    if (s) s.hasFaceEnrolled = false;
    return { success: true };
  },
  generateQrCredential: async (studentId) => {
    const s = mockStudents.find(x => x.id === studentId);
    const cred = JSON.stringify({ type: 'STUDENT_CREDENTIAL', studentId, matricNumber: s?.matricNumber || '2022/241414' });
    if (s) (s as any).qrCredential = cred;
    return { success: true, qrCredential: cred, message: 'QR generated' };
  },
  getEnrollmentStatusList: async (search) => {
    let list = mockStudents;
    if (search) list = list.filter(s => s.matricNumber.includes(search) || s.fullName.includes(search));
    return {
      success: true,
      data: list.map(s => ({
        ...s,
        facialEnrollmentStatus: s.hasFaceEnrolled ? 'ENROLLED' : 'NOT_ENROLLED',
        hasQrCredential: true,
        qrCredentialStatus: 'ISSUED',
        accountStatus: s.active ? 'ACTIVE' : 'INACTIVE',
      })),
    };
  },
  getCourses: async () => ({ success: true, data: mockCourses }),
  createCourse: async (data) => {
    const newCourse = { id: `crs-${Date.now()}`, ...data, active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    mockCourses.push(newCourse);
    return { success: true, data: newCourse };
  },
  getLecturers: async () => ({
    success: true,
    data: [
      { id: 'lec-001', staffId: 'STF/CSC/01', fullName: 'Dr. Alan Turing', email: 'turing@classguard.edu', department: 'Computer Science', active: true, createdAt: '', updatedAt: '' },
      { id: 'lec-002', staffId: 'STF/CSC/02', fullName: 'Dr. Ada Lovelace', email: 'lovelace@classguard.edu', department: 'Computer Science', active: true, createdAt: '', updatedAt: '' },
    ],
  }),
  getCourseEnrollments: async () => ({
    success: true,
    data: mockStudents.map(s => ({
      id: `enr-${s.id}`,
      studentId: s.id,
      courseId: 'crs-002',
      academicSession: '2025/2026',
      semester: 'First',
      status: 'ENROLLED',
      studentMatric: s.matricNumber,
      studentName: s.fullName,
      createdAt: '',
      updatedAt: '',
    })),
  }),
  enrollStudent: async () => ({ success: true }),
  bulkEnrollStudents: async () => ({ success: true, count: 5 }),
  getSessions: async () => ({ success: true, data: mockSessions }),
  getSession: async (id) => {
    const session = mockSessions.find(s => s.id === id);
    return { success: true, data: { session, enrolledCount: mockStudents.length, presentCount: mockRecords.length, lateCount: 0, records: mockRecords } };
  },
  createSession: async (data) => {
    const newSession = { id: `ses-${Date.now()}`, ...data, status: 'ACTIVE', qrRotateSeconds: 30, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    mockSessions.unshift(newSession);
    return { success: true, data: newSession };
  },
  closeSession: async (id) => {
    const s = mockSessions.find(x => x.id === id);
    if (s) s.status = 'CLOSED';
    return { success: true };
  },
  generateSignedToken: async (sessionId, ttl = 30) => {
    const session = mockSessions.find(s => s.id === sessionId);
    if (!session) return { success: false, error: 'Session not found' };
    const now = Date.now();
    const tokenObject = {
      payload: {
        sessionId: session.id,
        courseId: session.courseId,
        courseCode: session.courseCode || 'CSC 403',
        tokenId: `tok-${now}`,
        issuedAt: now,
        expiresAt: now + ttl * 1000,
        nonce: Math.random().toString(36).substring(2, 10),
      },
      signature: 'MC4CAQACBQCeZ123MockBase64SignatureForBrowserPreviewOnly==',
      publicKey: '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAMockKey\n-----END PUBLIC KEY-----',
    };
    return { success: true, tokenString: JSON.stringify(tokenObject), tokenObject };
  },
  verifyFaceAndRecord: async () => {
    return {
      success: false,
      statusCode: 'ERROR',
      message: 'Facial verification is temporarily unavailable. Please try again or use an authorized alternative.',
    };
  },
  verifyQrFallbackAndRecord: async (payload) => {
    const student = mockStudents[0];
    const record = {
      id: `rec-${Date.now()}`,
      studentId: student.id,
      matricNumber: student.matricNumber,
      studentName: student.fullName,
      courseId: 'crs-002',
      sessionId: payload.sessionId || 'ses-csc403-active',
      timestamp: new Date().toISOString(),
      status: 'PRESENT' as const,
      verificationMethod: 'QR_FALLBACK' as const,
      syncStatus: 'PENDING' as const,
      createdAt: new Date().toISOString(),
    };
    mockRecords.unshift(record);
    return { success: true, statusCode: 'SUCCESS', message: 'Attendance marked successfully via QR Fallback: PRESENT!', studentName: student.fullName, matricNumber: student.matricNumber, attendanceStatus: 'PRESENT', verificationMethod: 'QR_FALLBACK', record };
  },
  lecturerOverrideAttendance: async (payload) => {
    const student = mockStudents.find(s => s.id === payload.studentId) || mockStudents[0];
    const record = {
      id: `rec-${Date.now()}`,
      studentId: student.id,
      matricNumber: student.matricNumber,
      studentName: student.fullName,
      courseId: 'crs-002',
      sessionId: payload.sessionId || 'ses-csc403-active',
      timestamp: new Date().toISOString(),
      status: 'PRESENT' as const,
      verificationMethod: 'MANUAL_OVERRIDE' as const,
      notes: payload.overrideReason,
      syncStatus: 'PENDING' as const,
      createdAt: new Date().toISOString(),
    };
    mockRecords.unshift(record);
    return { success: true, statusCode: 'SUCCESS', message: 'Attendance recorded via Lecturer Manual Override: PRESENT!', studentName: student.fullName, matricNumber: student.matricNumber, attendanceStatus: 'PRESENT', verificationMethod: 'MANUAL_OVERRIDE', record };
  },
  verifyAndRecordAttendance: async (payload) => {
    const student = mockStudents.find(s => s.matricNumber === payload.matricNumber);
    if (!student) {
      return { success: false, statusCode: 'STUDENT_NOT_FOUND', message: `Student ${payload.matricNumber} not found.` };
    }
    const already = mockRecords.find(r => r.studentId === student.id && r.sessionId === 'ses-csc403-active');
    if (already) {
      return { success: false, statusCode: 'ALREADY_MARKED', message: `Attendance already recorded for ${student.fullName}.`, studentName: student.fullName };
    }
    const record = {
      id: `rec-${Date.now()}`,
      studentId: student.id,
      matricNumber: student.matricNumber,
      studentName: student.fullName,
      courseId: 'crs-002',
      sessionId: 'ses-csc403-active',
      timestamp: new Date().toISOString(),
      status: 'PRESENT' as const,
      verificationMethod: 'FACE_VERIFIED' as const,
      similarityScore: 0.20,
      syncStatus: 'PENDING' as const,
      createdAt: new Date().toISOString(),
    };
    mockRecords.unshift(record);
    return { success: true, statusCode: 'SUCCESS', message: 'Attendance marked successfully: PRESENT!', studentName: student.fullName, attendanceStatus: 'PRESENT', similarityScore: 0.20, record };
  },
  getCourseReport: async () => ({
    success: true,
    data: {
      course: mockCourses[0],
      totalSessions: 3,
      closedSessions: 2,
      enrolledCount: mockStudents.length,
      averageRate: 85,
      studentBreakdown: mockStudents.map(s => ({
        studentId: s.id,
        matricNumber: s.matricNumber,
        studentName: s.fullName,
        presentCount: 2,
        lateCount: 0,
        absentCount: 0,
        attendedCount: 2,
        eligibleSessions: 2,
        attendancePercentage: 100,
      })),
    },
  }),
  exportCsv: async () => ({
    success: true,
    csv: 'Matriculation,Name,Present,Late,Absent,Percentage\n2022/241414,Ayomide Balogun,2,0,0,100%\n',
    filename: 'Course_Report.csv',
  }),
  getSyncStatus: async () => ({
    success: true,
    data: { pendingCount: mockRecords.filter(r => r.syncStatus === 'PENDING').length, syncedCount: mockRecords.filter(r => r.syncStatus === 'SYNCED').length, lastSyncedAt: new Date().toISOString() },
  }),
  syncNow: async () => {
    mockRecords.forEach(r => { (r as any).syncStatus = 'SYNCED'; });
    return { success: true, syncedCount: 2, pendingCount: 0 };
  },
  checkOnline: async () => ({ online: true }),
  pullProvisioning: async () => ({ success: true, message: 'Provisioned demo data successfully' }),
  getAuditLogs: async () => ({
    success: true,
    data: [
      { id: '1', action: 'SYSTEM_STARTUP', entityType: 'System', details: 'ClassGuard desktop app started', timestamp: new Date().toISOString() },
    ],
  }),
  getSuperadminOverview: async () => ({
    success: true,
    data: {
      lecturersCount: 3,
      coursesCount: 5,
      activeSessionsCount: 1,
      totalSessionsCount: 2,
      auditLogsCount: 12,
      pendingSyncCount: 0,
      syncedCount: 2,
      deviceStatus: 'HEALTHY_LOCAL_STATION',
    },
  }),
  createLecturer: async (data: any) => {
    return { success: true, lecturer: { id: `lec-${Date.now()}`, ...data, active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } };
  },
  toggleLecturerStatus: async () => ({ success: true }),
  getStudentAttendanceHistory: async (matric: string) => {
    return { success: true, data: mockRecords.filter(r => r.matricNumber === matric) };
  },
  getStudentAttendanceSummary: async (matric: string) => {
    const stu = mockStudents.find(s => s.matricNumber === matric) || mockStudents[0];
    return {
      success: true,
      data: {
        student: stu,
        courseSummaries: [
          { courseId: 'crs-001', courseCode: 'CSC 401', courseTitle: 'Distributed Systems', presentCount: 2, lateCount: 0, totalAttended: 2, eligibleSessions: 2, attendancePercentage: 100 },
          { courseId: 'crs-002', courseCode: 'CSC 403', courseTitle: 'Computer Vision', presentCount: 1, lateCount: 0, totalAttended: 1, eligibleSessions: 1, attendancePercentage: 100 },
        ],
        totalCourses: 2,
      },
    };
  },
  toggleFullscreen: async () => ({ isFullScreen: false }),
  isFullscreen: async () => ({ isFullScreen: false }),
};

if (typeof window !== 'undefined' && !window.classGuardApi) {
  console.warn(
    '[ClassGuard API] window.classGuardApi is unavailable. Running in browser preview fallback mode. Facial enrollment and biometric verification are disabled.'
  );
}

export const api: ClassGuardApi = typeof window !== 'undefined' && window.classGuardApi ? window.classGuardApi : mockBrowserApi;
