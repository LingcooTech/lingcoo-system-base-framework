import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const publicPackageDirectories = Object.freeze([
  'packages/design-tokens',
  'packages/ui',
  'packages/database',
  'packages/extension-sdk',
  'packages/admin-shell',
  'packages/web-shell',
  'packages/cms',
  'packages/frame',
]);
