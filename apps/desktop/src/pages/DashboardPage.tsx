import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api-client';
import { Course, AttendanceSession, AttendanceRecord } from '@classguard/shared';
import {
  Users,
  GraduationCap,
  Calendar,
  CheckCircle2,
  Clock,
  Tv,
  ArrowRight,
  Plus,
  Activity,
  QrCode,
  FileBarChart,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [courses, setCourses] = useState<Course[]>([]);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [sessionDetail, setSessionDetail] = useState<any | null>(null);
  const [recentRecords, setRecentRecords] = useState<AttendanceRecord[]>([]);
  const [studentsCount, setStudentsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = async () => {
    try {
      const [crsRes, sesRes, stuRes] = await Promise.all([
        api.getCourses(),
        api.getSessions(),
        api.getStudents(),
      ]);

      if (crsRes.success) setCourses(crsRes.data);
      if (stuRes.success) setStudentsCount(stuRes.data.length);

      if (sesRes.success) {
        const active = sesRes.data.find((s) => s.status === 'ACTIVE') || null;
        setActiveSession(active);

        if (active) {
          const detailRes = await api.getSession(active.id);
          if (detailRes.success && detailRes.data) {
            setSessionDetail(detailRes.data);
            setRecentRecords(detailRes.data.records || []);
          }
        } else {
          // If no active session, load records from most recent session if available
          const closed = sesRes.data.find((s) => s.status === 'CLOSED');
          if (closed) {
            const detailRes = await api.getSession(closed.id);
            if (detailRes.success && detailRes.data) {
              setRecentRecords(detailRes.data.records?.slice(0, 10) || []);
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to load lecturer dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const timer = setInterval(loadDashboardData, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleCloseSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to close this attendance session? Check-in will be finalized.')) return;
    try {
      const res = await api.closeSession(sessionId);
      if (res.success) {
        loadDashboardData();
      }
    } catch (err: any) {
      alert(`Failed to close session: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome & Overview Header */}
      <div className="rounded-2xl p-6 border border-zinc-800 bg-zinc-900/40 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">
            Welcome, <span className="text-emerald-400">{user?.fullName || 'Lecturer'}</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Lecturer Attendance Console • Offline SQLite Resilient • Real-time Facial & QR Verification
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/sessions')}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Start Attendance Session</span>
          </button>
        </div>
      </div>

      {/* Active Session Action Banner (If session is LIVE) */}
      {activeSession ? (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
                  Attendance Session Active
                </span>
                <span className="text-zinc-500">•</span>
                <span className="text-xs text-zinc-400 font-mono">{activeSession.courseCode || 'Active Class'}</span>
              </div>
              <h2 className="text-base font-bold text-zinc-100">{activeSession.title}</h2>
              <p className="text-xs text-zinc-400">
                {sessionDetail ? (
                  <span>
                    <strong className="text-emerald-400">{sessionDetail.presentCount || 0}</strong> present,{' '}
                    <strong className="text-amber-400">{sessionDetail.lateCount || 0}</strong> late of{' '}
                    <strong className="text-zinc-200">{sessionDetail.enrolledCount || 0}</strong> enrolled students.
                  </span>
                ) : (
                  'Session ready for student entrance.'
                )}
              </p>
            </div>

            {/* In-Session Actions */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => navigate(`/kiosk?session=${activeSession.id}`)}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-500/25 transition-all cursor-pointer"
              >
                <Tv className="w-4 h-4" />
                <span>Open Attendance Kiosk</span>
              </button>

              <button
                onClick={() => navigate('/live-monitor')}
                className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-200 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>Live Monitor</span>
              </button>

              <button
                onClick={() => navigate('/lecturer-qr')}
                className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-200 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <QrCode className="w-4 h-4 text-cyan-400" />
                <span>Dynamic QR</span>
              </button>

              <button
                onClick={() => handleCloseSession(activeSession.id)}
                className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-medium text-rose-300 transition-colors cursor-pointer"
              >
                Close Session
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-800/80 flex items-center justify-center text-zinc-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-200">No Active Attendance Session</h3>
              <p className="text-xs text-zinc-400">
                Start a session for one of your courses to launch the verification kiosk.
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/sessions')}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs flex items-center gap-1.5 transition-all self-start sm:self-auto"
          >
            <span>Select Course & Start</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Registered Students</p>
            <p className="text-xl font-bold text-zinc-100 mt-0.5">{studentsCount}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Assigned Courses</p>
            <p className="text-xl font-bold text-zinc-100 mt-0.5">{courses.length}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Today's Attendance</p>
            <p className="text-xl font-bold text-zinc-100 mt-0.5">
              {sessionDetail ? (sessionDetail.presentCount || 0) + (sessionDetail.lateCount || 0) : recentRecords.length} Verified
            </p>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Assigned Courses & Recent Check-ins */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assigned Courses */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-emerald-400" />
              <span>Assigned Courses</span>
            </h2>
            <button
              onClick={() => navigate('/courses')}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              View All
            </button>
          </div>

          <div className="space-y-2.5">
            {courses.length === 0 ? (
              <p className="text-xs text-zinc-500 py-4 text-center">No assigned courses found.</p>
            ) : (
              courses.slice(0, 4).map((c) => (
                <div
                  key={c.id}
                  className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-between hover:border-zinc-700 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-emerald-400">{c.code}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
                        {c.level}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-zinc-200 mt-0.5">{c.title}</p>
                  </div>
                  <button
                    onClick={() => navigate('/sessions')}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                    title="Start session for this course"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Attendance Activity */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Recent Verification Activity</span>
            </h2>
            <button
              onClick={() => navigate('/reports')}
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Reports
            </button>
          </div>

          <div className="overflow-x-auto border border-zinc-800/80 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="py-2 px-3 font-semibold">Student</th>
                  <th className="py-2 px-3 font-semibold">Matric No.</th>
                  <th className="py-2 px-3 font-semibold">Status</th>
                  <th className="py-2 px-3 font-semibold text-right">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {recentRecords.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-zinc-500">
                      No attendance records logged yet today.
                    </td>
                  </tr>
                ) : (
                  recentRecords.slice(0, 5).map((r) => (
                    <tr key={r.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-zinc-100 truncate max-w-[120px]">
                        {r.studentName}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-zinc-400 text-[11px]">{r.matricNumber}</td>
                      <td className="py-2.5 px-3">
                        {r.status === 'PRESENT' ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            PRESENT
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            LATE
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[10px] text-zinc-400">
                        {r.verificationMethod === 'FACE_VERIFIED'
                          ? 'Face'
                          : r.verificationMethod === 'QR_FALLBACK'
                          ? 'QR'
                          : 'Override'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
