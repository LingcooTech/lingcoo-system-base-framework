import type { AppModule } from '../types.js';
// Public-site infrastructure is provided by the host registry. Presentation owns
// the public robots and sitemap routes and is installed explicitly.

export const publicSiteModule: AppModule = {
  name: 'public-site',
  register() {},
};
