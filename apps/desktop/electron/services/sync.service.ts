import { DesktopDatabaseService } from './sqlite.service.js';

export class DesktopSyncService {
  private static instance: DesktopSyncService;
  private db: DesktopDatabaseService;
  private apiBaseUrl: string;
  private authToken: string | null = null;
  private isSyncing = false;

  private constructor() {
    this.db = DesktopDatabaseService.getInstance();
    this.apiBaseUrl = process.env.CENTRAL_API_URL || 'http://localhost:4000/api';
  }

  public static getInstance(): DesktopSyncService {
    if (!DesktopSyncService.instance) {
      DesktopSyncService.instance = new DesktopSyncService();
    }
    return DesktopSyncService.instance;
  }

  public setAuthToken(token: string | null) {
    this.authToken = token;
  }

  /**
   * Check if central API server is reachable.
   */
  public async checkConnectivity(): Promise<{ online: boolean; message?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${this.apiBaseUrl}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        return { online: true };
      }
      return { online: false, message: `Server responded with HTTP ${res.status}` };
    } catch (err: any) {
      return { online: false, message: err.message || 'Server unreachable' };
    }
  }

  /**
   * Upload all pending local attendance records to central database idempotently.
   */
  public async syncPendingRecords(): Promise<{
    success: boolean;
    syncedCount: number;
    pendingCount: number;
    error?: string;
  }> {
    if (this.isSyncing) {
      return { success: false, syncedCount: 0, pendingCount: 0, error: 'Sync already in progress' };
    }

    this.isSyncing = true;
    try {
      const pendingRecords = this.db.getPendingSyncRecords();
      if (pendingRecords.length === 0) {
        return { success: true, syncedCount: 0, pendingCount: 0 };
      }

      const connectivity = await this.checkConnectivity();
      if (!connectivity.online) {
        return {
          success: false,
          syncedCount: 0,
          pendingCount: pendingRecords.length,
          error: `Central API unreachable: ${connectivity.message}. Records remain securely queued offline.`,
        };
      }

      const payload = {
        records: pendingRecords.map((r) => ({
          id: r.id,
          studentId: r.studentId,
          courseId: r.courseId,
          sessionId: r.sessionId,
          matricNumber: r.matricNumber,
          studentName: r.studentName,
          timestamp: r.timestamp,
          status: r.status,
          verificationMethod: r.verificationMethod,
          similarityScore: r.similarityScore,
          livenessPassed: r.livenessPassed,
          notes: r.notes,
          createdAt: r.createdAt,
        })),
        sourceKioskId: 'DESKTOP-KIOSK-MAIN',
      };

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const response = await fetch(`${this.apiBaseUrl}/sync/push`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        return {
          success: false,
          syncedCount: 0,
          pendingCount: pendingRecords.length,
          error: result.error || 'Sync request rejected by server',
        };
      }

      const acknowledgedIds: string[] = result.acknowledgedIds || [];
      if (acknowledgedIds.length > 0) {
        this.db.markRecordsSynced(acknowledgedIds);
      }

      const status = this.db.getSyncStatus();

      return {
        success: true,
        syncedCount: acknowledgedIds.length,
        pendingCount: status.pendingCount,
      };
    } catch (err: any) {
      return {
        success: false,
        syncedCount: 0,
        pendingCount: this.db.getPendingSyncRecords().length,
        error: `Sync error: ${err.message}`,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Pull and unpack offline provisioning bundle from server or file.
   */
  public async pullProvisioningBundle(): Promise<{ success: boolean; message: string }> {
    try {
      const headers: Record<string, string> = {};
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const response = await fetch(`${this.apiBaseUrl}/sync/provisioning`, { headers });
      const result = await response.json();
      if (!response.ok || !result.success) {
        return { success: false, message: result.error || 'Failed to download provisioning data' };
      }

      const { students, courses, enrollments, faceTemplates, activeSessions } = result.data;

      // Populate local database
      for (const s of students) {
        this.db.createStudent({
          matricNumber: s.matricNumber,
          fullName: s.fullName,
          department: s.department,
          level: s.level,
        });
      }

      for (const f of faceTemplates) {
        const student = this.db.getStudentByMatric(f.matricNumber);
        if (student) {
          this.db.enrollFaceTemplate(student.id, f.embedding);
        }
      }

      for (const c of courses) {
        this.db.createCourse({
          code: c.code,
          title: c.title,
          department: c.department,
          level: c.level,
          creditUnits: c.creditUnits,
        });
      }

      for (const e of enrollments) {
        this.db.enrollStudent(e.studentId, e.courseId, e.academicSession, e.semester);
      }

      for (const s of activeSessions) {
        this.db.createSession({
          courseId: s.courseId,
          lecturerId: s.lecturerId,
          title: s.title,
          sessionDate: s.sessionDate,
          openingTime: s.openingTime,
          closingTime: s.closingTime,
          lateThresholdMinutes: s.lateThresholdMinutes,
          publicKey: s.publicKey,
        });
      }

      return {
        success: true,
        message: `Successfully provisioned ${students.length} students, ${faceTemplates.length} biometric templates, and ${courses.length} courses.`,
      };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }
}
