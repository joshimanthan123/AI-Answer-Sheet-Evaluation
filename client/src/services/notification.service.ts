import { Notification } from '../types';
import { mockNotifications } from '../mocks/db';

export const notificationService = {
  getNotifications: async (userId: string): Promise<Notification[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const list = mockNotifications.filter(n => n.userId === userId || userId === 'all');
        resolve(list);
      }, 300);
    });
  },

  markAsRead: async (notifId: string): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const notif = mockNotifications.find(n => n.id === notifId);
        if (notif) {
          notif.read = true;
        }
        resolve();
      }, 200);
    });
  },

  markAllAsRead: async (userId: string): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        mockNotifications
          .filter(n => n.userId === userId)
          .forEach(n => {
            n.read = true;
          });
        resolve();
      }, 300);
    });
  }
};

export default notificationService;
