import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api-client';
import {
  Users,
  GraduationCap,
  Calendar,
  CheckCircle2,
  Clock,
  QrCode,
  Tv,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [studentsCount, setStudentsCount] = useState(0);
  const [coursesCount, setCoursesCount] = useState(0);
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [recentRecords, setRecentRecords] = useState<any[]>([]);
  const [presentCount, setPresentCount] = useState(0);
  const [lateCount, setLateCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [stuRes, crsRes, sesRes] = await Promise.all([
          api.getStudents(),
          api.getCourses(),
          api.getSessions(),
        ]);

        if (stuRes.success) setStudentsCount(stuRes.data.length);
        if (crsRes.success) setCoursesCount(crsRes.data.length);
        if (sesRes.success) {
          setSessions(sesRes.data);
          const active = sesRes.data.find((s: any) => s.status === 'ACTIVE');
          if (active) {
            setActiveSession(active);
            const detail = await api.getSession(active.id);
            if (detail.success && detail.data) {
              setRecentRecords(detail.data.records || []);
              setPresentCount(detail.data.presentCount || 0);
              setLateCount(detail.data.lateCount || 0);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
    const interval = setInterval(loadDashboard, 10000);
    return () => clearInterval(interval);
  }, []);

  const chartData = [
    { name: 'Present (On-Time)', count: presentCount, fill: '#10b981' },
    { name: 'Late Arrival', count: lateCount, fill: '#f59e0b' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="glass-panel rounded-2xl p-6 border border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">
            Welcome back, <span className="text-emerald-400">{user?.fullName || 'Academic Officer'}</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            ClassGuard Attendance Monitoring Hub • Local SQLite Active • Asymmetric QR Verification
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/lecturer-qr')}
            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 flex items-center gap-2 transition-colors cursor-pointer"
          >
            <QrCode className="w-4 h-4 text-emerald-400" />
            <span>Display QR Screen</span>
          </button>

          <button
            onClick={() => navigate('/kiosk')}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <Tv className="w-4 h-4" />
            <span>Launch Kiosk</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div className="glass-panel rounded-xl p-5 border border-zinc-800/90 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Enrolled Students</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-zinc-100 font-mono">{studentsCount}</span>
            <p className="text-[11px] text-zinc-500 mt-1">Verified local records</p>
          </div>
        </div>

        {/* Active Courses */}
        <div className="glass-panel rounded-xl p-5 border border-zinc-800/90 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Courses Managed</span>
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-zinc-100 font-mono">{coursesCount}</span>
            <p className="text-[11px] text-zinc-500 mt-1">Department of Computer Science</p>
          </div>
        </div>

        {/* Active Sessions */}
        <div className="glass-panel rounded-xl p-5 border border-zinc-800/90 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Active Session</span>
            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-emerald-400 font-mono">
              {activeSession ? 'LIVE' : 'IDLE'}
            </span>
            <p className="text-[11px] text-zinc-500 mt-1 truncate">
              {activeSession ? activeSession.title : 'No active session'}
            </p>
          </div>
        </div>

        {/* Present Today */}
        <div className="glass-panel rounded-xl p-5 border border-zinc-800/90 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Checked-In Students</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-zinc-100 font-mono">
              {presentCount + lateCount}
            </span>
            <p className="text-[11px] text-zinc-500 mt-1">
              {presentCount} on-time, {lateCount} late
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Active Session + Attendance Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Session Status Card */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-zinc-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <h2 className="text-base font-bold text-zinc-100">Current Attendance Session</h2>
              </div>
              {activeSession && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  {activeSession.courseCode || 'CSC 403'}
                </span>
              )}
            </div>

            {activeSession ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <h3 className="text-sm font-semibold text-zinc-200">{activeSession.title}</h3>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                    <div>
                      <span className="text-zinc-500 block">Date</span>
                      <span className="text-zinc-300 font-mono">{activeSession.sessionDate}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Session Window</span>
                      <span className="text-zinc-300 font-mono">
                        {activeSession.openingTime} - {activeSession.closingTime}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Late Cutoff</span>
                      <span className="text-amber-400 font-mono">
                        +{activeSession.lateThresholdMinutes || 15} mins
                      </span>
                    </div>
                  </div>
                </div>

                {/* Live Progress Bar */}
                <div>
                  <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
                    <span>Attendance Rate</span>
                    <span className="font-mono text-emerald-400">
                      {presentCount + lateCount} verified scans
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-zinc-900 overflow-hidden flex">
                    <div
                      style={{ width: `${Math.min(100, presentCount * 10)}%` }}
                      className="bg-emerald-500 transition-all duration-500"
                    />
                    <div
                      style={{ width: `${Math.min(100, lateCount * 10)}%` }}
                      className="bg-amber-500 transition-all duration-500"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center">
                <p className="text-sm text-zinc-400">No attendance session is currently open.</p>
                <button
                  onClick={() => navigate('/sessions')}
                  className="mt-3 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-emerald-400 transition-colors"
                >
                  Create New Session
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center justify-between">
            <span className="text-xs text-zinc-500">Live monitoring stream active</span>
            <button
              onClick={() => navigate('/live-monitor')}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition-colors"
            >
              <span>View Full Attendee Stream</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Visual Chart Card */}
        <div className="glass-panel rounded-2xl p-6 border border-zinc-800 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Status Ratio</span>
            </h2>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" stroke="#71717a" fontSize={11} width={100} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                    itemStyle={{ color: '#f4f4f5', fontSize: '12px' }}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-xs text-zinc-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Present: {presentCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>Late: {lateCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="glass-panel rounded-2xl border border-zinc-800 overflow-hidden">
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-100">Recent Attendance Events</h2>
          <span className="text-xs text-zinc-500">Live verified entries</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900/60 text-zinc-400 uppercase font-mono tracking-wider text-[11px] border-b border-zinc-800">
              <tr>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Matriculation</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Biometric Confidence</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {recentRecords.length > 0 ? (
                recentRecords.slice(0, 6).map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-zinc-200">{r.studentName}</td>
                    <td className="py-3 px-4 font-mono text-zinc-400">{r.matricNumber}</td>
                    <td className="py-3 px-4 font-mono text-zinc-400">
                      {new Date(r.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-300">
                        {r.verificationMethod}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-emerald-400">
                      {r.similarityScore ? `${r.similarityScore}%` : 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status === 'PRESENT'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500">
                    No attendance records captured for this session yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
