import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api-client';
import { ShieldCheck, Lock, User as UserIcon, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login, isAuthenticated, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // If already authenticated with validated session, redirect to role-specific dashboard
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      if (user.role === 'SUPERADMIN') {
        navigate('/superadmin', { replace: true });
      } else if (user.role === 'STUDENT') {
        navigate('/student', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = identifier.trim();
    if (!cleanId || !password) {
      setError('Please provide your username/email and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.login({ email: cleanId, password });
      if (res.success && res.user && res.token) {
        login(res.user, res.token);
        // Route to the dashboard matching user's actual role
        if (res.user.role === 'SUPERADMIN') {
          navigate('/superadmin', { replace: true });
        } else if (res.user.role === 'STUDENT') {
          navigate('/student', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      } else {
        setError(res.error || 'Authentication failed. Please verify your credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed due to unexpected error.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-xs text-zinc-400 font-mono">Validating session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-zinc-950 p-6 relative overflow-hidden">
      {/* Subtle ambient lighting */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* ClassGuard Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 shadow-xl shadow-emerald-500/25 mb-4">
            <ShieldCheck className="w-8 h-8 text-zinc-950 font-bold" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Class<span className="text-emerald-400">Guard</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1.5 max-w-xs mx-auto">
            Desktop Student Attendance Tracking & Monitoring System
          </p>
        </div>

        {/* Clean Login Card */}
        <div className="glass-panel rounded-2xl p-8 border border-zinc-800 shadow-2xl bg-zinc-900/60 backdrop-blur-xl">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-zinc-100">Sign In to Your Account</h2>
            <p className="text-xs text-zinc-400 mt-1">
              Enter your authorized credentials to access your console.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Email or Username
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="name@classguard.edu or 2xxx/2xxxxx"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-300 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer mt-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>
        </div>

        {/* Security & Access Notice */}
        <p className="text-[11px] text-zinc-500 text-center mt-6">
          Authorized academic and administrative access only. System activity is logged.
        </p>
      </div>
    </div>
  );
};
