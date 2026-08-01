import { httpError } from '../../../lib/http-error.js';
import type { IntegrationService } from '../service.js';
import { OpenRouterProvider, type OpenRouterChatInput } from './openrouter.js';

export class OpenRouterService {
  constructor(private readonly integrations: IntegrationService) {}

  listModels(connectionId: string, actorId?: string) {
    return this.integrations.executeConnection({
      connectionId,
      providerCode: 'openrouter',
      operation: 'openrouter.model.list',
      actorId,
      execute: async ({ provider, config, credentials, signal }) => {
        if (!(provider instanceof OpenRouterProvider)) {
          throw httpError(500, 'OpenRouter Provider 注册无效', 'ConfigurationError');
        }
        const value = await provider.listModels(config, credentials, signal);
        return {
          value,
          message: `OpenRouter 返回 ${value.length} 个模型`,
          metadata: { count: value.length },
        };
      },
    });
  }

  chat(connectionId: string, input: OpenRouterChatInput, actorId?: string) {
    return this.integrations.executeConnection({
      connectionId,
      providerCode: 'openrouter',
      operation: 'openrouter.chat.complete',
      actorId,
      execute: async ({ provider, config, credentials, signal }) => {
        if (!(provider instanceof OpenRouterProvider)) {
          throw httpError(500, 'OpenRouter Provider 注册无效', 'ConfigurationError');
        }
        const value = await provider.chat(config, credentials, input, signal);
        return {
          value,
          message: `OpenRouter 模型 ${value.model} 已完成响应`,
          metadata: { model: value.model, finishReason: value.finishReason, usage: value.usage },
        };
      },
    });
  }
}
