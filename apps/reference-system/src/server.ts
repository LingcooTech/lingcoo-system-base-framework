import { fileURLToPath } from 'node:url';

import { buildApp, loadEnv } from '@lingcootech/frame';

import { referenceSystem } from './system.js';

const env = loadEnv();
const app = await buildApp(env, {
  system: referenceSystem,
  staticAssets: {
    adminDirectory: fileURLToPath(new URL('../../reference-admin/dist/', import.meta.url)),
    publicDirectory: fileURLToPath(new URL('../../reference-web/dist/', import.meta.url)),
  },
});

try {
  await app.listen({ host: env.API_HOST, port: env.API_PORT });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
