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
  login: (credentials: { email: string; password: string }) => Promise<{ success: boolean; user?: User; error?: string }>;
  getStudents: (search?: string) => Promise<{ success: boolean; data: Student[] }>;
  getStudent: (idOrMatric: string) => Promise<{ success: boolean; data?: Student; error?: string }>;
  createStudent: (data: any) => Promise<{ success: boolean; data?: Student; student?: Student; message?: string; error?: string }>;
  updateStudent: (id: string, data: any) => Promise<{ success: boolean; student?: Student; error?: string; message?: string }>;
  deleteStudent: (id: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  enrollFace: (studentId: string, embedding: number[]) => Promise<{ success: boolean; error?: string; message?: string }>;
  deleteFace: (studentId: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  generateQrCredential: (studentId: string) => Promise<{ success: boolean; qrCredential?: string; message?: string; error?: string }>;
  getEnrollmentStatusList: (search?: string) => Promise<{ success: boolean; data: any[] }>;
  getCourses: () => Promise<{ success: boolean; data: Course[] }>;
  createCourse: (data: any) => Promise<{ success: boolean; data?: Course; error?: string }>;
  getLecturers: () => Promise<{ success: boolean; data: Lecturer[] }>;
  getCourseEnrollments: (courseId: string) => Promise<{ success: boolean; data: Enrollment[] }>;
  enrollStudent: (studentId: string, courseId: string) => Promise<{ success: boolean; error?: string }>;
  bulkEnrollStudents: (courseId: string, studentIds: string[]) => Promise<{ success: boolean; count?: number; error?: string }>;
  getSessions: (courseId?: string) => Promise<{ success: boolean; data: AttendanceSession[] }>;
  getSession: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  createSession: (data: any) => Promise<{ success: boolean; data?: AttendanceSession; error?: string }>;
  closeSession: (id: string) => Promise<{ success: boolean; error?: string }>;
  generateSignedToken: (sessionId: string, ttlSeconds?: number) => Promise<{ success: boolean; tokenString?: string; tokenObject?: any; error?: string }>;
  lecturerOverrideAttendance: (payload: any) => Promise<any>;
  verifyFaceAndRecord: (payload: any) => Promise<any>;
  verifyQrFallbackAndRecord: (payload: any) => Promise<any>;
  verifyAndRecordAttendance: (payload: any) => Promise<any>;
  getCourseReport: (courseId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  exportCsv: (courseId: string) => Promise<{ success: boolean; csv?: string; filename?: string; error?: string }>;
  getSyncStatus: () => Promise<{ success: boolean; data: { pendingCount: number; syncedCount: number; lastSyncedAt?: string } }>;
  syncNow: () => Promise<{ success: boolean; syncedCount: number; pendingCount: number; error?: string }>;
  checkOnline: () => Promise<{ online: boolean; message?: string }>;
  pullProvisioning: () => Promise<{ success: boolean; message: string }>;
  getAuditLogs: (limit?: number) => Promise<{ success: boolean; data: AuditLog[] }>;
  toggleFullscreen: () => Promise<{ isFullScreen: boolean }>;
  isFullscreen: () => Promise<{ isFullScreen: boolean }>;
}

declare global {
  interface Window {
    classGuardApi?: ClassGuardApi;
  }
}
