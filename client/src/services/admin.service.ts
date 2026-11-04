import { User, Department, Course, Subject, AuditLog } from '../types';
import apiClient from '../api/axios';
import { 
  mockUsers, 
  mockDepartments, 
  mockCourses, 
  mockSubjects, 
  mockAuditLogs 
} from '../mocks/db';

export const adminService = {
  // User Management
  getUsers: async (): Promise<User[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockUsers);
      }, 400);
    });
  },

  createUser: async (user: Omit<User, 'id' | 'status'>): Promise<User> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const newUser: User = {
          ...user,
          id: `user-${Date.now()}`,
          status: 'offline'
        };
        mockUsers.push(newUser);
        resolve(newUser);
      }, 600);
    });
  },

  deleteUser: async (id: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const index = mockUsers.findIndex(u => u.id === id);
        if (index !== -1) {
          mockUsers.splice(index, 1);
          resolve();
        } else {
          reject(new Error('User not found'));
        }
      }, 500);
    });
  },

  // Department Management
  getDepartments: async (): Promise<Department[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockDepartments);
      }, 300);
    });
  },

  createDepartment: async (dept: Omit<Department, 'id'>): Promise<Department> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const newDept: Department = {
          ...dept,
          id: `dept-${Date.now()}`
        };
        mockDepartments.push(newDept);
        resolve(newDept);
      }, 500);
    });
  },

  // Course Management
  getCourses: async (): Promise<Course[]> => {
    const response = await apiClient.get<any, any>('/courses');
    const list = response.data || response;
    const courses = Array.isArray(list) ? list : (list.data || []);
    return courses.map((c: any) => ({
      ...c,
      id: c._id || c.id
    }));
  },

  createCourse: async (course: Omit<Course, 'id'>): Promise<Course> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const newCourse: Course = {
          ...course,
          id: `course-${Date.now()}`
        };
        mockCourses.push(newCourse);
        resolve(newCourse);
      }, 500);
    });
  },

  // Subject Management
  getSubjects: async (): Promise<Subject[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockSubjects);
      }, 300);
    });
  },

  createSubject: async (subject: Omit<Subject, 'id'>): Promise<Subject> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const newSubject: Subject = {
          ...subject,
          id: `sub-${Date.now()}`
        };
        mockSubjects.push(newSubject);
        resolve(newSubject);
      }, 500);
    });
  },

  // AI Configuration Management
  getAIConfig: async (): Promise<{ similarityThreshold: number; promptTemplate: string; modelName: string }> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const similarityThreshold = parseInt(localStorage.getItem('ai_similarity_threshold') || '75');
        const promptTemplate = localStorage.getItem('ai_prompt_template') || 'Compare student answers against expected keywords and grant partial marks...';
        const modelName = localStorage.getItem('ai_model_name') || 'Gemini 1.5 Pro';
        resolve({ similarityThreshold, promptTemplate, modelName });
      }, 400);
    });
  },

  saveAIConfig: async (config: { similarityThreshold: number; promptTemplate: string; modelName: string }): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        localStorage.setItem('ai_similarity_threshold', config.similarityThreshold.toString());
        localStorage.setItem('ai_prompt_template', config.promptTemplate);
        localStorage.setItem('ai_model_name', config.modelName);
        
        // Log this action
        const newLog: AuditLog = {
          id: `log-${Date.now()}`,
          userId: 'user-adm-1',
          userName: 'System Administrator',
          role: 'ADMIN',
          action: `Updated AI Configuration (Similarity threshold to ${config.similarityThreshold}%, Model to ${config.modelName})`,
          ipAddress: '127.0.0.1',
          timestamp: new Date().toISOString(),
          status: 'success',
          level: 'info',
          message: `Updated AI Configuration (Similarity threshold to ${config.similarityThreshold}%, Model to ${config.modelName})`
        };
        mockAuditLogs.unshift(newLog);
        resolve();
      }, 600);
    });
  },

  // System Logs
  getAuditLogs: async (): Promise<AuditLog[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockAuditLogs.map(l => ({
          ...l,
          level: l.level || (l.status === 'success' ? 'info' : 'error'),
          message: l.message || l.action
        })));
      }, 400);
    });
  },

  getSystemLogs: async (): Promise<AuditLog[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockAuditLogs.map(l => ({
          ...l,
          level: l.level || (l.status === 'success' ? 'info' : 'error'),
          message: l.message || l.action
        })));
      }, 400);
    });
  },

  // Update user role
  updateUserRole: async (userId: string, role: 'student' | 'faculty' | 'admin'): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const index = mockUsers.findIndex(u => u.id === userId);
        if (index !== -1) {
          mockUsers[index].role = role;
        }
        resolve();
      }, 500);
    });
  }
};

export default adminService;

