import { createPresentationExtension } from '@lingcootech/frame-presentation';
import { createLegacyPresentationPorts } from './ports.js';
import { createLegacyAssetsPorts } from '../assets/ports.js';
export const framePresentationExtension = createPresentationExtension({
  ports: (app) =>
    createLegacyPresentationPorts(app.db, createLegacyAssetsPorts(app.db, app.appEnv).references),
});
