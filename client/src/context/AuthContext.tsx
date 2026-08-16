import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../types';
import { authService } from '../services/auth.service';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (
    name: string,
    email: string,
    role: 'student' | 'faculty' | 'admin',
    password?: string,
    confirmPassword?: string,
    lecturerId?: string,
    studentId?: string
  ) => Promise<any>;
  logout: () => Promise<void>;
  updateProfile: (data: FormData | { name: string; email?: string }) => Promise<User>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await authService.getMe();
        setUser(currentUser);
      } catch (err) {
        console.error('Failed to load user', err);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    setLoading(true);
    try {
      const response = await authService.login(email, password);
      setUser(response.user);
      return response.user;
    } catch (error) {
      setUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (
    name: string,
    email: string,
    role: 'student' | 'faculty' | 'admin',
    password?: string,
    confirmPassword?: string,
    lecturerId?: string,
    studentId?: string
  ): Promise<any> => {
    setLoading(true);
    try {
      const response = await authService.register(name, email, role, password, confirmPassword, lecturerId, studentId);
      return response;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authService.logout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (data: FormData | { name: string; email?: string }): Promise<User> => {
    setLoading(true);
    try {
      const updatedUser = await authService.updateProfile(data);
      setUser(updatedUser);
      return updatedUser;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
export default AuthContext;
