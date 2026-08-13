import assert from 'node:assert/strict';
import test from 'node:test';

import { OpenRouterProvider } from '../src/index.js';

test('OpenRouter adapter lists models and captures chat usage', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) =>
    String(input).endsWith('/models')
      ? Response.json({ data: [{ id: 'openai/test-model', name: 'Test Model' }] })
      : Response.json({
          id: 'generation-1',
          model: 'openai/test-model',
          choices: [{ message: { content: '连接正常' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
        });
  try {
    const provider = new OpenRouterProvider();
    const config = { baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'openai/test-model' };
    const credentials = { apiKey: 'sk-or-v1-test-key' };
    const tested = await provider.testConnection({
      config,
      credentials,
      signal: AbortSignal.timeout(1000),
    });
    const chat = await provider.chat(
      config,
      credentials,
      { messages: [{ role: 'user', content: 'test' }] },
      AbortSignal.timeout(1000),
    );
    assert.match(tested.message, /默认模型/);
    assert.equal(chat.content, '连接正常');
    assert.equal(chat.usage?.totalTokens, 6);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
