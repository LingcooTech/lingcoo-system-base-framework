import { FRAME_VERSION, type ExtensionManifest } from '@lingcootech/frame-extension-sdk';
import { frameJobsAdminManifest } from '@lingcootech/frame-admin/manifest';

export const jobsPermissions = ['jobs.read', 'jobs.write'] as const;

export const jobsServerRoutes = [
  { method: 'GET', path: '/api/jobs' },
  { method: 'GET', path: '/api/jobs/summary' },
  { method: 'POST', path: '/api/jobs/:jobId/retry' },
  { method: 'POST', path: '/api/jobs/:jobId/cancel' },
  { method: 'GET', path: '/api/jobs/outbox' },
] as const;

export const frameJobsManifest = {
  id: 'frame-jobs',
  version: FRAME_VERSION,
  apiVersion: '1',
  frame: `^${FRAME_VERSION}`,
  dependencies: [{ id: 'frame-identity', version: `^${FRAME_VERSION}` }],
  permissions: jobsPermissions,
  server: { routes: jobsServerRoutes },
  migrations: { sourceId: 'frame-jobs', migrations: [{ id: '0001_jobs.sql' }] },
  admin: frameJobsAdminManifest,
} as const satisfies ExtensionManifest;
