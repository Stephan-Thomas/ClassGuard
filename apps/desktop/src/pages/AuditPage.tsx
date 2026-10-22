import React, { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { AuditLog } from '@classguard/shared';
import { ClipboardList, Shield, Search } from 'lucide-react';

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filterAction, setFilterAction] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getAuditLogs(100).then((res) => {
      if (res.success) {
        setLogs(res.data);
      }
      setLoading(false);
    });
  }, []);

  const filteredLogs = filterAction
    ? logs.filter((l) => l.action.toLowerCase().includes(filterAction.toLowerCase()) || l.details.toLowerCase().includes(filterAction.toLowerCase()))
    : logs;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-emerald-400" />
            <span>System Audit Logs</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Tamper-evident administrative audit trail of logins, biometric enrollments, overrides, and session events
          </p>
        </div>

        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            placeholder="Search action or details..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="glass-panel rounded-2xl border border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900/60 text-zinc-400 uppercase font-mono tracking-wider text-[11px] border-b border-zinc-800">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Audit Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono text-zinc-400 whitespace-nowrap">
                      {new Date(l.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-emerald-400">
                      <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px]">
                        {l.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-400">{l.entityType}</td>
                    <td className="py-3 px-4 text-zinc-300 font-medium">{l.username || 'System'}</td>
                    <td className="py-3 px-4 text-zinc-300 max-w-md">{l.details}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-500">
                    {loading ? 'Loading audit trail...' : 'No audit records found.'}
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
