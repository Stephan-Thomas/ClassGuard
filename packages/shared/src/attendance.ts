import { AttendanceStatus, AttendanceSession } from './types.js';

/**
 * Determine whether an attendance check-in timestamp classifies as PRESENT or LATE.
 */
export function evaluateAttendanceStatus(
  checkInDate: Date,
  session: {
    sessionDate: string;
    openingTime: string; // e.g. "09:00" or ISO
    closingTime: string; // e.g. "11:00" or ISO
    lateThresholdMinutes: number;
  }
): AttendanceStatus {
  // Extract or parse session open time
  let sessionOpenTime: Date;
  if (session.openingTime.includes('T')) {
    sessionOpenTime = new Date(session.openingTime);
  } else {
    sessionOpenTime = new Date(`${session.sessionDate}T${session.openingTime}:00`);
  }

  const lateCutoffTime = new Date(sessionOpenTime.getTime() + session.lateThresholdMinutes * 60 * 1000);

  if (checkInDate <= lateCutoffTime) {
    return 'PRESENT';
  } else {
    return 'LATE';
  }
}

/**
 * Calculate attendance percentage with a clearly documented formula:
 * (attendedSessions / totalClosedEligibleSessions) * 100
 */
export function calculateAttendancePercentage(attendedCount: number, totalEligibleSessions: number): number {
  if (totalEligibleSessions <= 0) return 100; // If no sessions held yet, student is not penalized
  const pct = (attendedCount / totalEligibleSessions) * 100;
  return Math.min(100, Math.max(0, Math.round(pct * 10) / 10));
}
