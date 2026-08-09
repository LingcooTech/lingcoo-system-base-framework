import { z } from 'zod';
import type { ServerSettingDefinition } from '@lingcootech/frame-extension-sdk/server';

export type SettingDefinition = ServerSettingDefinition;

const optionalEmail = z.union([z.literal(''), z.email().max(254)]);
const optionalUrl = z.union([z.literal(''), z.url().max(500)]);

export const baseSettingDefinitions: readonly SettingDefinition[] = [
  {
    key: 'general.system_name',
    group: 'general',
    groupLabel: '基础信息',
    label: '系统显示名称',
    description: '用于管理界面和系统通知中的可读名称。',
    type: 'text',
    defaultValue: 'Lingcoo Frame',
    schema: z.string().trim().min(1).max(120),
  },
  {
    key: 'general.public_url',
    group: 'general',
    groupLabel: '基础信息',
    label: '公开访问地址',
    description: '系统面向用户的 HTTPS 根地址；留空表示由部署环境决定。',
    type: 'url',
    defaultValue: '',
    schema: optionalUrl,
  },
  {
    key: 'general.support_email',
    group: 'general',
    groupLabel: '基础信息',
    label: '支持邮箱',
    description: '对外展示的支持联系方式，不包含 SMTP 凭据。',
    type: 'email',
    defaultValue: '',
    schema: optionalEmail,
  },
  {
    key: 'localization.default_locale',
    group: 'localization',
    groupLabel: '区域与语言',
    label: '默认语言',
    description: '新业务模块在没有用户偏好时使用的语言。',
    type: 'select',
    defaultValue: 'zh-CN',
    options: [
      { label: '简体中文', value: 'zh-CN' },
      { label: 'English', value: 'en-US' },
    ],
    schema: z.enum(['zh-CN', 'en-US']),
  },
  {
    key: 'localization.timezone',
    group: 'localization',
    groupLabel: '区域与语言',
    label: '默认时区',
    description: '用于新业务数据的日期展示和计划任务解释。',
    type: 'select',
    defaultValue: 'Asia/Shanghai',
    options: [
      { label: '中国标准时间（上海）', value: 'Asia/Shanghai' },
      { label: '香港时间', value: 'Asia/Hong_Kong' },
      { label: '协调世界时', value: 'UTC' },
    ],
    schema: z.enum(['Asia/Shanghai', 'Asia/Hong_Kong', 'UTC']),
  },
];

export class SettingsRegistry {
  private readonly definitions = new Map<string, SettingDefinition>();

  constructor(definitions: readonly SettingDefinition[] = []) {
    for (const definition of definitions) this.register(definition);
  }

  register(definition: SettingDefinition): void {
    if (this.definitions.has(definition.key)) {
      throw new Error(`Setting already registered: ${definition.key}`);
    }
    this.definitions.set(definition.key, definition);
  }

  find(key: string): SettingDefinition | undefined {
    return this.definitions.get(key);
  }

  list(): readonly SettingDefinition[] {
    return Object.freeze([...this.definitions.values()]);
  }
}

export const defaultSettingsRegistry = new SettingsRegistry(baseSettingDefinitions);
export const settingDefinitions = baseSettingDefinitions;

export function findSettingDefinition(key: string): SettingDefinition | undefined {
  return defaultSettingsRegistry.find(key);
}
