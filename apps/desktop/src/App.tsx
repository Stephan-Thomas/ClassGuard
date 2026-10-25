import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { SuperadminDashboardPage } from './pages/SuperadminDashboardPage';
import { StudentDashboardPage } from './pages/StudentDashboardPage';
import { StudentsPage } from './pages/StudentsPage';
import { CoursesPage } from './pages/CoursesPage';
import { SessionsPage } from './pages/SessionsPage';
import { LiveMonitorPage } from './pages/LiveMonitorPage';
import { LecturerQrPage } from './pages/LecturerQrPage';
import { ReportsPage } from './pages/ReportsPage';
import { SyncPage } from './pages/SyncPage';
import { AuditPage } from './pages/AuditPage';
import { SettingsPage } from './pages/SettingsPage';
import { KioskPage } from './pages/KioskPage';

// Base Protected Route Guard
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

// Lecturer / Admin Route Guard (strictly blocks students)
const LecturerRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isStudent, isSuperadmin } = useAuth();
  if (isStudent) {
    return <Navigate to="/student" replace />;
  }
  return <>{children}</>;
};

// Superadmin Route Guard
const SuperadminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isSuperadmin } = useAuth();
  if (!isSuperadmin) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

// Student Route Guard
const StudentRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isStudent } = useAuth();
  if (!isStudent) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

// Role-directed Dashboard Home
const RoleDashboardDispatcher: React.FC = () => {
  const { isSuperadmin, isStudent } = useAuth();
  if (isSuperadmin) {
    return <Navigate to="/superadmin" replace />;
  }
  if (isStudent) {
    return <Navigate to="/student" replace />;
  }
  return <DashboardPage />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication */}
          <Route path="/login" element={<LoginPage />} />

          {/* Lecturer-bound Active Session Kiosk (Protected from unauthenticated access) */}
          <Route
            path="/kiosk"
            element={
              <ProtectedRoute>
                <LecturerRoute>
                  <KioskPage />
                </LecturerRoute>
              </ProtectedRoute>
            }
          />

          {/* Administration & Roles Console */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            
            {/* Dashboard routes */}
            <Route path="dashboard" element={<RoleDashboardDispatcher />} />
            <Route
              path="superadmin"
              element={
                <SuperadminRoute>
                  <SuperadminDashboardPage />
                </SuperadminRoute>
              }
            />
            <Route
              path="student"
              element={
                <StudentRoute>
                  <StudentDashboardPage />
                </StudentRoute>
              }
            />

            {/* Lecturer-specific routes */}
            <Route
              path="students"
              element={
                <LecturerRoute>
                  <StudentsPage />
                </LecturerRoute>
              }
            />
            <Route
              path="courses"
              element={
                <LecturerRoute>
                  <CoursesPage />
                </LecturerRoute>
              }
            />
            <Route
              path="sessions"
              element={
                <LecturerRoute>
                  <SessionsPage />
                </LecturerRoute>
              }
            />
            <Route
              path="live-monitor"
              element={
                <LecturerRoute>
                  <LiveMonitorPage />
                </LecturerRoute>
              }
            />
            <Route
              path="lecturer-qr"
              element={
                <LecturerRoute>
                  <LecturerQrPage />
                </LecturerRoute>
              }
            />
            <Route
              path="reports"
              element={
                <LecturerRoute>
                  <ReportsPage />
                </LecturerRoute>
              }
            />

            {/* Infrastructure / Operations */}
            <Route path="sync" element={<SyncPage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
