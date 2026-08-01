import { httpError } from '../../../lib/http-error.js';
import type { IntegrationProvider, ProviderTestContext } from '../provider.js';

export interface OpenRouterSettings {
  baseUrl: string;
  siteUrl: string;
  siteName: string;
  defaultModel: string;
  apiKey: string;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  contextLength: number | null;
  promptPrice: string | null;
  completionPrice: string | null;
}

export interface OpenRouterChatInput {
  model?: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
}

export interface OpenRouterChatResult {
  id: string;
  model: string;
  content: string;
  finishReason: string | null;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
}

function parseSettings(
  config: Record<string, unknown>,
  credentials: Record<string, unknown>,
): OpenRouterSettings {
  const settings = {
    baseUrl: String(config.baseUrl ?? 'https://openrouter.ai/api/v1')
      .trim()
      .replace(/\/+$/, ''),
    siteUrl: String(config.siteUrl ?? '').trim(),
    siteName: String(config.siteName ?? 'Lingcoo Frame').trim(),
    defaultModel: String(config.defaultModel ?? '').trim(),
    apiKey: String(credentials.apiKey ?? '').trim(),
  };
  const baseUrl = new URL(settings.baseUrl);
  if (baseUrl.protocol !== 'https:' || baseUrl.hostname !== 'openrouter.ai') {
    throw httpError(
      422,
      'OpenRouter 服务地址必须使用 openrouter.ai 的 HTTPS 地址',
      'ValidationError',
    );
  }
  if (settings.siteUrl) {
    const siteUrl = new URL(settings.siteUrl);
    if (siteUrl.protocol !== 'https:') {
      throw httpError(422, '站点地址必须使用 HTTPS', 'ValidationError');
    }
  }
  if (!settings.apiKey.startsWith('sk-or-')) {
    throw httpError(422, 'OpenRouter API Key 格式无效', 'ValidationError');
  }
  return settings;
}

async function openRouterRequest<T>(
  settings: OpenRouterSettings,
  pathname: string,
  signal: AbortSignal,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${settings.baseUrl}${pathname}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
      ...(settings.siteUrl ? { 'HTTP-Referer': settings.siteUrl } : {}),
      ...(settings.siteName ? { 'X-Title': settings.siteName } : {}),
      ...init?.headers,
    },
    signal,
  });
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string } | string;
  };
  if (!response.ok) {
    const detail = typeof payload.error === 'string' ? payload.error : payload.error?.message;
    throw new Error(`OpenRouter 请求失败 (${response.status})：${detail ?? '未知错误'}`);
  }
  return payload;
}

export class OpenRouterProvider implements IntegrationProvider {
  readonly code = 'openrouter';
  readonly name = 'OpenRouter AI Hub';
  readonly category = 'ai' as const;
  readonly description = '统一访问 OpenRouter 模型目录、聊天补全和用量数据。';
  readonly adapterVersion = '1.0.0';
  readonly capabilities = ['model.list', 'chat.complete', 'usage.capture', 'connection.test'];
  readonly configFields = [
    {
      key: 'baseUrl',
      label: 'API 地址',
      type: 'url' as const,
      required: true,
      defaultValue: 'https://openrouter.ai/api/v1',
    },
    {
      key: 'siteUrl',
      label: '站点地址',
      type: 'url' as const,
      placeholder: 'https://frame.example.com',
      description: '作为 OpenRouter 请求来源标识。',
    },
    {
      key: 'siteName',
      label: '站点名称',
      type: 'text' as const,
      required: true,
      defaultValue: 'Lingcoo Frame',
    },
    {
      key: 'defaultModel',
      label: '默认模型',
      type: 'text' as const,
      required: true,
      placeholder: 'openai/gpt-4.1-mini',
    },
  ];
  readonly credentialFields = [
    {
      key: 'apiKey',
      label: 'OpenRouter API Key',
      type: 'password' as const,
      required: true,
      placeholder: 'sk-or-v1-…',
      description: '加密保存且永不通过 API 回传。',
    },
  ];

  async testConnection({ config, credentials, signal }: ProviderTestContext) {
    const settings = parseSettings(config, credentials);
    const models = await this.listModels(config, credentials, signal);
    const defaultModelExists = models.some((model) => model.id === settings.defaultModel);
    if (!defaultModelExists)
      throw new Error(`默认模型不存在或当前账号不可用：${settings.defaultModel}`);
    return {
      message: `OpenRouter 凭据有效，默认模型 ${settings.defaultModel} 可用`,
      metadata: { modelCount: models.length, defaultModel: settings.defaultModel },
    };
  }

  async listModels(
    config: Record<string, unknown>,
    credentials: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<OpenRouterModel[]> {
    const settings = parseSettings(config, credentials);
    const payload = await openRouterRequest<{
      data?: Array<{
        id?: string;
        name?: string;
        context_length?: number;
        pricing?: { prompt?: string; completion?: string };
      }>;
    }>(settings, '/models', signal);
    return (payload.data ?? []).flatMap((model) =>
      model.id
        ? [
            {
              id: model.id,
              name: model.name ?? model.id,
              contextLength: model.context_length ?? null,
              promptPrice: model.pricing?.prompt ?? null,
              completionPrice: model.pricing?.completion ?? null,
            },
          ]
        : [],
    );
  }

  async chat(
    config: Record<string, unknown>,
    credentials: Record<string, unknown>,
    input: OpenRouterChatInput,
    signal: AbortSignal,
  ): Promise<OpenRouterChatResult> {
    const settings = parseSettings(config, credentials);
    const model = input.model?.trim() || settings.defaultModel;
    const payload = await openRouterRequest<{
      id?: string;
      model?: string;
      choices?: Array<{
        message?: { content?: string };
        finish_reason?: string;
      }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    }>(settings, '/chat/completions', signal, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: input.messages,
        ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
        ...(input.maxTokens !== undefined ? { max_tokens: input.maxTokens } : {}),
      }),
    });
    const choice = payload.choices?.[0];
    if (!choice?.message || typeof choice.message.content !== 'string') {
      throw new Error('OpenRouter 返回内容为空');
    }
    return {
      id: payload.id ?? '',
      model: payload.model ?? model,
      content: choice.message.content,
      finishReason: choice.finish_reason ?? null,
      usage: payload.usage
        ? {
            promptTokens: payload.usage.prompt_tokens ?? 0,
            completionTokens: payload.usage.completion_tokens ?? 0,
            totalTokens: payload.usage.total_tokens ?? 0,
          }
        : null,
    };
  }
}
