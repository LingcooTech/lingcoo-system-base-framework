import assert from 'node:assert/strict';
import test from 'node:test';

import { exampleExtension } from '@lingcootech/frame-example-extension';
import {
  defineExtension,
  defineSystem,
  FRAME_VERSION,
  projectExtensionManifest,
  type ExtensionManifest,
} from '@lingcootech/frame-extension-sdk';
import { defineEnvironmentExtension } from '@lingcootech/frame-extension-sdk/environment';
import { defineServerExtension } from '@lingcootech/frame-extension-sdk/server';

import {
  frameCoreExtension,
  frameCoreSystem,
  frameIdentityExtension,
  frameKernelExtension,
} from '../src/core/extension.js';
import { buildApp } from '../src/host/app.js';
import { loadEnv } from '../src/host/env.js';
import {
  SECURITY_PROVIDER_CAPABILITY,
  SECURITY_PROVIDER_CAPABILITY_VERSION,
  type SecurityProvider,
} from '../src/host/security.js';
import {
  collectSystemMigrationSources,
  createSystemServerCapabilityRegistry,
} from '../src/runtime/extensions.js';
import {
  createSystemEnvironmentRegistry,
  readSystemEnvironmentSensitiveValues,
} from '../src/runtime/environment.js';
import { createFrameWorker } from '../src/runtime/worker.js';
import { frameKernelSystem } from '../src/kernel/system.js';

function testEnv() {
  return loadEnv({
    NODE_ENV: 'test',
    APP_NAME: 'frame-extension-test',
    APP_VERSION: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgres://frame:frame@127.0.0.1:1/frame_extension_test',
    AUTH_JWT_SECRET: 'frame-extension-test-secret-at-least-32-characters',
  });
}

function extension(id: string, contributions: Partial<ExtensionManifest> = {}) {
  return defineExtension({
    manifest: {
      id,
      version: '1.0.0',
      apiVersion: '1',
      frame: '^0.7.0',
      ...contributions,
    },
  });
}

function systemWith(...extensions: ReturnType<typeof extension>[]) {
  return defineSystem({ id: 'conflict-test', version: '1.0.0', extensions });
}

test('defineSystem sorts dependencies and permits event fan-out', () => {
  const foundation = extension('foundation', {
    worker: { subscriptions: ['shared.created'] },
  });
  const domain = extension('domain', {
    dependencies: [{ id: 'foundation', version: '^1.0.0' }],
    worker: { subscriptions: ['shared.created'] },
  });
  const system = systemWith(domain, foundation);
  assert.deepEqual(
    system.extensions.map((item) => item.manifest.id),
    ['foundation', 'domain'],
  );
});

test('default Frame preset composes Kernel and Feature extensions explicitly', () => {
  assert.deepEqual(frameKernelSystem.extensions, []);
  assert.deepEqual(
    frameCoreSystem.extensions.map((item) => item.manifest.id),
    [
      'frame',
      'frame-identity',
      'frame-integrations',
      'frame-jobs',
      'frame-assets',
      'frame-presentation',
      'frame-notifications',
    ],
  );
  assert.equal(frameKernelExtension.manifest.capabilities?.server, undefined);
  assert.equal(frameKernelExtension.manifest.environment, undefined);
  assert.equal(
    frameIdentityExtension.manifest.capabilities?.server?.provides?.[0]?.id,
    SECURITY_PROVIDER_CAPABILITY,
  );
});

test('defineSystem resolves versioned capabilities per runtime surface', () => {
  const audit = extension('audit-provider', {
    capabilities: {
      server: { provides: [{ id: 'audit.write', version: '1.1.0' }] },
      worker: { provides: [{ id: 'audit.write', version: '2.0.0' }] },
    },
  });
  const domain = extension('domain', {
    capabilities: {
      server: { requires: [{ id: 'audit.write', version: '^1.0.0' }] },
    },
  });
  const explicitConsumer = extension('explicit-consumer', {
    dependencies: [{ id: 'audit-provider', version: '^1.0.0' }],
    capabilities: {
      server: { requires: [{ id: 'audit.write', version: '^1.0.0' }] },
    },
  });

  const system = systemWith(domain, explicitConsumer, audit);
  assert.deepEqual(
    system.extensions.map((item) => item.manifest.id),
    ['audit-provider', 'domain', 'explicit-consumer'],
  );
});

