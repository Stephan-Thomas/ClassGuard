import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api-client';
import {
  Activity,
  CheckCircle2,
  Clock,
  Square,
  QrCode,
  Users,
  Search,
  AlertCircle,
  ShieldAlert,
  Camera,
  X,
  UserCheck,
  Check,
} from 'lucide-react';

export const LiveMonitorPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [sessionDetail, setSessionDetail] = useState<any | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Lecturer Manual Override Modal State
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [eligibleStudents, setEligibleStudents] = useState<any[]>([]);
  const [selectedStudentForOverride, setSelectedStudentForOverride] = useState<any | null>(null);
  const [overrideReasonCategory, setOverrideReasonCategory] = useState('Biometric capture hardware failure');
  const [customOverrideExplanation, setCustomOverrideExplanation] = useState('');
  const [isConfirmingOverride, setIsConfirmingOverride] = useState(false);
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  // Load sessions list
  useEffect(() => {
    api.getSessions().then((res) => {
      if (res.success && res.data.length > 0) {
        setSessions(res.data);
        const queryId = searchParams.get('session');
        if (queryId && res.data.some((s: any) => s.id === queryId)) {
          setSelectedSessionId(queryId);
        } else {
          const active = res.data.find((s: any) => s.status === 'ACTIVE') || res.data[0];
          setSelectedSessionId(active.id);
        }
      }
    });
  }, [searchParams]);

  // Poll session details & records
  const loadDetail = async () => {
    if (!selectedSessionId) return;
    try {
      const res = await api.getSession(selectedSessionId);
      if (res.success && res.data) {
        setSessionDetail(res.data);
      }
    } catch (err) {
      console.error('Failed to load session detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
    const interval = setInterval(loadDetail, 3000);
    return () => clearInterval(interval);
  }, [selectedSessionId]);

  // Load all students for the manual override search
  useEffect(() => {
    if (showOverrideModal) {
      api.getStudents(studentSearch).then((res) => {
        if (res.success) {
          setEligibleStudents(res.data);
        }
      });
    }
  }, [showOverrideModal, studentSearch]);

  const handleCloseSession = async () => {
    if (!selectedSessionId) return;
    if (confirm('Are you sure you want to close this session? Unscanned enrolled students will be marked ABSENT.')) {
      await api.closeSession(selectedSessionId);
      loadDetail();
    }
  };

  // Perform Manual Override Submission
  const handleExecuteManualOverride = async () => {
    if (!selectedStudentForOverride || !selectedSessionId) return;
    setOverrideSubmitting(true);
    setOverrideError(null);

    const fullReason = customOverrideExplanation.trim()
      ? `${overrideReasonCategory} - ${customOverrideExplanation.trim()}`
      : overrideReasonCategory;

    // Lecturer staff ID from session or logged in lecturer
    const lecturerId = sessionDetail?.session?.lecturerId || 'lec-001';

    try {
      const res = await api.lecturerOverrideAttendance({
        studentId: selectedStudentForOverride.id,
        sessionId: selectedSessionId,
        lecturerId,
        overrideReason: fullReason,
      });

      setOverrideSubmitting(false);

      if (res.success) {
        setShowOverrideModal(false);
        setIsConfirmingOverride(false);
        setSelectedStudentForOverride(null);
        setCustomOverrideExplanation('');
        loadDetail();
      } else {
        setOverrideError(res.message || res.error || 'Failed to record manual override.');
      }
    } catch (err: any) {
      setOverrideSubmitting(false);
      setOverrideError(err.message || 'Network or database error');
    }
  };

  const records = sessionDetail?.records || [];
  const filteredRecords = search
    ? records.filter(
        (r: any) =>
          r.matricNumber.toLowerCase().includes(search.toLowerCase()) ||
          r.studentName.toLowerCase().includes(search.toLowerCase())
      )
    : records;

  const enrolledCount = sessionDetail?.enrolledCount || 0;
  const presentCount = sessionDetail?.presentCount || 0;
  const lateCount = sessionDetail?.lateCount || 0;
  const totalVerified = presentCount + lateCount;
  const pendingCount = Math.max(0, enrolledCount - totalVerified);
  const isClosed = sessionDetail?.session?.status === 'CLOSED';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            <span>Live Attendance Monitoring</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time feed of facial verification, QR fallback, and authorized lecturer overrides
          </p>
        </div>

        <div className="flex items-center gap-2">
          {sessions.length > 1 && (
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.courseCode}: {s.title} ({s.status})
                </option>
              ))}
            </select>
          )}

          {!isClosed && (
            <>
              {/* LECTURER MANUAL OVERRIDE ACTION BUTTON */}
              <button
                onClick={() => {
                  setSelectedStudentForOverride(null);
                  setIsConfirmingOverride(false);
                  setOverrideError(null);
                  setShowOverrideModal(true);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-xs font-semibold text-amber-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Lecturer Manual Attendance Override (Last Resort)"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Manual Override</span>
              </button>

              <button
                onClick={() => navigate(`/lecturer-qr?session=${selectedSessionId}`)}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-emerald-400 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Show QR Screen</span>
              </button>

              <button
                onClick={handleCloseSession}
                className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-semibold text-rose-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Close Session</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel rounded-xl p-4 border border-zinc-800">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Total Enrolled</span>
          <div className="mt-2 text-2xl font-extrabold text-zinc-100 font-mono">{enrolledCount}</div>
        </div>

        <div className="glass-panel rounded-xl p-4 border border-zinc-800">
          <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Present (On-Time)</span>
          <div className="mt-2 text-2xl font-extrabold text-emerald-400 font-mono">{presentCount}</div>
        </div>

        <div className="glass-panel rounded-xl p-4 border border-zinc-800">
          <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Late Arrivals</span>
          <div className="mt-2 text-2xl font-extrabold text-amber-400 font-mono">{lateCount}</div>
        </div>

        <div className="glass-panel rounded-xl p-4 border border-zinc-800">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            {isClosed ? 'Marked Absent' : 'Pending Entry'}
          </span>
          <div className={`mt-2 text-2xl font-extrabold font-mono ${isClosed ? 'text-rose-400' : 'text-zinc-400'}`}>
            {pendingCount}
          </div>
        </div>
      </div>

      {/* Live Attendee Stream Table with Verification Method Badges */}
      <div className="glass-panel rounded-2xl border border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-900/40">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isClosed ? 'bg-zinc-600' : 'bg-emerald-400 animate-ping'}`} />
            <h2 className="text-sm font-bold text-zinc-100">
              Verified Student Stream ({filteredRecords.length})
            </h2>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name or matric..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900/60 text-zinc-400 uppercase font-mono tracking-wider text-[11px] border-b border-zinc-800">
              <tr>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Matriculation</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Verification Method</th>
                <th className="py-3 px-4">Biometric Match</th>
                <th className="py-3 px-4">Attendance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {filteredRecords.length > 0 ? (
                filteredRecords.map((r: any) => (
                  <tr key={r.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-4 font-semibold text-zinc-100">
                      <div>{r.studentName}</div>
                      {r.notes && (
                        <div className="text-[10px] text-zinc-400 font-normal italic mt-0.5">{r.notes}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-zinc-400">{r.matricNumber}</td>
                    <td className="py-3 px-4 font-mono text-zinc-400">
                      {new Date(r.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-4">
                      {/* Visibly Distinguishable Verification Method Badges */}
                      {r.verificationMethod === 'FACE_VERIFIED' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <Camera className="w-3 h-3" />
                          <span>Face Verified</span>
                        </span>
                      ) : r.verificationMethod === 'QR_FALLBACK' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                          <QrCode className="w-3 h-3" />
                          <span>QR Fallback</span>
                        </span>
                      ) : r.verificationMethod === 'MANUAL_OVERRIDE' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/40">
                          <ShieldAlert className="w-3 h-3" />
                          <span>Lecturer Override</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-zinc-800 text-zinc-300">
                          {r.verificationMethod}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold">
                      {r.verificationMethod === 'FACE_VERIFIED' ? (
                        <span className="text-emerald-400">{r.similarityScore}%</span>
                      ) : (
                        <span className="text-zinc-500">N/A</span>
                      )}
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
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    No verified scans recorded yet for this session.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* LECTURER MANUAL ATTENDANCE OVERRIDE MODAL (Section 1 Requirement) */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-2xl border border-zinc-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Authorized Lecturer Manual Attendance Override</span>
              </h2>
              <button
                onClick={() => {
                  setShowOverrideModal(false);
                  setIsConfirmingOverride(false);
                }}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              This action is reserved exclusively for the course lecturer to manually mark a student present when both facial verification and student QR fallback are unavailable.
            </p>

            {overrideError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                <span>{overrideError}</span>
              </div>
            )}

            {!isConfirmingOverride ? (
              <div className="space-y-4">
                {/* Search Student */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    1. Search Enrolled Student:
                  </label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder="Search by matriculation (e.g. CSC/2021/001) or student name..."
                      className="w-full pl-8 pr-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Candidate Selection List */}
                <div className="space-y-1.5 max-h-40 overflow-y-auto p-2 bg-zinc-950/70 rounded-xl border border-zinc-800">
                  {eligibleStudents.length > 0 ? (
                    eligibleStudents.map((s) => {
                      const isSelected = selectedStudentForOverride?.id === s.id;
                      const alreadyMarked = records.some((r: any) => r.studentId === s.id);
                      return (
                        <div
                          key={s.id}
                          onClick={() => {
                            if (!alreadyMarked) setSelectedStudentForOverride(s);
                          }}
                          className={`p-2.5 rounded-lg flex items-center justify-between text-xs transition-colors cursor-pointer ${
                            alreadyMarked
                              ? 'opacity-50 cursor-not-allowed bg-zinc-900/40'
                              : isSelected
                              ? 'bg-amber-500/20 border border-amber-500/50 text-amber-200'
                              : 'hover:bg-zinc-900 text-zinc-300'
                          }`}
                        >
                          <div>
                            <span className="font-semibold block">{s.fullName}</span>
                            <span className="font-mono text-[11px] text-zinc-500">{s.matricNumber}</span>
                          </div>
                          <div>
                            {alreadyMarked ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-400">
                                Already Marked
                              </span>
                            ) : isSelected ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-zinc-950">
                                Selected
                              </span>
                            ) : (
                              <span className="text-[11px] text-zinc-500">Select</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-4 text-center text-zinc-500 text-xs">
                      No matching students found.
                    </div>
                  )}
                </div>

                {/* Override Reason Selection */}
                {selectedStudentForOverride && (
                  <div className="space-y-3 pt-2 border-t border-zinc-800">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1">
                        2. Select Reason for Exception:
                      </label>
                      <select
                        value={overrideReasonCategory}
                        onChange={(e) => setOverrideReasonCategory(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none"
                      >
                        <option value="Biometric capture hardware failure">Biometric capture hardware failure</option>
                        <option value="Facial occlusion / medical bandage">Facial occlusion / medical patch or injury</option>
                        <option value="Severe ambient lighting interference">Severe ambient lighting interference</option>
                        <option value="Student QR credential lost or damaged">Student QR credential card damaged / lost</option>
                        <option value="Authorized official university permission">Authorized university official permission</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1">
                        3. Detailed Explanation / Audit Notes:
                      </label>
                      <input
                        type="text"
                        value={customOverrideExplanation}
                        onChange={(e) => setCustomOverrideExplanation(e.target.value)}
                        placeholder="Additional details for audit log..."
                        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                  <button
                    onClick={() => setShowOverrideModal(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-900 text-zinc-400 hover:bg-zinc-800 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!selectedStudentForOverride}
                    onClick={() => setIsConfirmingOverride(true)}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 font-bold text-xs"
                  >
                    Review & Confirm Override
                  </button>
                </div>
              </div>
            ) : (
              /* Confirmation Dialog */
              <div className="space-y-4 animate-fadeIn">
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
                  <span className="font-bold text-amber-300 uppercase tracking-wider block">
                    Confirm Manual Attendance Override:
                  </span>
                  <div className="space-y-1 font-mono text-zinc-300">
                    <div>Student: <strong className="text-zinc-100">{selectedStudentForOverride.fullName}</strong></div>
                    <div>Matriculation: <strong className="text-emerald-400">{selectedStudentForOverride.matricNumber}</strong></div>
                    <div>Course: <span className="text-zinc-200">{sessionDetail?.session?.courseCode}</span></div>
                    <div>Reason: <span className="text-amber-200">{overrideReasonCategory}</span></div>
                    {customOverrideExplanation && (
                      <div>Notes: <span className="text-zinc-400 italic">{customOverrideExplanation}</span></div>
                    )}
                    <div>Authorized By: <span className="text-zinc-300">{sessionDetail?.session?.lecturerName || 'Lecturer'}</span></div>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-500">
                  This override will be logged with a permanent cryptographic timestamp and lecturer audit entry.
                </p>

                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                  <button
                    disabled={overrideSubmitting}
                    onClick={() => setIsConfirmingOverride(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-900 text-zinc-400 hover:bg-zinc-800 text-xs font-semibold cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    disabled={overrideSubmitting}
                    onClick={handleExecuteManualOverride}
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/20"
                  >
                    <Check className="w-4 h-4" />
                    <span>{overrideSubmitting ? 'Recording...' : 'Confirm & Mark Present'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
