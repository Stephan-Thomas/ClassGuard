import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
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

// Protected Route Guard
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication */}
          <Route path="/login" element={<LoginPage />} />

          {/* Dedicated Fullscreen Student Kiosk (No login needed) */}
          <Route path="/kiosk" element={<KioskPage />} />

          {/* Administration & Lecturer Console */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="courses" element={<CoursesPage />} />
            <Route path="sessions" element={<SessionsPage />} />
            <Route path="live-monitor" element={<LiveMonitorPage />} />
            <Route path="lecturer-qr" element={<LecturerQrPage />} />
            <Route path="reports" element={<ReportsPage />} />
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
