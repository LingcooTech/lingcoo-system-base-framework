import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { repositoryRoot } from './package-catalog.mjs';

async function manifest(directory) {
  return JSON.parse(await readFile(path.join(repositoryRoot, directory, 'package.json'), 'utf8'));
}

async function sourceText(directory) {
  const sourceDirectory = path.join(repositoryRoot, directory, 'src');
  const files = await readdir(sourceDirectory, { recursive: true, withFileTypes: true });
  const paths = files
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => path.join(entry.parentPath, entry.name));
  return (await Promise.all(paths.map((file) => readFile(file, 'utf8')))).join('\n');
}

async function fileText(file) {
  return readFile(path.join(repositoryRoot, file), 'utf8');
}

function importsDatabaseSchemaSymbol(source, symbol) {
  return new RegExp(
    `import\\s*\\{[^}]*\\b${symbol}\\b[^}]*\\}\\s*from ['"]@lingcootech/frame-database/schema['"]`,
    's',
  ).test(source);
}

const kernel = await manifest('packages/kernel');
const kernelRuntimeDependencies = {
  ...kernel.dependencies,
  ...kernel.optionalDependencies,
  ...kernel.peerDependencies,
};
for (const forbidden of [
  'fastify',
  'pg',
  'drizzle-orm',
  '@opentelemetry/api',
  '@lingcootech/frame-database',
  '@lingcootech/frame-fastify',
  '@lingcootech/frame-identity',
  '@lingcootech/frame-opentelemetry',
]) {
  assert.equal(
    kernelRuntimeDependencies[forbidden],
    undefined,
    `Kernel must not depend on infrastructure package ${forbidden}`,
  );
}

const kernelSource = await sourceText('packages/kernel');
for (const forbiddenImport of ["from 'fastify'", "from 'pg'", "from 'drizzle-orm'"]) {
  assert.equal(
    kernelSource.includes(forbiddenImport),
    false,
    `Kernel source contains infrastructure import ${forbiddenImport}`,
  );
}

const contracts = await manifest('packages/extension-sdk');
assert.equal(
  contracts.dependencies?.['@lingcootech/frame-database'],
  undefined,
  'Public Contracts must not depend on the PostgreSQL adapter',
);
assert.equal(
  contracts.peerDependencies?.['@lingcootech/frame-database'],
  undefined,
  'Public Contracts must not peer-depend on the PostgreSQL adapter',
);
assert.equal(
  contracts.peerDependencies?.fastify,
  undefined,
  'Public Contracts must not peer-depend on the Fastify adapter',
);

const postgres = await manifest('packages/database');
assert.ok(postgres.dependencies?.['@lingcootech/frame-kernel']);
assert.ok(postgres.dependencies?.pg);

const fastify = await manifest('packages/fastify');
assert.ok(fastify.dependencies?.['@lingcootech/frame-kernel']);
assert.ok(fastify.dependencies?.fastify);

const telemetry = await manifest('packages/opentelemetry');
assert.ok(telemetry.dependencies?.['@lingcootech/frame-kernel']);
assert.ok(telemetry.dependencies?.['@opentelemetry/api']);

const audit = await manifest('packages/audit');
assert.equal(audit.dependencies?.['@lingcootech/frame'], undefined);
assert.ok(audit.dependencies?.['@lingcootech/frame-database']);
assert.ok(audit.dependencies?.['drizzle-orm']);
const auditSource = await sourceText('packages/audit');
assert.equal(auditSource.includes("from '@lingcootech/frame'"), false);
assert.equal(/fastify|AsyncLocalStorage/.test(auditSource), false);

const identity = await manifest('packages/identity');
assert.equal(
  identity.dependencies?.['@lingcootech/frame'],
  undefined,
  'Identity feature must not depend on the legacy Frame aggregate',
);
assert.ok(identity.dependencies?.['@lingcootech/frame-extension-sdk']);
assert.ok(identity.dependencies?.['@lingcootech/frame-fastify']);
assert.ok(identity.dependencies?.['@lingcootech/frame-database']);
assert.ok(identity.dependencies?.['@lingcootech/frame-audit']);
assert.ok(identity.dependencies?.['drizzle-orm']);
assert.equal(
  (await sourceText('packages/identity')).includes("from '@lingcootech/frame'"),
  false,
  'Identity source must not import the legacy Frame aggregate',
);
assert.equal(
  fastify.dependencies?.['@lingcootech/frame-identity'],
  undefined,
  'Fastify adapter must not depend on optional Identity',
);

