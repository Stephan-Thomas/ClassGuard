import React, { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import {
  RefreshCw,
  Database,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Wifi,
  WifiOff,
  Download,
  UploadCloud,
  ShieldCheck,
} from 'lucide-react';

export const SyncPage: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState<{ pendingCount: number; syncedCount: number; lastSyncedAt?: string }>({
    pendingCount: 0,
    syncedCount: 0,
  });
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [provisioning, setProvisioning] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const checkStatus = async () => {
    try {
      const net = await api.checkOnline();
      setIsOnline(net.online);
      const res = await api.getSyncStatus();
      if (res.success && res.data) {
        setSyncStatus(res.data);
      }
    } catch (err: any) {
      setIsOnline(false);
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSyncNow = async () => {
    setSyncing(true);
    setFeedback(null);
    try {
      const res = await api.syncNow();
      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Successfully synchronized ${res.syncedCount} attendance records to central database.`,
        });
        checkStatus();
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Synchronization failed.',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const handlePullProvisioning = async () => {
    setProvisioning(true);
    setFeedback(null);
    try {
      const res = await api.pullProvisioning();
      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message || 'Offline provisioning package refreshed successfully.',
        });
        checkStatus();
      } else {
        setFeedback({ type: 'error', message: res.message || 'Provisioning pull failed.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setProvisioning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-emerald-400" />
            <span>Offline Synchronization Manager</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Idempotent batch upload of local attendance records and kiosk offline provisioning
          </p>
        </div>

        <button
          onClick={handleSyncNow}
          disabled={syncing || syncStatus.pendingCount === 0}
          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
        >
          <UploadCloud className="w-4 h-4" />
          <span>{syncing ? 'Synchronizing...' : 'Sync Now'}</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs flex items-start gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Connectivity & Queue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="glass-panel rounded-2xl p-5 border border-zinc-800 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Connectivity Status</span>
          <div className="flex items-center gap-2.5 mt-1">
            {isOnline ? (
              <>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Wifi className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm font-bold text-emerald-400">Central API Online</span>
                  <p className="text-[11px] text-zinc-500">MongoDB endpoint reachable</p>
                </div>
              </>
            ) : (
              <>
                <div className="p-2 rounded-lg bg-zinc-800 text-amber-400">
                  <WifiOff className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm font-bold text-zinc-300">Offline Standalone Mode</span>
                  <p className="text-[11px] text-zinc-500">Local SQLite storage active</p>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-zinc-800 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Pending Upload Queue</span>
          <div className="flex items-center gap-2.5 mt-1">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-extrabold text-amber-400 font-mono">
                {syncStatus.pendingCount}
              </span>
              <p className="text-[11px] text-zinc-500">Unsynchronized local records</p>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-zinc-800 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Acknowledged Central Records</span>
          <div className="flex items-center gap-2.5 mt-1">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-extrabold text-zinc-100 font-mono">
                {syncStatus.syncedCount}
              </span>
              <p className="text-[11px] text-zinc-500">Idempotently acknowledged</p>
            </div>
          </div>
        </div>
      </div>

      {/* Offline Reliability Architecture Card */}
      <div className="glass-panel rounded-2xl p-6 border border-zinc-800 space-y-4">
        <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Offline-First Reliability & Idempotency Guarantees</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-zinc-400">
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1.5">
            <span className="font-semibold text-zinc-200">1. Persistent Local SQLite</span>
            <p>
              Attendance scans are written immediately to local disk. Records survive application crashes, restarts,
              or power failures without data loss.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1.5">
            <span className="font-semibold text-zinc-200">2. Idempotent Synchronization</span>
            <p>
              Every attendance record has a globally unique client ID and a strict uniqueness constraint on{' '}
              <code className="text-emerald-400">[student_id, session_id]</code>. Re-transmitting never creates duplicates.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1.5">
            <span className="font-semibold text-zinc-200">3. Pre-Provisioned Biometrics</span>
            <p>
              Student facial embeddings are stored locally in SQLite, permitting one-to-one facial verification at the
              kiosk without an active internet connection.
            </p>
          </div>
        </div>
      </div>

      {/* Kiosk Provisioning Bundle Card */}
      <div className="glass-panel rounded-2xl p-6 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-zinc-100">Kiosk Provisioning Bundle</h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-xl">
            Pull all active student enrollments, biometric facial vectors, course details, and active session
            credentials from the central server to prepare this computer for an offline exam or classroom period.
          </p>
        </div>

        <button
          onClick={handlePullProvisioning}
          disabled={provisioning || !isOnline}
          className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 border border-zinc-700 text-xs font-semibold text-cyan-400 flex items-center gap-2 transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>{provisioning ? 'Downloading...' : 'Pull Provisioning Data'}</span>
        </button>
      </div>
    </div>
  );
};