test('projectExtensionManifest keeps only capabilities for selected surfaces', () => {
  const manifest = extension('projection', {
    capabilities: {
      server: { provides: [{ id: 'projection.server', version: '1.0.0' }] },
      admin: { requires: [{ id: 'projection.admin', version: '^1.0.0' }] },
      web: { provides: [{ id: 'projection.web', version: '1.0.0' }] },
    },
    environment: { variables: [{ name: 'PROJECTION_TOKEN', sensitive: true }] },
  }).manifest;

  const adminProjection = projectExtensionManifest(manifest, ['admin']);
  assert.deepEqual(adminProjection.capabilities, {
    admin: { requires: [{ id: 'projection.admin', version: '^1.0.0' }] },
  });
  assert.equal(adminProjection.environment, undefined);
  assert.deepEqual(projectExtensionManifest(manifest, ['server']).environment, {
    variables: [{ name: 'PROJECTION_TOKEN', sensitive: true }],
  });
});

test('System environment registry scopes and parses installed extension variables', () => {
  let visibleSourceKeys: string[] = [];
  const configured = defineExtension({
    manifest: {
      id: 'configured',
      version: '1.0.0',
      apiVersion: '1',
      frame: '^0.7.0',
      environment: {
        variables: [{ name: 'FEATURE_LABEL' }, { name: 'FEATURE_SECRET', sensitive: true }],
      },
    },
    environment: defineEnvironmentExtension({
      variables: ['FEATURE_LABEL', 'FEATURE_SECRET'],
      parse(source, context) {
        visibleSourceKeys = Object.keys(source);
        return {
          label: source.FEATURE_LABEL ?? 'default',
          secret: source.FEATURE_SECRET,
          nodeEnv: context.nodeEnv,
        };
      },
    }),
  });
  const system = defineSystem({
    id: 'environment-registry-system',
    version: '1.0.0',
    extensions: [configured],
  });
  const env = loadEnv({
    NODE_ENV: 'test',
    FEATURE_LABEL: 'enabled',
    FEATURE_SECRET: 'do-not-expose',
    UNDECLARED_VALUE: 'hidden',
  });

  const registry = createSystemEnvironmentRegistry(system, env);
  assert.deepEqual(visibleSourceKeys, ['FEATURE_LABEL', 'FEATURE_SECRET']);
  assert.deepEqual(registry.require('configured'), {
    label: 'enabled',
    secret: 'do-not-expose',
    nodeEnv: 'test',
  });
  assert.equal(registry.get('not-installed'), undefined);
  assert.deepEqual(readSystemEnvironmentSensitiveValues(registry), ['do-not-expose']);
  assert.deepEqual(registry.describe(), [
    {
      extensionId: 'configured',
      variables: [
        { name: 'FEATURE_LABEL', sensitive: false },
        { name: 'FEATURE_SECRET', sensitive: true },
      ],
    },
  ]);
});

test('System environment registry rejects manifest and parser drift', () => {
  const cases = [
    {
      name: 'missing surface',
      extension: extension('missing-environment', {
        environment: { variables: [{ name: 'MISSING_VALUE' }] },
      }),
      error: /declares environment variables without a surface/,
    },
    {
      name: 'undeclared surface',
      extension: defineExtension({
        manifest: {
          id: 'undeclared-environment',
          version: '1.0.0',
          apiVersion: '1',
          frame: '^0.7.0',
        },
        environment: defineEnvironmentExtension({ variables: [], parse: () => ({}) }),
      }),
      error: /registered an undeclared environment surface/,
    },
    {
      name: 'undeclared variable',
      extension: defineExtension({
        manifest: {
          id: 'undeclared-environment-variable',
          version: '1.0.0',
          apiVersion: '1',
          frame: '^0.7.0',
          environment: { variables: [{ name: 'DECLARED_VALUE' }] },
        },
        environment: defineEnvironmentExtension({
          variables: ['DECLARED_VALUE', 'EXTRA_VALUE'],
          parse: () => ({}),
        }),
      }),
      error: /registered undeclared environment variable EXTRA_VALUE/,
    },
    {
      name: 'missing variable',
      extension: defineExtension({
        manifest: {
          id: 'missing-environment-variable',
          version: '1.0.0',
          apiVersion: '1',
          frame: '^0.7.0',
          environment: {
            variables: [{ name: 'FIRST_VALUE' }, { name: 'SECOND_VALUE' }],
          },
        },
        environment: defineEnvironmentExtension({
          variables: ['FIRST_VALUE'],
          parse: () => ({}),
        }),
      }),
      error: /did not register environment variable SECOND_VALUE/,
    },
  ];
  const env = loadEnv({ NODE_ENV: 'test' });

  for (const item of cases) {
    const system = defineSystem({
      id: `${item.name.replaceAll(' ', '-')}-system`,
      version: '1.0.0',
      extensions: [item.extension],
    });
    assert.throws(() => createSystemEnvironmentRegistry(system, env), item.error, item.name);
  }
});

