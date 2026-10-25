import {
  Student,
  Course,
  Lecturer,
  Enrollment,
  AttendanceSession,
  AttendanceRecord,
  AuditLog,
  User,
} from '@classguard/shared';

export interface ClassGuardApi {
  // Auth & Session
  login: (credentials: { email: string; password: string }) => Promise<{ success: boolean; user?: User; token?: string; expiresAt?: number; error?: string }>;
  validateSession: (token: string) => Promise<{ success: boolean; user?: User; error?: string }>;
  logout: (token?: string) => Promise<{ success: boolean }>;

  // Students
  getStudents: (search?: string) => Promise<{ success: boolean; data: Student[] }>;
  getStudent: (idOrMatric: string) => Promise<{ success: boolean; data?: Student; error?: string }>;
  createStudent: (data: any) => Promise<{ success: boolean; data?: Student; student?: Student; message?: string; error?: string }>;
  updateStudent: (id: string, data: any) => Promise<{ success: boolean; student?: Student; error?: string; message?: string }>;
  deleteStudent: (id: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  enrollFace: (studentId: string, embedding: number[]) => Promise<{ success: boolean; error?: string; message?: string }>;
  deleteFace: (studentId: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  generateQrCredential: (studentId: string) => Promise<{ success: boolean; qrCredential?: string; message?: string; error?: string }>;
  getEnrollmentStatusList: (search?: string) => Promise<{ success: boolean; data: any[] }>;

  // Courses
  getCourses: () => Promise<{ success: boolean; data: Course[] }>;
  createCourse: (data: any) => Promise<{ success: boolean; data?: Course; error?: string }>;

  // Lecturers
  getLecturers: () => Promise<{ success: boolean; data: Lecturer[] }>;

  // Enrollments
  getCourseEnrollments: (courseId: string) => Promise<{ success: boolean; data: Enrollment[] }>;
  enrollStudent: (studentId: string, courseId: string) => Promise<{ success: boolean; error?: string }>;
  bulkEnrollStudents: (courseId: string, studentIds: string[]) => Promise<{ success: boolean; count?: number; error?: string }>;

  // Attendance Sessions
  getSessions: (courseId?: string) => Promise<{ success: boolean; data: AttendanceSession[] }>;
  getSession: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  createSession: (data: any) => Promise<{ success: boolean; data?: AttendanceSession; error?: string }>;
  closeSession: (id: string) => Promise<{ success: boolean; error?: string }>;
  generateSignedToken: (sessionId: string, ttlSeconds?: number) => Promise<{ success: boolean; tokenString?: string; tokenObject?: any; error?: string }>;
  lecturerOverrideAttendance: (payload: any) => Promise<any>;

  // Kiosk Attendance Processing
  verifyFaceAndRecord: (payload: any) => Promise<any>;
  verifyQrFallbackAndRecord: (payload: any) => Promise<any>;
  verifyAndRecordAttendance: (payload: any) => Promise<any>;

  // Reports
  getCourseReport: (courseId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  exportCsv: (courseId: string) => Promise<{ success: boolean; csv?: string; filename?: string; error?: string }>;

  // Sync
  getSyncStatus: () => Promise<{ success: boolean; data: { pendingCount: number; syncedCount: number; lastSyncedAt?: string } }>;
  syncNow: () => Promise<{ success: boolean; syncedCount: number; pendingCount: number; error?: string }>;
  checkOnline: () => Promise<{ online: boolean; message?: string }>;
  pullProvisioning: () => Promise<{ success: boolean; message: string }>;

  // Audit
  getAuditLogs: (limit?: number) => Promise<{ success: boolean; data: AuditLog[] }>;

  // Superadmin
  getSuperadminOverview: () => Promise<{ success: boolean; data?: any; error?: string }>;
  createLecturer: (data: any) => Promise<{ success: boolean; lecturer?: Lecturer; error?: string }>;
  toggleLecturerStatus: (lecturerId: string, active: boolean) => Promise<{ success: boolean; error?: string }>;

  // Student Portal
  getStudentAttendanceHistory: (matricNumber: string) => Promise<{ success: boolean; data?: AttendanceRecord[]; error?: string }>;
  getStudentAttendanceSummary: (matricNumber: string) => Promise<{ success: boolean; data?: any; error?: string }>;

  // System
  toggleFullscreen: () => Promise<{ isFullScreen: boolean }>;
  isFullscreen: () => Promise<{ isFullScreen: boolean }>;
}

declare global {
  interface Window {
    classGuardApi?: ClassGuardApi;
  }
}
