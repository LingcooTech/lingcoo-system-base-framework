import type { ExtensionEnvironmentVariableDeclaration } from '@lingcootech/frame-extension-sdk';
import { defineEnvironmentExtension } from '@lingcootech/frame-extension-sdk/environment';
import { z } from 'zod';

export const DEFAULT_INTEGRATIONS_ENVIRONMENT_ID = 'frame-integrations';
export const LEGACY_INTEGRATIONS_ENVIRONMENT_ID = 'frame';
export const integrationsEnvironmentVariables = [
  { name: 'SETTINGS_ENCRYPTION_KEY', sensitive: true },
] as const satisfies readonly ExtensionEnvironmentVariableDeclaration[];

const schema = z.object({
  SETTINGS_ENCRYPTION_KEY: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(32).optional(),
  ),
});

export type IntegrationsEnvironment = z.infer<typeof schema>;

export const integrationsEnvironment = defineEnvironmentExtension<IntegrationsEnvironment>({
  variables: integrationsEnvironmentVariables.map((variable) => variable.name),
  parse(source) {
    return schema.parse(source);
  },
});