test('Server capability registry binds manifest providers to runtime implementations', () => {
  const auditService = {
    write(message: string) {
      return `audit:${message}`;
    },
  };
  const provider = defineExtension({
    manifest: {
      id: 'audit-provider',
      version: '1.0.0',
      apiVersion: '1',
      frame: '^0.7.0',
      capabilities: {
        server: { provides: [{ id: 'audit.write', version: '1.2.0' }] },
      },
    },
    server: defineServerExtension({
      capabilities: [{ id: 'audit.write', value: auditService }],
      register() {},
    }),
  });
  const consumer = extension('audit-consumer', {
    capabilities: {
      server: { requires: [{ id: 'audit.write', version: '^1.0.0' }] },
    },
  });
  const system = defineSystem({
    id: 'runtime-capability-test',
    version: '1.0.0',
    extensions: [consumer, provider],
  });

  const registry = createSystemServerCapabilityRegistry(system);
  assert.equal(registry.require<typeof auditService>('audit.write'), auditService);
  assert.equal(registry.get<typeof auditService>('audit.write')?.write('saved'), 'audit:saved');
  assert.equal(registry.get('missing'), undefined);
  assert.deepEqual(registry.describe(), [
    { id: 'audit.write', version: '1.2.0', extensionId: 'audit-provider' },
  ]);
});

test('Server capability registry rejects declaration and implementation drift', () => {
  const cases = [
    {
      name: 'missing implementation',
      extension: defineExtension({
        manifest: {
          id: 'missing-implementation',
          version: '1.0.0',
          apiVersion: '1',
          frame: '^0.7.0',
          capabilities: {
            server: { provides: [{ id: 'service.missing', version: '1.0.0' }] },
          },
        },
      }),
      error: /did not register Server capability service\.missing/,
    },
    {
      name: 'undeclared implementation',
      extension: defineExtension({
        manifest: {
          id: 'undeclared-implementation',
          version: '1.0.0',
          apiVersion: '1',
          frame: '^0.7.0',
        },
        server: defineServerExtension({
          capabilities: [{ id: 'service.undeclared', value: {} }],
          register() {},
        }),
      }),
      error: /registered undeclared Server capability service\.undeclared/,
    },
    {
      name: 'duplicate implementation',
      extension: defineExtension({
        manifest: {
          id: 'duplicate-implementation',
          version: '1.0.0',
          apiVersion: '1',
          frame: '^0.7.0',
          capabilities: {
            server: { provides: [{ id: 'service.duplicate', version: '1.0.0' }] },
          },
        },
        server: defineServerExtension({
          capabilities: [
            { id: 'service.duplicate', value: { source: 'first' } },
            { id: 'service.duplicate', value: { source: 'second' } },
          ],
          register() {},
        }),
      }),
      error: /registered Server capability service\.duplicate more than once/,
    },
    {
      name: 'undefined implementation',
      extension: defineExtension({
        manifest: {
          id: 'undefined-implementation',
          version: '1.0.0',
          apiVersion: '1',
          frame: '^0.7.0',
          capabilities: {
            server: { provides: [{ id: 'service.undefined', version: '1.0.0' }] },
          },
        },
        server: defineServerExtension({
          capabilities: [{ id: 'service.undefined', value: undefined }],
          register() {},
        }),
      }),
      error: /registered Server capability service\.undefined without an implementation/,
    },
  ];

  for (const item of cases) {
    const system = defineSystem({
      id: `${item.name.replaceAll(' ', '-')}-system`,
      version: '1.0.0',
      extensions: [item.extension],
    });
    assert.throws(() => createSystemServerCapabilityRegistry(system), item.error, item.name);
  }
});

