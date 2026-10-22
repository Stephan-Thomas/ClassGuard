import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api-client';
import { ShieldCheck, Lock, Mail, ArrowRight, Tv, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.login({ email, password });
      if (res.success && res.user) {
        login(res.user);
        navigate('/dashboard');
      } else {
        setError(res.error || 'Authentication failed. Please verify credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed due to unexpected error.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
    setLoading(true);
    api.login({ email: demoEmail, password: demoPass }).then((res) => {
      setLoading(false);
      if (res.success && res.user) {
        login(res.user);
        navigate('/dashboard');
      } else {
        setError(res.error || 'Login failed');
      }
    });
  };

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-zinc-950 p-6 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 shadow-xl shadow-emerald-500/25 mb-4">
            <ShieldCheck className="w-8 h-8 text-zinc-950 font-bold" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Class<span className="text-emerald-400">Guard</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
            Desktop Student Attendance Tracking & Monitoring System with QR Code & Facial Verification
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-panel rounded-2xl p-7 border border-zinc-800 shadow-2xl">
          <h2 className="text-lg font-semibold text-zinc-200 mb-5">Sign In to Console</h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@classguard.edu"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer mt-2"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Credentials Buttons */}
          <div className="mt-6 pt-5 border-t border-zinc-800">
            <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold block mb-2.5">
              Quick Demo Logins
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@classguard.edu', 'Admin@123')}
                className="py-2 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-300 text-left transition-colors flex flex-col cursor-pointer"
              >
                <span className="font-semibold text-emerald-400">Admin Console</span>
                <span className="text-[10px] text-zinc-400 font-mono">admin@classguard.edu</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('turing@classguard.edu', 'Lecturer@123')}
                className="py-2 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-300 text-left transition-colors flex flex-col cursor-pointer"
              >
                <span className="font-semibold text-cyan-400">Lecturer Console</span>
                <span className="text-[10px] text-zinc-400 font-mono">turing@classguard.edu</span>
              </button>
            </div>
          </div>
        </div>

        {/* Direct Kiosk Entry for Classroom Entrance */}
        <div className="mt-5 text-center">
          <button
            onClick={() => navigate('/kiosk')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-emerald-400 transition-colors cursor-pointer"
          >
            <Tv className="w-3.5 h-3.5 text-emerald-400" />
            <span>Open Student Attendance Kiosk (No Login Required)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
