import { frameNotificationsAdminManifest } from '@lingcootech/frame-admin/manifest';
import { FRAME_VERSION, type ExtensionManifest } from '@lingcootech/frame-extension-sdk';

export const notificationsPermissions = ['notifications.read', 'notifications.manage'] as const;

export const notificationsServerRoutes = [
  { method: 'GET', path: '/api/notifications/me' },
  { method: 'GET', path: '/api/notifications/me/unread-count' },
  { method: 'POST', path: '/api/notifications/:notificationId/read' },
  { method: 'POST', path: '/api/notifications/read-all' },
  { method: 'POST', path: '/api/notifications/:notificationId/archive' },
  { method: 'GET', path: '/api/notifications/admin' },
  { method: 'GET', path: '/api/notifications/deliveries' },
  { method: 'POST', path: '/api/notifications/announcements' },
] as const;

export const frameNotificationsManifest = {
  id: 'frame-notifications',
  version: FRAME_VERSION,
  apiVersion: '1',
  frame: `^${FRAME_VERSION}`,
  dependencies: [
    { id: 'frame-identity', version: `^${FRAME_VERSION}` },
    { id: 'frame-jobs', version: `^${FRAME_VERSION}` },
  ],
  permissions: notificationsPermissions,
  server: { routes: notificationsServerRoutes },
  worker: {
    jobs: ['notification.email.deliver'],
    subscriptions: ['auth.password_changed'],
  },
  migrations: {
    sourceId: 'frame-notifications',
    migrations: [{ id: '0001_notifications.sql' }],
  },
  admin: frameNotificationsAdminManifest,
} as const satisfies ExtensionManifest;
