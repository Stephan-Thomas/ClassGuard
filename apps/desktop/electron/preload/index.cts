import { contextBridge, ipcRenderer } from 'electron';

export const classGuardApi = {
  // Auth & Session
  login: (credentials: { email: string; password: string }) =>
    ipcRenderer.invoke('auth:login', credentials),
  validateSession: (token: string) =>
    ipcRenderer.invoke('auth:validateSession', token),
  logout: (token?: string) =>
    ipcRenderer.invoke('auth:logout', token),

  // Students
  getStudents: (search?: string) =>
    ipcRenderer.invoke('students:list', search),
  getStudent: (idOrMatric: string) =>
    ipcRenderer.invoke('students:get', idOrMatric),
  createStudent: (data: any) =>
    ipcRenderer.invoke('students:create', data),
  updateStudent: (id: string, data: any) =>
    ipcRenderer.invoke('students:update', { id, data }),
  deleteStudent: (id: string) =>
    ipcRenderer.invoke('students:delete', id),
  enrollFace: (studentId: string, embedding: number[]) =>
    ipcRenderer.invoke('students:enrollFace', { studentId, embedding }),
  deleteFace: (studentId: string) =>
    ipcRenderer.invoke('students:deleteFace', studentId),
  generateQrCredential: (studentId: string) =>
    ipcRenderer.invoke('students:generateQrCredential', studentId),
  getEnrollmentStatusList: (search?: string) =>
    ipcRenderer.invoke('students:getEnrollmentStatusList', search),

  // Courses
  getCourses: () =>
    ipcRenderer.invoke('courses:list'),
  createCourse: (data: any) =>
    ipcRenderer.invoke('courses:create', data),

  // Lecturers
  getLecturers: () =>
    ipcRenderer.invoke('lecturers:list'),

  // Enrollments
  getCourseEnrollments: (courseId: string) =>
    ipcRenderer.invoke('enrollments:byCourse', courseId),
  enrollStudent: (studentId: string, courseId: string) =>
    ipcRenderer.invoke('enrollments:enroll', { studentId, courseId }),
  bulkEnrollStudents: (courseId: string, studentIds: string[]) =>
    ipcRenderer.invoke('enrollments:bulk', { courseId, studentIds }),

  // Attendance Sessions
  getSessions: (courseId?: string) =>
    ipcRenderer.invoke('sessions:list', courseId),
  getSession: (id: string) =>
    ipcRenderer.invoke('sessions:get', id),
  createSession: (data: any) =>
    ipcRenderer.invoke('sessions:create', data),
  closeSession: (id: string) =>
    ipcRenderer.invoke('sessions:close', id),
  generateSignedToken: (sessionId: string, ttlSeconds?: number) =>
    ipcRenderer.invoke('sessions:generateToken', { sessionId, ttlSeconds }),
  lecturerOverrideAttendance: (payload: any) =>
    ipcRenderer.invoke('sessions:lecturerOverrideAttendance', payload),

  // Kiosk Attendance Processing
  verifyFaceAndRecord: (payload: any) =>
    ipcRenderer.invoke('kiosk:verifyFaceAndRecord', payload),
  verifyQrFallbackAndRecord: (payload: any) =>
    ipcRenderer.invoke('kiosk:verifyQrFallbackAndRecord', payload),
  verifyAndRecordAttendance: (payload: any) =>
    ipcRenderer.invoke('kiosk:verifyAndRecord', payload),

  // Reports
  getCourseReport: (courseId: string) =>
    ipcRenderer.invoke('reports:courseSummary', courseId),
  exportCsv: (courseId: string) =>
    ipcRenderer.invoke('reports:exportCsv', courseId),

  // Sync
  getSyncStatus: () =>
    ipcRenderer.invoke('sync:getStatus'),
  syncNow: () =>
    ipcRenderer.invoke('sync:syncNow'),
  checkOnline: () =>
    ipcRenderer.invoke('sync:checkOnline'),
  pullProvisioning: () =>
    ipcRenderer.invoke('sync:pullProvisioning'),

  // Audit
  getAuditLogs: (limit?: number) =>
    ipcRenderer.invoke('audit:list', limit),

  // Superadmin
  getSuperadminOverview: () =>
    ipcRenderer.invoke('superadmin:overview'),
  createLecturer: (data: any) =>
    ipcRenderer.invoke('superadmin:lecturers:create', data),
  toggleLecturerStatus: (lecturerId: string, active: boolean) =>
    ipcRenderer.invoke('superadmin:lecturers:toggle', { lecturerId, active }),

  // Student Portal
  getStudentAttendanceHistory: (matricNumber: string) =>
    ipcRenderer.invoke('student:attendanceHistory', matricNumber),
  getStudentAttendanceSummary: (matricNumber: string) =>
    ipcRenderer.invoke('student:summary', matricNumber),

  // System
  toggleFullscreen: () =>
    ipcRenderer.invoke('system:toggleFullscreen'),
  isFullscreen: () =>
    ipcRenderer.invoke('system:isFullscreen'),
};

contextBridge.exposeInMainWorld('classGuardApi', classGuardApi);
