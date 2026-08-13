import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const publicPackageDirectories = Object.freeze([
  'packages/design-tokens',
  'packages/ui',
  'packages/extension-sdk',
  'packages/kernel',
  'packages/database',
  'packages/audit',
  'packages/fastify',
  'packages/opentelemetry',
  'packages/admin-shell',
  'packages/web-shell',
  'packages/identity',
  'packages/integrations',
  'packages/assets',
  'packages/presentation',
  'packages/mail-nodemailer',
  'packages/storage-qiniu',
  'packages/ai-openrouter',
  'packages/payments',
  'packages/jobs',
  'packages/notifications',
  'packages/cms',
  'packages/frame',
  'packages/create-frame-app',
]);

export const runtimePackageDirectories = Object.freeze(
  publicPackageDirectories.filter((directory) => directory !== 'packages/create-frame-app'),
);
