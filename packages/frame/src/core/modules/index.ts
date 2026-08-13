import { auditModule } from './audit/index.js';
import { dataExchangeModule } from './data-exchange/index.js';
import { assetsModule } from './assets/index.js';
import { integrationsModule } from './integrations/index.js';
import { metadataModule } from './metadata/index.js';
import { observabilityModule } from './observability/index.js';
import { publicSiteModule } from './public-site/index.js';
import { searchModule } from './search/index.js';
import { settingsModule } from './settings/index.js';
import { systemModule } from './system/index.js';
import type { AppModule } from './types.js';

export const appModules: AppModule[] = [
  systemModule,
  settingsModule,
  publicSiteModule,
  auditModule,
  metadataModule,
  dataExchangeModule,
  searchModule,
  observabilityModule,
  integrationsModule,
  assetsModule,
];

export const kernelAppModules: AppModule[] = [
  systemModule,
  settingsModule,
  publicSiteModule,
  auditModule,
  metadataModule,
  dataExchangeModule,
  searchModule,
  observabilityModule,
];
