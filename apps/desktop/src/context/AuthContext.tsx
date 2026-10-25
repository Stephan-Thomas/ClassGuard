import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '@classguard/shared';
import { api } from '../lib/api-client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  role: UserRole | null;
  login: (user: User, token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;        // Lecturer / Attendance Admin
  isSuperadmin: boolean;   // IT System Administrator
  isStudent: boolean;      // Student Portal
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'classguard_session_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  // Authoritatively validate session on initial application load
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      if (!savedToken) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const res = await api.validateSession(savedToken);
        if (isMounted) {
          if (res.success && res.user) {
            setUser(res.user);
            setToken(savedToken);
          } else {
            // Invalid or expired session: purge token from storage
            localStorage.removeItem(TOKEN_KEY);
            setUser(null);
            setToken(null);
          }
        }
      } catch (err) {
        if (isMounted) {
          localStorage.removeItem(TOKEN_KEY);
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = (newUser: User, newToken: string) => {
    setUser(newUser);
    setToken(newToken);
    localStorage.setItem(TOKEN_KEY, newToken);
  };

  const logout = () => {
    const currentToken = token || localStorage.getItem(TOKEN_KEY);
    if (currentToken) {
      api.logout(currentToken).catch(() => {});
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
  };

  const isAuthenticated = !!user && !!token;
  const role = user?.role || null;
  const isAdmin = role === 'ADMIN';            // Lecturer
  const isSuperadmin = role === 'SUPERADMIN';  // Superadmin
  const isStudent = role === 'STUDENT';        // Student

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role,
        login,
        logout,
        isAuthenticated,
        isAdmin,
        isSuperadmin,
        isStudent,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
