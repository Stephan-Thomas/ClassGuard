import { DesktopDatabaseService } from './sqlite.service.js';

export interface ManualOverrideParams {
  studentId: string;
  sessionId: string;
  lecturerId: string;
  overrideReason: string;
}

export interface ProviderManualOverrideResult {
  authorized: boolean;
  statusCode: 'AUTHORIZED' | 'UNAUTHORIZED_LECTURER' | 'MISSING_REASON' | 'ERROR';
  message: string;
  lecturerName?: string;
  staffId?: string;
}

export class ManualAttendanceOverrideService {
  private static instance: ManualAttendanceOverrideService;
  private db: DesktopDatabaseService;

  private constructor() {
    this.db = DesktopDatabaseService.getInstance();
  }

  public static getInstance(): ManualAttendanceOverrideService {
    if (!ManualAttendanceOverrideService.instance) {
      ManualAttendanceOverrideService.instance = new ManualAttendanceOverrideService();
    }
    return ManualAttendanceOverrideService.instance;
  }

  /**
   * Validate lecturer authorization and override parameters before recording manual attendance.
   */
  public async authorizeOverride(params: ManualOverrideParams): Promise<ProviderManualOverrideResult> {
    try {
      // 1. Check reason is non-empty
      if (!params.overrideReason || !params.overrideReason.trim()) {
        return {
          authorized: false,
          statusCode: 'MISSING_REASON',
          message: 'An explicit override reason or explanation must be provided for manual attendance.',
        };
      }

      // 2. Validate lecturer exists and is authorized
      const lecturers = this.db.getLecturers();
      const lecturer = lecturers.find(
        (l) => l.id === params.lecturerId || l.userId === params.lecturerId || l.staffId === params.lecturerId
      );

      // Also check if admin user is performing the override
      if (!lecturer) {
        // Check if lecturerId belongs to an authorized admin or staff user
        const staffUsers = this.db.getUsers ? this.db.getUsers() : [];
        const staffUser = staffUsers.find((u: any) => u.id === params.lecturerId && (u.role === 'ADMIN' || u.role === 'SUPERADMIN'));
        if (!staffUser) {
          return {
            authorized: false,
            statusCode: 'UNAUTHORIZED_LECTURER',
            message: 'Manual attendance override requires authorized lecturer or academic administrator credentials.',
          };
        }
        return {
          authorized: true,
          statusCode: 'AUTHORIZED',
          message: `Manual override authorized by Administrator ${staffUser.fullName}.`,
          lecturerName: staffUser.fullName,
          staffId: staffUser.username,
        };
      }

      if (!lecturer.active) {
        return {
          authorized: false,
          statusCode: 'UNAUTHORIZED_LECTURER',
          message: `Lecturer account for ${lecturer.fullName} is currently inactive.`,
        };
      }

      return {
        authorized: true,
        statusCode: 'AUTHORIZED',
        message: `Manual override authorized by ${lecturer.fullName} (${lecturer.staffId}).`,
        lecturerName: lecturer.fullName,
        staffId: lecturer.staffId,
      };
    } catch (err: any) {
      return {
        authorized: false,
        statusCode: 'ERROR',
        message: `Manual override authorization error: ${err.message || 'unknown error'}`,
      };
    }
  }
}
