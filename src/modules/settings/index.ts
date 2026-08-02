import type { AppModule } from '../types.js';
import { settingParamsSchema, updateSettingSchema } from './schemas.js';
import { SettingsService } from './service.js';

export const settingsModule: AppModule = {
  name: 'settings',
  register(app) {
    const service = new SettingsService(app.db);
    app.get(
      '/api/system/settings',
      { preHandler: app.requirePermission('system.settings.read') },
      async () => ({ items: await service.list() }),
    );
    app.get(
      '/api/system/settings/:settingKey/history',
      { preHandler: app.requirePermission('system.settings.read') },
      async (request) => {
        const { settingKey } = settingParamsSchema.parse(request.params);
        return { items: await service.history(settingKey) };
      },
    );
    app.patch(
      '/api/system/settings/:settingKey',
      { preHandler: app.requirePermission('system.settings.write') },
      async (request) => {
        const { settingKey } = settingParamsSchema.parse(request.params);
        const input = updateSettingSchema.parse(request.body);
        return {
          setting: await service.update(
            settingKey,
            input.value,
            input.reason,
            request.auth!.accountId,
          ),
        };
      },
    );
  },
};
