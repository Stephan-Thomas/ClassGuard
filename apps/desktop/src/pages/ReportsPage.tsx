import React, { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { Course } from '@classguard/shared';
import {
  FileBarChart,
  Download,
  Filter,
  CheckCircle2,
  Clock,
  UserX,
  GraduationCap,
  Percent,
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [reportData, setReportData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getCourses().then((res) => {
      if (res.success && res.data.length > 0) {
        setCourses(res.data);
        setSelectedCourseId(res.data[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedCourseId) return;
    setLoading(true);
    api.getCourseReport(selectedCourseId).then((res) => {
      if (res.success) {
        setReportData(res.data);
      }
      setLoading(false);
    });
  }, [selectedCourseId]);

  const handleExportCsv = async () => {
    if (!selectedCourseId) return;
    const res = await api.exportCsv(selectedCourseId);
    if (res.success && res.csv) {
      const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', res.filename || 'Attendance_Report.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const course = reportData?.course;
  const breakdown = reportData?.studentBreakdown || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <FileBarChart className="w-5 h-5 text-emerald-400" />
            <span>Attendance Reports & Analytics</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Course-level attendance summaries, student compliance percentages, and exportable CSV rosters
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}: {c.title}
              </option>
            ))}
          </select>

          <button
            onClick={handleExportCsv}
            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-emerald-400 flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel rounded-xl p-4 border border-zinc-800">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Total Enrolled</span>
          <div className="mt-2 text-2xl font-extrabold text-zinc-100 font-mono">
            {reportData?.enrolledCount || 0}
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">Eligible student count</p>
        </div>

        <div className="glass-panel rounded-xl p-4 border border-zinc-800">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Completed Sessions</span>
          <div className="mt-2 text-2xl font-extrabold text-cyan-400 font-mono">
            {reportData?.closedSessions || 0}
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">Closed lecture sessions</p>
        </div>

        <div className="glass-panel rounded-xl p-4 border border-zinc-800">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Average Compliance</span>
          <div className="mt-2 text-2xl font-extrabold text-emerald-400 font-mono">
            {reportData?.averageRate || 0}%
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">Mean attendance percentage</p>
        </div>

        <div className="glass-panel rounded-xl p-4 border border-zinc-800">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Calculation Rule</span>
          <div className="mt-2 text-xs text-zinc-300 font-mono">
            (Attended / Closed Sessions) * 100
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">Active sessions unpenalized</p>
        </div>
      </div>

      {/* Student Breakdown Table */}
      <div className="glass-panel rounded-2xl border border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/40">
          <div>
            <h2 className="text-sm font-bold text-zinc-100">
              {course?.code || 'Course'} Attendance Compliance Breakdown
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">{course?.title}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900/60 text-zinc-400 uppercase font-mono tracking-wider text-[11px] border-b border-zinc-800">
              <tr>
                <th className="py-3 px-4">Matriculation</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4 text-emerald-400">Present (On-Time)</th>
                <th className="py-3 px-4 text-amber-400">Late</th>
                <th className="py-3 px-4 text-rose-400">Absent</th>
                <th className="py-3 px-4">Eligible Sessions</th>
                <th className="py-3 px-4 font-bold text-zinc-100">Attendance %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {breakdown.length > 0 ? (
                breakdown.map((b: any) => {
                  const pct = b.attendancePercentage;
                  const isGood = pct >= 75;
                  return (
                    <tr key={b.studentId} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-zinc-200">{b.matricNumber}</td>
                      <td className="py-3 px-4 font-medium text-zinc-100">{b.studentName}</td>
                      <td className="py-3 px-4 font-mono text-emerald-400 font-semibold">{b.presentCount}</td>
                      <td className="py-3 px-4 font-mono text-amber-400">{b.lateCount}</td>
                      <td className="py-3 px-4 font-mono text-rose-400">{b.absentCount}</td>
                      <td className="py-3 px-4 font-mono text-zinc-400">{b.eligibleSessions}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono font-bold text-xs ${
                              isGood ? 'text-emerald-400' : 'text-amber-400'
                            }`}
                          >
                            {pct}%
                          </span>
                          <div className="w-16 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                            <div
                              style={{ width: `${pct}%` }}
                              className={`h-full ${isGood ? 'bg-emerald-500' : 'bg-amber-500'}`}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    {loading ? 'Compiling attendance analytics...' : 'No enrollment or attendance records found.'}
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
