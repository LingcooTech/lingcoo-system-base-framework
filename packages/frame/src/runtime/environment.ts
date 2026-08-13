import type { DefinedSystem } from '@lingcootech/frame-extension-sdk';
import {
  createSystemEnvironmentRegistry as createKernelEnvironmentRegistry,
  readSystemEnvironmentSensitiveValues,
  SystemEnvironmentRegistry,
  type SystemEnvironmentDescriptor,
  type SystemEnvironmentRegistration,
  type SystemEnvironmentVariableDescriptor,
} from '@lingcootech/frame-kernel';

import type { AppEnv } from '../host/env.js';
import { readEnvironmentSource } from '../host/environment-source.js';

export {
  readSystemEnvironmentSensitiveValues,
  SystemEnvironmentRegistry,
  type SystemEnvironmentDescriptor,
  type SystemEnvironmentRegistration,
  type SystemEnvironmentVariableDescriptor,
};

/** Compatibility adapter from the historical AppEnv object to Kernel input. */
export function createSystemEnvironmentRegistry(
  system: DefinedSystem,
  env: AppEnv,
): SystemEnvironmentRegistry {
  return createKernelEnvironmentRegistry({
    system,
    source: readEnvironmentSource(env),
    nodeEnv: env.NODE_ENV,
  });
}
