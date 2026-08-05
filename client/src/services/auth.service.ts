import { User } from '../types';
import { mockUsers } from '../mocks/db';

export const authService = {
  login: async (email: string, password: string): Promise<{ user: User; token: string }> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Fast credentials mock matching email
        const user = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (user) {
          const mockToken = `mock-jwt-token-for-${user.role}`;
          localStorage.setItem('gradeai_token', mockToken);
          localStorage.setItem('gradeai_user', JSON.stringify(user));
          resolve({ user, token: mockToken });
        } else {
          // Default fallbacks with credentials fallback for testing easiness
          if (email.includes('student') || email.includes('fac') || email.includes('admin')) {
            let role: 'student' | 'faculty' | 'admin' = 'student';
            if (email.includes('fac')) role = 'faculty';
            if (email.includes('admin')) role = 'admin';

            const defaultUser: User = {
              id: `user-${role}-default`,
              name: `Demo ${role.toUpperCase()}`,
              email,
              role,
              status: 'online',
            };
            const mockToken = `mock-jwt-token-for-${role}`;
            localStorage.setItem('gradeai_token', mockToken);
            localStorage.setItem('gradeai_user', JSON.stringify(defaultUser));
            resolve({ user: defaultUser, token: mockToken });
          } else {
            reject(new Error('Invalid email or password'));
          }
        }
      }, 800);
    });
  },

  register: async (name: string, email: string, role: 'student' | 'faculty' | 'admin'): Promise<{ user: User; token: string }> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const newUser: User = {
          id: `user-${role}-${Date.now()}`,
          name,
          email,
          role,
          status: 'online',
        };
        const mockToken = `mock-jwt-token-for-${role}`;
        localStorage.setItem('gradeai_token', mockToken);
        localStorage.setItem('gradeai_user', JSON.stringify(newUser));
        resolve({ user: newUser, token: mockToken });
      }, 800);
    });
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (email.includes('@')) {
          resolve({ message: 'A password reset link has been dispatched to your email address.' });
        } else {
          reject(new Error('Invalid email address'));
        }
      }, 600);
    });
  },

  getMe: async (): Promise<User | null> => {
    return new Promise((resolve) => {
      const stored = localStorage.getItem('gradeai_user');
      if (stored) {
        resolve(JSON.parse(stored));
      } else {
        resolve(null);
      }
    });
  },

  logout: async (): Promise<void> => {
    localStorage.removeItem('gradeai_token');
    localStorage.removeItem('gradeai_user');
  }
};
export default authService;
