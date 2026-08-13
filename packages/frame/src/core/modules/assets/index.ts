import type { AppModule } from '../types.js';
import { registerAssetsRoutes } from '@lingcootech/frame-assets/server';
import { createLegacyAssetsPorts } from '../../../integrations/assets/ports.js';

export const assetsModule: AppModule = {
  name: 'assets',
  register(app) {
    registerAssetsRoutes(app, { ports: createLegacyAssetsPorts(app.db, app.appEnv) });
  },
};
