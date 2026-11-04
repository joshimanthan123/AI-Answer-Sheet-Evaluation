import { Notification } from '../types';
import apiClient from '../api/axios';

export const notificationService = {
  getNotifications: async (userId: string): Promise<Notification[]> => {
    const response = await apiClient.get<any, any>(`/notifications?user=${userId}`);
    const data = response.data || [];
    return data.map((n: any) => ({
      id: n._id || n.id,
      userId: n.user?._id || n.user,
      title: n.title,
      message: n.message,
      read: n.read,
      type: n.type,
      date: n.createdAt || n.date,
    }));
  },

  markAsRead: async (notifId: string): Promise<void> => {
    await apiClient.put(`/notifications/${notifId}`, { read: true });
  },

  markAllAsRead: async (userId: string): Promise<void> => {
    await apiClient.patch('/notifications/mark-all-read');
  }
};

export default notificationService;
