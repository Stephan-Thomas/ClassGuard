import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api-client';
import { AttendanceRecord } from '@classguard/shared';
import {
  GraduationCap,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck2,
  User,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

export const StudentDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const matric = user?.username || '';

  const loadStudentData = async () => {
    if (!matric) return;
    setLoading(true);
    try {
      const [histRes, sumRes] = await Promise.all([
        api.getStudentAttendanceHistory(matric),
        api.getStudentAttendanceSummary(matric),
      ]);

      if (histRes.success && histRes.data) setHistory(histRes.data);
      if (sumRes.success && sumRes.data) setSummary(sumRes.data);
    } catch (err) {
      console.error('Failed to load student portal data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudentData();
  }, [matric]);

  const totalAttended = history.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
  const onTimeCount = history.filter((r) => r.status === 'PRESENT').length;
  const lateCount = history.filter((r) => r.status === 'LATE').length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Student Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-zinc-900 to-zinc-900/60 border border-zinc-800 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-lg">
            {user?.fullName?.charAt(0) || 'S'}
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-100">{user?.fullName || 'Student'}</h1>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400 font-mono">
              <span className="text-emerald-400 font-semibold">{matric}</span>
              <span>•</span>
              <span>Student Attendance Portal</span>
            </div>
          </div>
        </div>

        <button
          onClick={loadStudentData}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-800 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Records</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Total Verified</p>
            <p className="text-xl font-bold text-zinc-100 mt-0.5">{totalAttended} Sessions</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">On-Time / Late</p>
            <p className="text-xl font-bold text-zinc-100 mt-0.5">
              {onTimeCount} <span className="text-xs font-normal text-zinc-400">/ {lateCount} late</span>
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Enrolled Courses</p>
            <p className="text-xl font-bold text-zinc-100 mt-0.5">{summary?.totalCourses ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Course Attendance Breakdown */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-emerald-400" />
          <span>Course Attendance Compliance</span>
        </h2>

        <div className="overflow-x-auto border border-zinc-800/80 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Course Code</th>
                <th className="py-2.5 px-4 font-semibold">Course Title</th>
                <th className="py-2.5 px-4 font-semibold text-center">Attended</th>
                <th className="py-2.5 px-4 font-semibold text-center">Sessions Held</th>
                <th className="py-2.5 px-4 font-semibold text-right">Attendance Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {!summary?.courseSummaries || summary.courseSummaries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-zinc-500">
                    No active course enrollments found.
                  </td>
                </tr>
              ) : (
                summary.courseSummaries.map((crs: any) => (
                  <tr key={crs.courseId} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-emerald-400">{crs.courseCode}</td>
                    <td className="py-3 px-4 text-zinc-200">{crs.courseTitle}</td>
                    <td className="py-3 px-4 text-center text-zinc-300 font-mono">{crs.totalAttended}</td>
                    <td className="py-3 px-4 text-center text-zinc-400 font-mono">{crs.eligibleSessions}</td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`font-mono font-semibold px-2 py-0.5 rounded ${
                          crs.attendancePercentage >= 75
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {crs.attendancePercentage}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Attendance History Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-cyan-400" />
          <span>My Attendance History</span>
        </h2>

        <div className="overflow-x-auto border border-zinc-800/80 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Date & Time</th>
                <th className="py-2.5 px-4 font-semibold">Course</th>
                <th className="py-2.5 px-4 font-semibold">Session Title</th>
                <th className="py-2.5 px-4 font-semibold">Status</th>
                <th className="py-2.5 px-4 font-semibold text-right">Verification Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-zinc-500">
                    No attendance records logged for your matriculation number yet.
                  </td>
                </tr>
              ) : (
                history.map((rec) => (
                  <tr key={rec.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                      {new Date(rec.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-zinc-200">
                      {(rec as any).courseCode || rec.courseId}
                    </td>
                    <td className="py-3 px-4 text-zinc-300">{(rec as any).sessionTitle || rec.sessionId}</td>
                    <td className="py-3 px-4">
                      {rec.status === 'PRESENT' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          PRESENT
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          LATE
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-mono text-[10px] text-zinc-400">
                        {rec.verificationMethod === 'FACE_VERIFIED'
                          ? 'Facial Verification'
                          : rec.verificationMethod === 'QR_FALLBACK'
                          ? 'QR Fallback'
                          : 'Lecturer Override'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
