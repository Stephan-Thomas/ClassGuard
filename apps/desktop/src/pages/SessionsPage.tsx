import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api-client';
import { AttendanceSession, Course } from '@classguard/shared';
import {
  Calendar,
  Plus,
  Play,
  Square,
  QrCode,
  Activity,
  CheckCircle,
  Clock,
  X,
  Lock,
} from 'lucide-react';

export const SessionsPage: React.FC = () => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form states
  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [openingTime, setOpeningTime] = useState('09:00');
  const [closingTime, setClosingTime] = useState('12:00');
  const [lateThreshold, setLateThreshold] = useState(15);
  const [qrRotate, setQrRotate] = useState(30);

  const navigate = useNavigate();

  const loadSessions = async () => {
    const res = await api.getSessions();
    if (res.success) {
      setSessions(res.data);
    }
  };

  useEffect(() => {
    loadSessions();
    api.getCourses().then((res) => {
      if (res.success) {
        setCourses(res.data);
        if (res.data.length > 0) setCourseId(res.data[0].id);
      }
    });
  }, []);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !title) return;

    const res = await api.createSession({
      courseId,
      lecturerId: 'lec-001',
      title,
      sessionDate,
      openingTime,
      closingTime,
      lateThresholdMinutes: Number(lateThreshold),
      qrRotateSeconds: Number(qrRotate),
    });

    if (res.success) {
      setShowCreateModal(false);
      setTitle('');
      loadSessions();
      if (res.data) {
        navigate(`/lecturer-qr?session=${res.data.id}`);
      }
    } else {
      alert(res.error || 'Failed to create session');
    }
  };

  const handleCloseSession = async (sessionId: string) => {
    if (confirm('Are you sure you want to close this session? Unscanned enrolled students will be marked ABSENT.')) {
      await api.closeSession(sessionId);
      loadSessions();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-400" />
            <span>Attendance Sessions</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Create, open, monitor, and finalize lecture attendance sessions
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Attendance Session</span>
        </button>
      </div>

      {/* Sessions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {sessions.map((s) => {
          const isActive = s.status === 'ACTIVE';
          return (
            <div
              key={s.id}
              className={`glass-panel rounded-2xl p-5 border flex flex-col justify-between transition-all ${
                isActive ? 'border-emerald-500/40 shadow-lg shadow-emerald-500/10' : 'border-zinc-800'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono font-bold text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                    {s.courseCode || 'CSC 403'}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                        : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                    }`}
                  >
                    {s.status}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-zinc-100 leading-snug">{s.title}</h3>
                <p className="text-xs text-zinc-400 mt-1">{s.courseTitle}</p>

                <div className="mt-4 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1.5 text-xs text-zinc-400">
                  <div className="flex justify-between">
                    <span>Date:</span>
                    <span className="text-zinc-200 font-mono">{s.sessionDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Window:</span>
                    <span className="text-zinc-200 font-mono">
                      {s.openingTime} - {s.closingTime}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Late Arrival Grace:</span>
                    <span className="text-amber-400 font-mono">+{s.lateThresholdMinutes} mins</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-zinc-800">
                    <span>Verified Scans:</span>
                    <span className="text-emerald-400 font-bold font-mono">
                      {s.attendanceCount || 0} students
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-3 border-t border-zinc-800 flex items-center gap-2">
                {isActive ? (
                  <>
                    <button
                      onClick={() => navigate(`/lecturer-qr?session=${s.id}`)}
                      className="flex-1 py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Display QR</span>
                    </button>

                    <button
                      onClick={() => navigate(`/live-monitor?session=${s.id}`)}
                      title="Live Monitoring"
                      className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-emerald-400 transition-colors"
                    >
                      <Activity className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleCloseSession(s.id)}
                      title="Close Session (Enforces Absence)"
                      className="p-2 rounded-lg bg-zinc-900 hover:bg-rose-500/20 border border-zinc-700 text-zinc-400 hover:text-rose-400 transition-colors"
                    >
                      <Square className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => navigate(`/reports?session=${s.id}`)}
                    className="w-full py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>Inspect Session Report</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-zinc-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-4">
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>Start Attendance Session</span>
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Select Course</label>
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none"
                  required
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code}: {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Session Title / Topic</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Lecture 4: Biometric Embedding Algorithms"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Session Date</label>
                <input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Opening Time</label>
                  <input
                    type="time"
                    value={openingTime}
                    onChange={(e) => setOpeningTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Closing Time</label>
                  <input
                    type="time"
                    value={closingTime}
                    onChange={(e) => setClosingTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Late Grace (Mins)</label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={lateThreshold}
                    onChange={(e) => setLateThreshold(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-medium mb-1">QR Rotation (Secs)</label>
                  <input
                    type="number"
                    min={10}
                    max={120}
                    value={qrRotate}
                    onChange={(e) => setQrRotate(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-[11px] text-zinc-400">
                <span className="text-emerald-400 font-semibold block mb-0.5">Asymmetric Keypair Provisioning:</span>
                An Ed25519 signing keypair is generated uniquely for this session to cryptographically sign rotating QR tokens.
              </div>

              <div className="pt-3 border-t border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-900 text-zinc-400 hover:bg-zinc-800 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold shadow-lg shadow-emerald-500/20"
                >
                  Start Session & Generate Keys
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
