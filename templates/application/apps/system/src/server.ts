import { fileURLToPath } from 'node:url';

import { buildApp, loadEnv } from '@lingcootech/frame';

import { applicationSystem } from './system.js';

const env = loadEnv();
const app = await buildApp(env, {
  system: applicationSystem,
  staticAssets: {
    adminDirectory: fileURLToPath(new URL('../../admin/dist/', import.meta.url)),
    // <web>
    publicDirectory: fileURLToPath(new URL('../../web/dist/', import.meta.url)),
    // </web>
  },
});

try {
  await app.listen({ host: env.API_HOST, port: env.API_PORT });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
