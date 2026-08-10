import { defineServerExtension } from '@lingcootech/frame-extension-sdk/server';
import { z } from 'zod';

export const domainServerExtension = defineServerExtension({
  settings: [
    {
      key: 'domain.greeting',
      group: 'domain',
      groupLabel: '业务设置',
      label: '欢迎语',
      description: '显示在示例业务接口和页面中的欢迎文本。',
      type: 'text',
      defaultValue: 'Hello from __DISPLAY_NAME__',
      schema: z.string().trim().min(1).max(120),
    },
  ],
  register({ app }) {
    app.get('/api/domain/example', async () => ({ status: 'ok', system: '__SYSTEM_ID__' }));
  },
});
