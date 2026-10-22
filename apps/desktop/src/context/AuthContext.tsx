import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@classguard/shared';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (user: User, token?: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLecturer: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('classguard_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('classguard_token');
  });

  const login = (newUser: User, newToken?: string) => {
    setUser(newUser);
    localStorage.setItem('classguard_user', JSON.stringify(newUser));
    if (newToken) {
      setToken(newToken);
      localStorage.setItem('classguard_token', newToken);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('classguard_user');
    localStorage.removeItem('classguard_token');
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'ADMIN';
  const isLecturer = user?.role === 'LECTURER';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAuthenticated,
        isAdmin,
        isLecturer,
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