const jobs = await manifest('packages/jobs');
assert.equal(
  jobs.dependencies?.['@lingcootech/frame'],
  undefined,
  'Jobs feature must not depend on the legacy Frame aggregate',
);
assert.ok(jobs.dependencies?.['@lingcootech/frame-extension-sdk']);
assert.ok(jobs.dependencies?.['@lingcootech/frame-database']);
assert.ok(jobs.dependencies?.['@lingcootech/frame-audit']);
assert.equal(
  (await sourceText('packages/jobs')).includes("from '@lingcootech/frame'"),
  false,
  'Jobs source must not import the legacy Frame aggregate',
);
assert.equal(
  (await sourceText('packages/identity')).includes('outboxEvents'),
  false,
  'Identity must publish events through its port instead of the Jobs schema',
);

const integrations = await manifest('packages/integrations');
assert.equal(
  integrations.dependencies?.['@lingcootech/frame'],
  undefined,
  'Integrations feature must not depend on the legacy Frame aggregate',
);
assert.ok(integrations.dependencies?.['@lingcootech/frame-audit']);

const assets = await manifest('packages/assets');
assert.equal(
  assets.dependencies?.['@lingcootech/frame'],
  undefined,
  'Assets feature must not depend on the legacy Frame aggregate',
);
assert.equal(assets.dependencies?.['@lingcootech/frame-integrations'], undefined);
assert.equal(assets.dependencies?.['@lingcootech/frame-jobs'], undefined);
assert.equal(assets.dependencies?.['@lingcootech/frame-storage-qiniu'], undefined);
assert.ok(assets.dependencies?.['@lingcootech/frame-audit']);
const assetsSource = await sourceText('packages/assets');
assert.equal(assetsSource.includes("from '@lingcootech/frame'"), false);
assert.equal(
  /integrationConnections|jobRuns|QiniuProvider|QiniuService/.test(assetsSource),
  false,
  'Assets must use storage and jobs ports instead of optional feature internals',
);
for (const vendorDependency of ['nodemailer', 'alipay-sdk']) {
  assert.equal(
    integrations.dependencies?.[vendorDependency],
    undefined,
    `Integrations core must not depend on vendor SDK ${vendorDependency}`,
  );
}
const integrationsSource = await sourceText('packages/integrations');
assert.equal(
  integrationsSource.includes("from '@lingcootech/frame'"),
  false,
  'Integrations source must not import the legacy Frame aggregate',
);
assert.equal(
  /nodemailer|alipay-sdk|QiniuProvider|WechatPayProvider|OpenRouterProvider/.test(
    integrationsSource,
  ),
  false,
  'Integrations core must remain provider-neutral',
);
const integrationConnectionConsumers = (
  await Promise.all(
    [
      'packages/frame/src/integrations/assets/ports.ts',
      'packages/frame/src/integrations/identity/ports.ts',
      'packages/frame/src/integrations/notifications/ports.ts',
      'packages/frame/src/core/modules/search/providers.ts',
    ].map(fileText),
  )
).join('\n');
assert.equal(
  /integrationConnections|integration_connections/.test(integrationConnectionConsumers),
  false,
  'Feature adapters and search must query connections through the Integrations public port',
);

for (const [directory, expectedDependency] of [
  ['packages/mail-nodemailer', 'nodemailer'],
  ['packages/storage-qiniu', undefined],
  ['packages/ai-openrouter', undefined],
  ['packages/payments', 'alipay-sdk'],
]) {
  const adapter = await manifest(directory);
  assert.ok(
    adapter.dependencies?.['@lingcootech/frame-integrations'],
    `${adapter.name} must depend on Integrations contracts`,
  );
  assert.equal(
    adapter.dependencies?.['@lingcootech/frame'],
    undefined,
    `${adapter.name} must not depend on the legacy Frame aggregate`,
  );
  if (expectedDependency) assert.ok(adapter.dependencies?.[expectedDependency]);
  assert.equal(
    (await sourceText(directory)).includes("from '@lingcootech/frame'"),
    false,
    `${adapter.name} source must not import the legacy Frame aggregate`,
  );
}

const frame = await manifest('packages/frame');
assert.equal(frame.dependencies?.nodemailer, undefined);
assert.equal(frame.dependencies?.['alipay-sdk'], undefined);

