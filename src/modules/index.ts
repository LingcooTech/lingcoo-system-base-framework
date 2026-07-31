import { accessModule } from './access/index.js';
import { authModule } from './auth/index.js';
import { systemModule } from './system/index.js';
import type { AppModule } from './types.js';

export const appModules: AppModule[] = [systemModule, authModule, accessModule];