test('defineSystem rejects invalid dependency graphs and contribution conflicts', () => {
  const cases: Array<{ name: string; extensions: ReturnType<typeof extension>[]; error: RegExp }> =
    [
      {
        name: 'duplicate extension',
        extensions: [extension('duplicate'), extension('duplicate')],
        error: /Duplicate extension id/,
      },
      {
        name: 'missing dependency',
        extensions: [
          extension('consumer', { dependencies: [{ id: 'missing', version: '^1.0.0' }] }),
        ],
        error: /missing dependency missing/,
      },
      {
        name: 'dependency version',
        extensions: [
          extension('foundation'),
          extension('consumer', { dependencies: [{ id: 'foundation', version: '^2.0.0' }] }),
        ],
        error: /requires foundation/,
      },
      {
        name: 'dependency cycle',
        extensions: [
          extension('alpha', { dependencies: [{ id: 'beta', version: '*' }] }),
          extension('beta', { dependencies: [{ id: 'alpha', version: '*' }] }),
        ],
        error: /dependency cycle/,
      },
      {
        name: 'duplicate capability provider',
        extensions: [
          extension('alpha', {
            capabilities: {
              server: { provides: [{ id: 'audit.write', version: '1.0.0' }] },
            },
          }),
          extension('beta', {
            capabilities: {
              server: { provides: [{ id: 'audit.write', version: '1.1.0' }] },
            },
          }),
        ],
        error: /Duplicate server capability audit\.write provided by alpha and beta/,
      },
      {
        name: 'missing capability',
        extensions: [
          extension('consumer', {
            capabilities: {
              server: { requires: [{ id: 'audit.write', version: '^1.0.0' }] },
            },
          }),
        ],
        error: /missing server capability audit\.write/,
      },
      {
        name: 'capability version',
        extensions: [
          extension('provider', {
            capabilities: {
              server: { provides: [{ id: 'audit.write', version: '1.0.0' }] },
            },
          }),
          extension('consumer', {
            capabilities: {
              server: { requires: [{ id: 'audit.write', version: '^2.0.0' }] },
            },
          }),
        ],
        error: /requires server capability audit\.write \^2\.0\.0/,
      },
      {
        name: 'capability cycle',
        extensions: [
          extension('alpha', {
            capabilities: {
              server: {
                provides: [{ id: 'alpha.service', version: '1.0.0' }],
                requires: [{ id: 'beta.service', version: '^1.0.0' }],
              },
            },
          }),
          extension('beta', {
            capabilities: {
              server: {
                provides: [{ id: 'beta.service', version: '1.0.0' }],
                requires: [{ id: 'alpha.service', version: '^1.0.0' }],
              },
            },
          }),
        ],
        error: /dependency cycle/,
      },
      {
        name: 'Frame compatibility',
        extensions: [extension('future', { frame: '^1.0.0' })],
        error: /requires Frame/,
      },
      {
        name: 'permission',
        extensions: [
          extension('alpha', { permissions: ['shared.read'] }),
          extension('beta', { permissions: ['shared.read'] }),
        ],
        error: /Duplicate permission/,
      },
      {
        name: 'setting',
        extensions: [
          extension('alpha', { settings: ['shared.label'] }),
          extension('beta', { settings: ['shared.label'] }),
        ],
        error: /Duplicate setting/,
      },
      {
        name: 'environment variable',
        extensions: [
          extension('alpha', { environment: { variables: [{ name: 'SHARED_VALUE' }] } }),
          extension('beta', { environment: { variables: [{ name: 'SHARED_VALUE' }] } }),
        ],
        error: /Duplicate environment variable SHARED_VALUE declared by alpha and beta/,
      },
      {
        name: 'invalid environment variable',
        extensions: [
          extension('alpha', { environment: { variables: [{ name: 'invalid_value' }] } }),
        ],
        error: /Invalid environment variable in alpha: invalid_value/,
      },
      {
        name: 'duplicate local environment variable',
        extensions: [
          extension('alpha', {
            environment: {
              variables: [{ name: 'DUPLICATE_VALUE' }, { name: 'DUPLICATE_VALUE' }],
            },
          }),
        ],
        error: /Duplicate environment variable DUPLICATE_VALUE in extension alpha/,
      },
      {
        name: 'route',
        extensions: [
          extension('alpha', { server: { routes: [{ method: 'GET', path: '/api/shared' }] } }),
          extension('beta', { server: { routes: [{ method: 'GET', path: '/api/shared' }] } }),
        ],
        error: /Duplicate route/,
      },
      {
        name: 'job kind',
        extensions: [
          extension('alpha', { worker: { jobs: ['shared.run'] } }),
          extension('beta', { worker: { jobs: ['shared.run'] } }),
        ],
        error: /Duplicate job kind/,
      },
      {
        name: 'migration source',
        extensions: [
          extension('alpha', {
            migrations: { sourceId: 'shared', migrations: [{ id: '0001_alpha.sql' }] },
          }),
          extension('beta', {
            migrations: { sourceId: 'shared', migrations: [{ id: '0001_beta.sql' }] },
          }),
        ],
        error: /Duplicate migration source/,
      },
      {
        name: 'Legacy Alias',
        extensions: [
          extension('alpha', {
            migrations: {
              sourceId: 'alpha',
              migrations: [{ id: '0001_alpha.sql', legacyAliases: ['0001_legacy.sql'] }],
            },
          }),
          extension('beta', {
            migrations: {
              sourceId: 'beta',
              migrations: [{ id: '0001_beta.sql', legacyAliases: ['0001_legacy.sql'] }],
            },
          }),
        ],
        error: /Duplicate Legacy Alias/,
      },
    ];

  for (const item of cases) {
    assert.throws(() => systemWith(...item.extensions), item.error, item.name);
  }
});

