import React, { useState, useEffect } from 'react';
import { api } from '../lib/api-client';
import { Lecturer, AuditLog } from '@classguard/shared';
import {
  ShieldCheck,
  Users,
  GraduationCap,
  Calendar,
  Activity,
  Plus,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Lock,
  Mail,
  UserCheck,
  Server,
} from 'lucide-react';

export const SuperadminDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add Lecturer Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [staffId, setStaffId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('Computer Science');
  const [password, setPassword] = useState('Lecturer@123');
  const [modalError, setModalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [overviewRes, lecturersRes, logsRes] = await Promise.all([
        api.getSuperadminOverview(),
        api.getLecturers(),
        api.getAuditLogs(15),
      ]);

      if (overviewRes.success) setStats(overviewRes.data);
      if (lecturersRes.success) setLecturers(lecturersRes.data);
      if (logsRes.success) setAuditLogs(logsRes.data);
    } catch (err) {
      console.error('Failed to load superadmin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleLecturer = async (lecturerId: string, currentActive: boolean) => {
    const action = currentActive ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} this lecturer account?`)) return;

    try {
      const res = await api.toggleLecturerStatus(lecturerId, !currentActive);
      if (res.success) {
        setLecturers((prev) =>
          prev.map((l) => (l.id === lecturerId ? { ...l, active: !currentActive } : l))
        );
      }
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const handleCreateLecturer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId.trim() || !fullName.trim() || !email.trim()) {
      setModalError('Please complete all required fields.');
      return;
    }

    setSubmitting(true);
    setModalError(null);

    try {
      const res = await api.createLecturer({
        staffId: staffId.trim().toUpperCase(),
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        department: department.trim(),
        password,
      });

      if (res.success && res.lecturer) {
        setShowAddModal(false);
        setStaffId('');
        setFullName('');
        setEmail('');
        loadData();
      } else {
        setModalError(res.error || 'Failed to create lecturer account.');
      }
    } catch (err: any) {
      setModalError(err.message || 'Error creating lecturer account.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredLecturers = lecturers.filter(
    (l) =>
      l.fullName.toLowerCase().includes(search.toLowerCase()) ||
      l.email.toLowerCase().includes(search.toLowerCase()) ||
      l.staffId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span>IT Superadmin Console</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            System configuration, lecturer account provisioning, and security audit log monitor.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs shadow-md shadow-emerald-500/20 transition-all cursor-pointer self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Provision Lecturer Account</span>
        </button>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Lecturers</p>
            <p className="text-xl font-bold text-zinc-100 mt-0.5">{stats?.lecturersCount ?? lecturers.length}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Active Courses</p>
            <p className="text-xl font-bold text-zinc-100 mt-0.5">{stats?.coursesCount ?? '—'}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Active Sessions</p>
            <p className="text-xl font-bold text-zinc-100 mt-0.5">{stats?.activeSessionsCount ?? '0'}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Device Station</p>
            <p className="text-xs font-semibold text-emerald-400 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Operational (SQLite)</span>
            </p>
          </div>
        </div>
      </div>

      {/* Lecturer Management Section */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Lecturer Accounts & Authorizations</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Manage lecturers with permissions to start attendance sessions and manage student enrollment.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lecturers..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Lecturers Table */}
        <div className="overflow-x-auto border border-zinc-800/80 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Staff ID</th>
                <th className="py-2.5 px-4 font-semibold">Full Name</th>
                <th className="py-2.5 px-4 font-semibold">Email</th>
                <th className="py-2.5 px-4 font-semibold">Department</th>
                <th className="py-2.5 px-4 font-semibold">Status</th>
                <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredLecturers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-zinc-500">
                    No lecturers found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredLecturers.map((lec) => (
                  <tr key={lec.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-zinc-300">{lec.staffId}</td>
                    <td className="py-3 px-4 font-medium text-zinc-100">{lec.fullName}</td>
                    <td className="py-3 px-4 text-zinc-400 font-mono text-[11px]">{lec.email}</td>
                    <td className="py-3 px-4 text-zinc-400">{lec.department}</td>
                    <td className="py-3 px-4">
                      {lec.active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <XCircle className="w-3 h-3" />
                          <span>Deactivated</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleToggleLecturer(lec.id, lec.active)}
                        className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                          lec.active
                            ? 'text-rose-400 hover:bg-rose-500/10 border border-rose-500/30'
                            : 'text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/30'
                        }`}
                      >
                        {lec.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security Audit Trail Monitor */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Security & Operational Audit Trail</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Immutable local logs of security-critical actions, authentication events, and overrides.
            </p>
          </div>
          <button
            onClick={loadData}
            title="Refresh logs"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto border border-zinc-800/80 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                <th className="py-2.5 px-4 font-semibold">User</th>
                <th className="py-2.5 px-4 font-semibold">Action</th>
                <th className="py-2.5 px-4 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-zinc-500">
                    No recent audit log events.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-zinc-200">{log.username || 'System'}</td>
                    <td className="py-2.5 px-4">
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-emerald-400 border border-zinc-700">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-zinc-300 max-w-md truncate">{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Lecturer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span>Provision Lecturer Account</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-500 hover:text-zinc-300 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateLecturer} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Staff ID *</label>
                <input
                  type="text"
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  placeholder="STF/CSC/04"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Full Name *</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Dr. Margaret Hamilton"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Email Address *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hamilton@classguard.edu"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Department</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Computer Science"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Temporary Initial Password</label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 font-mono"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold"
                >
                  {submitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
