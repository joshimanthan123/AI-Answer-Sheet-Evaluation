import { User } from '../types';
import apiClient from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';

export const authService = {
  login: async (email: string, password: string): Promise<{ user: User; token: string }> => {
    const response = await apiClient.post<any, any>(API_ENDPOINTS.AUTH.LOGIN, { email, password });
    const { user, token } = response.data;
    localStorage.setItem('gradeai_token', token);
    localStorage.setItem('gradeai_user', JSON.stringify(user));
    return { user, token };
  },

  register: async (
    name: string,
    email: string,
    role: 'student' | 'faculty' | 'admin',
    password?: string,
    confirmPassword?: string,
    lecturerId?: string,
    studentId?: string
  ): Promise<{ user: User; message?: string }> => {
    const response = await apiClient.post<any, any>(API_ENDPOINTS.AUTH.REGISTER, {
      name,
      email,
      role,
      password,
      confirmPassword,
      lecturerId,
      studentId,
    });
    // In our register flow, we direct to /login and do NOT auto-login.
    return response.data || response;
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response = await apiClient.post<any, any>(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, { email });
    return { message: response.message || 'A password reset link has been dispatched to your email address.' };
  },

  getMe: async (): Promise<User | null> => {
    try {
      const response = await apiClient.get<any, any>(API_ENDPOINTS.AUTH.ME);
      const user = response.data?.user || response.data;
      if (user) {
        localStorage.setItem('gradeai_user', JSON.stringify(user));
        return user;
      }
      return null;
    } catch (err) {
      console.error('Failed to retrieve session from server', err);
      const stored = localStorage.getItem('gradeai_user');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return null;
        }
      }
      return null;
    }
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post(API_ENDPOINTS.AUTH.LOGIN.replace('/login', '/logout'));
    } catch (err) {
      console.error('Logout request failed', err);
    } finally {
      localStorage.removeItem('gradeai_token');
      localStorage.removeItem('gradeai_user');
    }
  },

  updateProfile: async (data: FormData | { name: string; email?: string }): Promise<User> => {
    const storedUser = JSON.parse(localStorage.getItem('gradeai_user') || '{}');
    const role = storedUser.role;
    const isStudent = role === 'student';
    const endpoint = isStudent ? '/student/profile' : '/faculty/profile';
    const headers = data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
    const method = isStudent ? 'patch' : 'put';

    const response = await apiClient[method]<any, any>(endpoint, data, { headers });
    const user = response.data?.user || response.data;
    localStorage.setItem('gradeai_user', JSON.stringify(user));
    return user;
  },

  changePassword: async (currentPassword: string, newPassword: string, confirmPassword: string): Promise<void> => {
    await apiClient.put('/faculty/change-password', {
      currentPassword,
      newPassword,
      confirmPassword,
    });
  }
};
export default authService;