test('the reference extension composes across Server, Worker, settings and migrations', async () => {
  const system = defineSystem({
    id: 'example-system',
    version: '0.1.0',
    extensions: [exampleExtension, frameCoreExtension],
  });
  assert.deepEqual(
    system.extensions.map((item) => item.manifest.id),
    ['frame', 'example'],
  );
  assert.deepEqual(
    collectSystemMigrationSources(system).map((source) => source.id),
    ['frame', 'example'],
  );

  const app = await buildApp(testEnv(), { system });
  const response = await app.inject({ method: 'GET', url: '/api/example' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { extension: 'example', status: 'ok' });
  assert.equal(
    app.settingsRegistry.find('example.greeting')?.defaultValue,
    'Hello from a Frame extension',
  );
  await app.close();

  const worker = createFrameWorker(testEnv(), { system });
  const status = worker.getStatus();
  assert.ok(status.jobKinds.includes('example.echo'));
  assert.ok(status.eventTopics.includes('example.created'));
  assert.deepEqual(status.extensions, ['frame', 'example']);
  await worker.dispose();
});

test('Server extensions can resolve the installed security provider capability', async () => {
  const capabilityConsumer = defineExtension({
    manifest: {
      id: 'security-capability-consumer',
      version: '1.0.0',
      apiVersion: '1',
      frame: '^0.7.0',
      capabilities: {
        server: {
          requires: [{ id: SECURITY_PROVIDER_CAPABILITY, version: '^1.0.0' }],
        },
      },
      server: {
        routes: [{ method: 'GET', path: '/api/security-capability' }],
      },
    },
    server: defineServerExtension({
      register({ app }) {
        const provider = app.capabilities.require<SecurityProvider>(SECURITY_PROVIDER_CAPABILITY);
        app.get('/api/security-capability', async () => ({
          hasInstall: typeof provider.install === 'function',
        }));
      },
    }),
  });
  const system = defineSystem({
    id: 'security-capability-system',
    version: '1.0.0',
    extensions: [capabilityConsumer, frameCoreExtension],
  });

  const app = await buildApp(testEnv(), { system });
  const response = await app.inject({ method: 'GET', url: '/api/security-capability' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { hasInstall: true });
  assert.deepEqual(
    app.capabilities.describe().find((item) => item.id === SECURITY_PROVIDER_CAPABILITY),
    {
      id: SECURITY_PROVIDER_CAPABILITY,
      version: SECURITY_PROVIDER_CAPABILITY_VERSION,
      extensionId: 'frame',
    },
  );
  await app.close();
});

test('Server composition rejects extension routes that collide with Frame core', async () => {
  const collision = defineExtension({
    manifest: {
      id: 'collision',
      version: '1.0.0',
      apiVersion: '1',
      frame: '^0.7.0',
      dependencies: [{ id: 'frame', version: '^0.7.0' }],
      server: { routes: [{ method: 'GET', path: '/health' }] },
    },
    server: defineServerExtension({
      register({ app }) {
        app.get('/health', async () => ({ status: 'collision' }));
      },
    }),
  });
  const system = defineSystem({
    id: 'route-collision-system',
    version: '1.0.0',
    extensions: [frameCoreExtension, collision],
  });
  await assert.rejects(
    () => buildApp(testEnv(), { system }),
    /Extension route conflicts with an installed route: GET \/health/,
  );
});

test('runtime rejects a Defined System compiled for a different Frame version', async () => {
  const compatibleSystem = defineSystem({
    id: 'version-mismatch-system',
    version: '1.0.0',
    extensions: [frameCoreExtension],
  });
  const system = { ...compatibleSystem, frameVersion: '999.0.0' };
  await assert.rejects(() => buildApp(testEnv(), { system }), {
    message: `Defined System targets Frame 999.0.0, but this runtime is ${FRAME_VERSION}`,
  });
});
