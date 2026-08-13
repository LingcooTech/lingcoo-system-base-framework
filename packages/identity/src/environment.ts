import type { ExtensionEnvironmentVariableDeclaration } from '@lingcootech/frame-extension-sdk';
import { defineEnvironmentExtension } from '@lingcootech/frame-extension-sdk/environment';
import { z } from 'zod';

export const LEGACY_IDENTITY_ENVIRONMENT_ID = 'frame';
export const DEFAULT_IDENTITY_ENVIRONMENT_ID = 'frame-identity';

export const defaultIdentityEnvironmentVariables = [
  { name: 'AUTH_JWT_SECRET', sensitive: true },
  { name: 'AUTH_COOKIE_NAME' },
  { name: 'AUTH_SESSION_TTL_HOURS' },
  { name: 'AUTH_BOOTSTRAP_EMAIL' },
  { name: 'AUTH_BOOTSTRAP_PASSWORD', sensitive: true },
  { name: 'AUTH_BOOTSTRAP_DISPLAY_NAME' },
] as const satisfies readonly ExtensionEnvironmentVariableDeclaration[];

const optionalString = <TSchema extends z.ZodType<string>>(schema: TSchema) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const defaultIdentityEnvironmentSchema = z
  .object({
    AUTH_JWT_SECRET: optionalString(z.string().min(32)),
    AUTH_COOKIE_NAME: z.string().min(1).default('lingcoo_frame_session'),
    AUTH_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(168),
    AUTH_BOOTSTRAP_EMAIL: optionalString(z.email()),
    AUTH_BOOTSTRAP_PASSWORD: optionalString(z.string().min(12).max(128)),
    AUTH_BOOTSTRAP_DISPLAY_NAME: z.string().min(1).max(120).default('系统所有者'),
  })
  .superRefine((environment, context) => {
    if (
      Boolean(environment.AUTH_BOOTSTRAP_EMAIL) !== Boolean(environment.AUTH_BOOTSTRAP_PASSWORD)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_BOOTSTRAP_EMAIL'],
        message: 'Bootstrap email and password must be provided together',
      });
    }
  });

export type DefaultIdentityEnvironment = z.infer<typeof defaultIdentityEnvironmentSchema> & {
  NODE_ENV: 'development' | 'test' | 'production';
};

export const defaultIdentityEnvironment = defineEnvironmentExtension<DefaultIdentityEnvironment>({
  variables: defaultIdentityEnvironmentVariables.map((variable) => variable.name),
  parse(source, context) {
    return {
      ...defaultIdentityEnvironmentSchema.parse(source),
      NODE_ENV: context.nodeEnv,
    };
  },
});
