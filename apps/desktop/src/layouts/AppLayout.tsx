import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api-client';
import {
  ShieldCheck,
  LayoutDashboard,
  Users,
  GraduationCap,
  Calendar,
  Activity,
  QrCode,
  FileBarChart,
  RefreshCw,
  ClipboardList,
  Settings,
  LogOut,
  Maximize2,
  Minimize2,
  Wifi,
  WifiOff,
  UserCheck,
} from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { user, logout, role, isAdmin, isSuperadmin, isStudent } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  useEffect(() => {
    const updateStatus = async () => {
      try {
        const net = await api.checkOnline();
        setIsOnline(net.online);
        const sync = await api.getSyncStatus();
        if (sync.success && sync.data) {
          setPendingSyncCount(sync.data.pendingCount);
        }
      } catch {
        setIsOnline(false);
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleFullscreen = async () => {
    try {
      const res = await api.toggleFullscreen();
      setIsFullscreen(res.isFullScreen);
    } catch {}
  };

  // Build role-tailored navigation items
  const getNavItems = () => {
    if (isSuperadmin) {
      return [
        { to: '/superadmin', label: 'Superadmin Console', icon: LayoutDashboard },
        { to: '/audit', label: 'Security Audit Logs', icon: ClipboardList },
        { to: '/sync', label: 'Sync & Infrastructure', icon: RefreshCw, badge: pendingSyncCount > 0 ? pendingSyncCount : null },
        { to: '/settings', label: 'System Settings', icon: Settings },
      ];
    }

    if (isStudent) {
      return [
        { to: '/student', label: 'My Attendance Portal', icon: LayoutDashboard },
      ];
    }

    // Default: Lecturer (ADMIN)
    return [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/students', label: 'Students & Enrollment', icon: Users },
      { to: '/courses', label: 'Assigned Courses', icon: GraduationCap },
      { to: '/sessions', label: 'Attendance Sessions', icon: Calendar },
      { to: '/live-monitor', label: 'Live Monitor', icon: Activity },
      { to: '/lecturer-qr', label: 'Classroom QR Screen', icon: QrCode },
      { to: '/reports', label: 'Attendance Reports', icon: FileBarChart },
      { to: '/sync', label: 'Sync Queue', icon: RefreshCw, badge: pendingSyncCount > 0 ? pendingSyncCount : null },
      { to: '/settings', label: 'Settings', icon: Settings },
    ];
  };

  const navItems = getNavItems();

  const roleDisplayLabel = isSuperadmin ? 'IT Superadmin' : isStudent ? 'Student' : 'Lecturer';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-zinc-800/80 bg-zinc-900/50 backdrop-blur-md">
        {/* Branding */}
        <div className="h-16 px-5 flex items-center gap-3 border-b border-zinc-800/80">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <ShieldCheck className="w-5 h-5 text-zinc-950 font-bold" />
          </div>
          <div>
            <span className="font-bold tracking-tight text-base text-zinc-100 flex items-center gap-1.5">
              Class<span className="text-emerald-400">Guard</span>
            </span>
            <span className="text-[10px] tracking-wider uppercase text-zinc-400 block font-mono">
              Attendance System
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-zinc-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User Profile & Logout */}
        <div className="p-3.5 border-t border-zinc-800/80 flex items-center justify-between bg-zinc-900/40">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-semibold text-emerald-400 flex-shrink-0">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-zinc-200 truncate">{user?.fullName || 'User'}</p>
              <p className="text-[10px] text-emerald-400/90 font-medium">{roleDisplayLabel}</p>
            </div>
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
            title="Sign Out"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 border-b border-zinc-800/80 px-6 flex items-center justify-between bg-zinc-950/60 backdrop-blur-md flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">{roleDisplayLabel}</span>
            <span className="text-zinc-700">/</span>
            <span className="text-xs font-medium text-zinc-300 capitalize">
              {location.pathname.replace('/', '').replace('-', ' ') || 'Console'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Cloud Sync Status */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border ${
                isOnline
                  ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/60'
                  : 'bg-zinc-900 text-zinc-300 border-zinc-800'
              }`}
            >
              {isOnline ? (
                <>
                  <Wifi className="w-3 h-3 text-emerald-400" />
                  <span>Cloud Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-amber-400" />
                  <span>Offline (SQLite Resilient)</span>
                </>
              )}
            </div>

            {/* Fullscreen Toggle */}
            <button
              onClick={handleToggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Viewport */}
        <main className="flex-1 overflow-y-auto p-6 bg-zinc-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
