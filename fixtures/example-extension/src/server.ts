import { defineServerExtension } from '@lingcoo/frame-extension-sdk/server';
import { z } from 'zod';

export const exampleServerExtension = defineServerExtension({
  settings: [
    {
      key: 'example.greeting',
      group: 'example',
      groupLabel: '示例扩展',
      label: '欢迎语',
      description: '示例扩展返回的公开欢迎语。',
      type: 'text',
      defaultValue: 'Hello from a Frame extension',
      schema: z.string().trim().min(1).max(120),
    },
  ],
  register({ app }) {
    app.get('/api/example', async () => ({
      extension: 'example',
      status: 'ok',
    }));
  },
});
