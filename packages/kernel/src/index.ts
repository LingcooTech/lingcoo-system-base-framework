export {
  createSystemServerCapabilityRegistry,
  ServerCapabilityRegistry,
  type ServerCapabilityDescriptor,
  type ServerCapabilityRegistration,
} from './capabilities.js';
export {
  assertSystemCompatibility,
  registerSystemServerExtensions,
  type ServerExtensionHost,
} from './extensions.js';
export {
  createSystemEnvironmentRegistry,
  readSystemEnvironmentSensitiveValues,
  SystemEnvironmentRegistry,
  type SystemEnvironmentDescriptor,
  type SystemEnvironmentRegistration,
  type SystemEnvironmentVariableDescriptor,
} from './environment.js';
export { collectSystemMigrationSources } from './migrations.js';
export { frameKernelSystem } from './system.js';
export * from './ports/index.js';
