import apiClient from '../api/axios';
import { Subject } from '../types';

export const subjectService = {
  getSubjects: async (params?: any): Promise<Subject[]> => {
    const response = await apiClient.get<any, any>('/subjects', { params });
    // In our backend response, subjects are returned inside data.data or response.data.data
    const list = response.data || response;
    
    // Support mapping mongo's _id to UI's id property
    const subjects = Array.isArray(list) ? list : (list.data || []);
    return subjects.map((sub: any) => ({
      ...sub,
      id: sub._id || sub.id,
    }));
  },

  getSubjectById: async (id: string): Promise<Subject> => {
    const response = await apiClient.get<any, any>(`/subjects/${id}`);
    const data = response.data || response;
    return {
      ...data,
      id: data._id || data.id,
    };
  },

  createSubject: async (subjectData: Omit<Subject, 'id'>): Promise<Subject> => {
    const response = await apiClient.post<any, any>('/subjects', subjectData);
    const data = response.data || response;
    return {
      ...data,
      id: data._id || data.id,
    };
  },

  updateSubject: async (id: string, subjectData: Partial<Subject>): Promise<Subject> => {
    const response = await apiClient.put<any, any>(`/subjects/${id}`, subjectData);
    const data = response.data || response;
    return {
      ...data,
      id: data._id || data.id,
    };
  },

  deleteSubject: async (id: string): Promise<void> => {
    await apiClient.delete(`/subjects/${id}`);
  },
};

export default subjectService;