const notifications = await manifest('packages/notifications');
assert.equal(
  notifications.dependencies?.['@lingcootech/frame'],
  undefined,
  'Notifications feature must not depend on the legacy Frame aggregate',
);
assert.ok(notifications.dependencies?.['@lingcootech/frame-jobs']);
assert.ok(notifications.dependencies?.['@lingcootech/frame-identity']);
assert.ok(notifications.dependencies?.['@lingcootech/frame-audit']);
const notificationsSource = await sourceText('packages/notifications');
assert.equal(
  notificationsSource.includes("from '@lingcootech/frame'"),
  false,
  'Notifications source must not import the legacy Frame aggregate',
);
assert.equal(
  /smtp|integrationConnections|integration_connections|decryptSetting/i.test(notificationsSource),
  false,
  'Notifications must use Mail ports instead of SMTP or legacy Integration internals',
);
assert.equal(
  importsDatabaseSchemaSymbol(notificationsSource, 'accounts'),
  false,
  'Notifications must query recipients through the Identity account directory',
);
assert.equal(
  /\bJobService\b|\bjobRuns\b/.test(notificationsSource),
  false,
  'Notifications must enqueue delivery through the Jobs command port',
);

const presentation = await manifest('packages/presentation');
assert.ok(presentation.dependencies?.['@lingcootech/frame-identity']);
assert.ok(presentation.dependencies?.['@lingcootech/frame-audit']);
const presentationSource = await sourceText('packages/presentation');
assert.equal(
  importsDatabaseSchemaSymbol(presentationSource, 'accounts'),
  false,
  'Presentation must resolve history actors through the Identity account directory',
);

const cms = await manifest('packages/cms');
assert.ok(cms.dependencies?.['@lingcootech/frame-audit']);

const migratedAuditConsumers = (
  await Promise.all(
    [
      'packages/frame/src/integrations/assets/ports.ts',
      'packages/frame/src/integrations/cms/extension.ts',
      'packages/frame/src/integrations/identity/ports.ts',
      'packages/frame/src/integrations/integrations/ports.ts',
      'packages/frame/src/integrations/jobs/ports.ts',
      'packages/frame/src/integrations/notifications/ports.ts',
      'packages/frame/src/integrations/presentation/ports.ts',
      'packages/frame/src/runtime/worker.ts',
    ].map(fileText),
  )
).join('\n');
assert.equal(
  /recordAuditEvent|core\/modules\/audit\/recorder/.test(migratedAuditConsumers),
  false,
  'Migrated features must write audit events through the public Audit command port',
);
const frameSource = await sourceText('packages/frame');
assert.equal(
  /recordAuditEvent|audit\/recorder/.test(frameSource),
  false,
  'Frame must not restore the deprecated database-aware audit recorder',
);
assert.equal(
  importsDatabaseSchemaSymbol(frameSource, 'auditLogs'),
  false,
  'Frame must read audit records through the public Audit query port',
);
const platformAuditWriters = (
  await Promise.all(
    [
      'packages/frame/src/core/modules/metadata/service.ts',
      'packages/frame/src/core/modules/settings/service.ts',
      'packages/frame/src/core/modules/data-exchange/service.ts',
      'packages/frame/src/core/modules/observability/service.ts',
    ].map(fileText),
  )
).join('\n');
assert.equal(
  /\bauditLogs\b/.test(platformAuditWriters),
  false,
  'Platform write services must persist audit events through AuditCommandPort',
);
const identityPresentationConsumer = await fileText(
  'packages/frame/src/integrations/identity/ports.ts',
);
assert.equal(
  /\bPresentationService\b|createLegacyPresentationPorts/.test(identityPresentationConsumer),
  false,
  'Identity challenge delivery must read branding through the Presentation profile reader',
);
const accountDirectoryConsumers = (
  await Promise.all([
    fileText('packages/frame/src/integrations/notifications/ports.ts'),
    fileText('packages/frame/src/core/modules/search/providers.ts'),
  ])
).join('\n');
assert.equal(
  importsDatabaseSchemaSymbol(accountDirectoryConsumers, 'accounts'),
  false,
  'Frame adapters and search must query accounts through the Identity account directory',
);

const referenceSystemSource = await sourceText('apps/reference-system');
assert.equal(
  referenceSystemSource.includes("frameIdentityExtension } from '@lingcootech/frame/extensions'"),
  false,
  'Reference System must compose Identity from its owning package',
);

console.log('Kernel and infrastructure adapter dependency boundaries verified.');
