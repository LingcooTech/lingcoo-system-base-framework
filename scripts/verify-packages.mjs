import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'lingcoo-frame-pack-'));
const archiveDirectory = path.join(temporaryRoot, 'archives');
const consumerDirectory = path.join(temporaryRoot, 'consumer');
const generatedConsumerDirectory = path.join(temporaryRoot, 'generated-consumer');

function packPackage(directory) {
  const output = execFileSync(
    'npm',
    ['pack', '--json', '--ignore-scripts', '--pack-destination', archiveDirectory],
    { cwd: directory, encoding: 'utf8' },
  );
  const [manifest] = JSON.parse(output);
  return {
    archive: path.join(archiveDirectory, manifest.filename),
    files: new Set(manifest.files.map((file) => file.path)),
  };
}

function assertPackageFiles(packageName, actualFiles, expectedFiles) {
  for (const expectedFile of expectedFiles) {
    assert.ok(actualFiles.has(expectedFile), `${packageName} tarball is missing ${expectedFile}`);
  }
}

async function findPackageManifests(root) {
  const manifests = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (['dist', 'node_modules'].includes(entry.name)) continue;
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(entryPath);
      else if (entry.name === 'package.json') manifests.push(entryPath);
    }
  }
  await visit(root);
  return manifests;
}

await mkdir(archiveDirectory, { recursive: true });

try {
  const frame = packPackage(path.join(repositoryRoot, 'packages/frame'));
  const extensionSdk = packPackage(path.join(repositoryRoot, 'packages/extension-sdk'));
  const kernel = packPackage(path.join(repositoryRoot, 'packages/kernel'));
  const database = packPackage(path.join(repositoryRoot, 'packages/database'));
  const audit = packPackage(path.join(repositoryRoot, 'packages/audit'));
  const fastify = packPackage(path.join(repositoryRoot, 'packages/fastify'));
  const opentelemetry = packPackage(path.join(repositoryRoot, 'packages/opentelemetry'));
  const identity = packPackage(path.join(repositoryRoot, 'packages/identity'));
  const integrations = packPackage(path.join(repositoryRoot, 'packages/integrations'));
  const assets = packPackage(path.join(repositoryRoot, 'packages/assets'));
  const presentation = packPackage(path.join(repositoryRoot, 'packages/presentation'));
  const mailNodemailer = packPackage(path.join(repositoryRoot, 'packages/mail-nodemailer'));
  const storageQiniu = packPackage(path.join(repositoryRoot, 'packages/storage-qiniu'));
  const aiOpenrouter = packPackage(path.join(repositoryRoot, 'packages/ai-openrouter'));
  const payments = packPackage(path.join(repositoryRoot, 'packages/payments'));
  const jobs = packPackage(path.join(repositoryRoot, 'packages/jobs'));
  const notifications = packPackage(path.join(repositoryRoot, 'packages/notifications'));
  const admin = packPackage(path.join(repositoryRoot, 'packages/admin-shell'));
  const cms = packPackage(path.join(repositoryRoot, 'packages/cms'));
  const web = packPackage(path.join(repositoryRoot, 'packages/web-shell'));
  const designTokens = packPackage(path.join(repositoryRoot, 'packages/design-tokens'));
  const ui = packPackage(path.join(repositoryRoot, 'packages/ui'));
  const createFrameApp = packPackage(path.join(repositoryRoot, 'packages/create-frame-app'));
  const exampleExtension = packPackage(path.join(repositoryRoot, 'fixtures/example-extension'));
  const frameVersion = JSON.parse(
    await readFile(path.join(repositoryRoot, 'packages/frame/package.json'), 'utf8'),
  ).version;

  assertPackageFiles('@lingcootech/frame', frame.files, [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/host/app.js',
    'dist/runtime/worker.js',
    'dist/runtime/migrations.js',
    'dist/core/extension.js',
    'dist/core/manifest.js',
    'dist/integrations/cms/extension.js',
    'dist/security.js',
    'dist/security.d.ts',
    'dist/capabilities.js',
    'dist/capabilities.d.ts',
    'dist/environment.js',
    'dist/environment.d.ts',
  ]);
  assert.equal(frame.files.has('apps/reference-admin/dist/index.html'), false);
  assert.equal(frame.files.has('apps/reference-web/dist/index.html'), false);
  assertPackageFiles('@lingcootech/frame-kernel', kernel.files, [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/extensions.js',
    'dist/migrations.js',
    'dist/ports/index.js',
  ]);
  assertPackageFiles('@lingcootech/frame-database', database.files, [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/migrations.js',
    'dist/schema.js',
    'drizzle/0000_base_system.sql',
    'drizzle/0001_platform_permissions.sql',
  ]);
  assertPackageFiles('@lingcootech/frame-audit', audit.files, [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/postgres.js',
    'dist/postgres.d.ts',
  ]);
  assertPackageFiles('@lingcootech/frame-extension-sdk', extensionSdk.files, [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/server.js',
    'dist/environment.js',
    'dist/environment.d.ts',
    'dist/worker.js',
    'dist/migrations.js',
  ]);
  assertPackageFiles('@lingcootech/frame-fastify', fastify.files, [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/app.js',
  ]);
  assertPackageFiles('@lingcootech/frame-opentelemetry', opentelemetry.files, [
    'dist/index.js',
    'dist/index.d.ts',
  ]);
  assertPackageFiles('@lingcootech/frame-identity', identity.files, [
    'dist/index.js',
    'dist/manifest.js',
    'dist/environment.js',
    'dist/provider.js',
    'dist/repository.js',
    'dist/server.js',
    'dist/migrations.js',
    'dist/password.js',
    'dist/rbac.js',
    'migrations/0001_identity.sql',
  ]);
  assertPackageFiles('@lingcootech/frame-jobs', jobs.files, [
    'dist/index.js',
    'dist/manifest.js',
    'dist/server.js',
    'dist/worker.js',
    'dist/migrations.js',
    'migrations/0001_jobs.sql',
  ]);
  assertPackageFiles('@lingcootech/frame-integrations', integrations.files, [
    'dist/index.js',
    'dist/manifest.js',
    'dist/server.js',
    'dist/migrations.js',
    'dist/crypto.js',
    'migrations/0001_integrations.sql',
  ]);
  assertPackageFiles('@lingcootech/frame-assets', assets.files, [
    'dist/index.js',
    'dist/manifest.js',
    'dist/server.js',
    'dist/worker.js',
    'dist/migrations.js',
    'migrations/0001_assets.sql',
  ]);
  assertPackageFiles('@lingcootech/frame-presentation', presentation.files, [
    'dist/index.js',
    'dist/contracts.js',
    'dist/postgres.js',
    'dist/postgres.d.ts',
    'dist/server.js',
    'dist/migrations.js',
    'dist/service.js',
    'migrations/0001_presentation.sql',
  ]);
  for (const [packageName, archive] of [
    ['@lingcootech/frame-mail-nodemailer', mailNodemailer],
    ['@lingcootech/frame-storage-qiniu', storageQiniu],
    ['@lingcootech/frame-ai-openrouter', aiOpenrouter],
    ['@lingcootech/frame-payments', payments],
  ]) {
    assertPackageFiles(packageName, archive.files, ['dist/index.js', 'dist/index.d.ts']);
  }
  assertPackageFiles('@lingcootech/frame-notifications', notifications.files, [
    'dist/index.js',
    'dist/manifest.js',
    'dist/server.js',
    'dist/worker.js',
    'dist/migrations.js',
    'migrations/0001_notifications.sql',
  ]);
  assertPackageFiles('@lingcootech/frame-admin', admin.files, [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/auth.js',
    'dist/auth.d.ts',
    'dist/layout.js',
    'dist/layout.d.ts',
    'dist/manifest.js',
    'dist/manifest.d.ts',
    'dist/router.js',
    'dist/router.d.ts',
    'dist/shared.js',
    'dist/shared.d.ts',
    'dist/system-info.js',
    'dist/system-info.d.ts',
    'dist/defaults.js',
    'dist/defaults.d.ts',
    'dist/defaults/client.js',
    'dist/defaults/pages/AccessPage.js',
    'dist/styles.css',
  ]);
  assertPackageFiles('@lingcootech/frame-cms', cms.files, [
    'dist/index.js',
    'dist/contracts.js',
    'dist/server.js',
    'dist/worker.js',
    'dist/migrations.js',
    'dist/admin.js',
    'dist/admin-page.js',
    'dist/admin-page.d.ts',
    'dist/admin-client.js',
    'dist/admin-client.d.ts',
    'dist/web.js',
    'dist/web-pages.js',
    'dist/web-pages.d.ts',
    'dist/web-client.js',
    'dist/web-client.d.ts',
    'dist/article-card.js',
    'dist/article-list.js',
    'dist/content-detail.js',
    'dist/content-renderer.js',
    'dist/empty-content.js',
    'dist/styles.css',
    'migrations/0009_cms_lite.sql',
    'migrations/0011_cms_workflow.sql',
  ]);
  assertPackageFiles('@lingcootech/frame-web', web.files, [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/manifest.js',
    'dist/manifest.d.ts',
    'dist/account.js',
    'dist/layout.js',
    'dist/presentation.js',
    'dist/seo.js',
    'dist/site.js',
    'dist/system-states.js',
    'dist/styles.css',
  ]);
  assertPackageFiles('@lingcootech/frame-design-tokens', designTokens.files, [
    'dist/base.css',
    'dist/admin.css',
    'dist/public.css',
  ]);
  assertPackageFiles('@lingcootech/frame-ui', ui.files, [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/Button.js',
    'dist/Button.d.ts',
    'dist/styles.css',
  ]);
  assertPackageFiles('@lingcootech/create-frame-app', createFrameApp.files, [
    'dist/cli.mjs',
    'dist/generator.mjs',
    'dist/template/package.json',
    'dist/template/apps/system/src/system.ts',
    'dist/template/packages/domain/src/contracts.ts',
  ]);
  for (const [packageName, archive] of [
    ['@lingcootech/frame', frame],
    ['@lingcootech/frame-extension-sdk', extensionSdk],
    ['@lingcootech/frame-kernel', kernel],
    ['@lingcootech/frame-database', database],
    ['@lingcootech/frame-audit', audit],
    ['@lingcootech/frame-fastify', fastify],
    ['@lingcootech/frame-opentelemetry', opentelemetry],
    ['@lingcootech/frame-identity', identity],
    ['@lingcootech/frame-integrations', integrations],
    ['@lingcootech/frame-assets', assets],
    ['@lingcootech/frame-presentation', presentation],
    ['@lingcootech/frame-mail-nodemailer', mailNodemailer],
    ['@lingcootech/frame-storage-qiniu', storageQiniu],
    ['@lingcootech/frame-ai-openrouter', aiOpenrouter],
    ['@lingcootech/frame-payments', payments],
    ['@lingcootech/frame-jobs', jobs],
    ['@lingcootech/frame-notifications', notifications],
    ['@lingcootech/frame-admin', admin],
    ['@lingcootech/frame-cms', cms],
    ['@lingcootech/frame-web', web],
    ['@lingcootech/frame-design-tokens', designTokens],
    ['@lingcootech/frame-ui', ui],
  ]) {
    assertPackageFiles(packageName, archive.files, ['dist/LICENSE', 'dist/NOTICE']);
  }
  assertPackageFiles('@lingcootech/frame-example-extension', exampleExtension.files, [
    'dist/index.js',
    'dist/contracts.js',
    'dist/server.js',
    'dist/worker.js',
    'dist/migrations.js',
    'dist/admin.js',
    'dist/web.js',
    'migrations/0001_initial.sql',
  ]);

  await cp(path.join(repositoryRoot, 'fixtures/consumer'), consumerDirectory, { recursive: true });
  const fixtureManifestPath = path.join(consumerDirectory, 'package.json');
  const fixtureManifest = JSON.parse(await readFile(fixtureManifestPath, 'utf8'));
  fixtureManifest.dependencies['@lingcootech/frame'] = pathToFileURL(frame.archive).href;
  fixtureManifest.dependencies['@lingcootech/frame-kernel'] = pathToFileURL(kernel.archive).href;
  fixtureManifest.dependencies['@lingcootech/frame-database'] = pathToFileURL(
    database.archive,
  ).href;
  fixtureManifest.dependencies['@lingcootech/frame-audit'] = pathToFileURL(audit.archive).href;
  fixtureManifest.dependencies['@lingcootech/frame-fastify'] = pathToFileURL(fastify.archive).href;
  fixtureManifest.dependencies['@lingcootech/frame-opentelemetry'] = pathToFileURL(
    opentelemetry.archive,
  ).href;
  fixtureManifest.dependencies['@lingcootech/frame-identity'] = pathToFileURL(
    identity.archive,
  ).href;
  fixtureManifest.dependencies['@lingcootech/frame-integrations'] = pathToFileURL(
    integrations.archive,
  ).href;
  fixtureManifest.dependencies['@lingcootech/frame-assets'] = pathToFileURL(assets.archive).href;
  fixtureManifest.dependencies['@lingcootech/frame-presentation'] = pathToFileURL(
    presentation.archive,
  ).href;
  fixtureManifest.dependencies['@lingcootech/frame-mail-nodemailer'] = pathToFileURL(
    mailNodemailer.archive,
  ).href;
  fixtureManifest.dependencies['@lingcootech/frame-storage-qiniu'] = pathToFileURL(
    storageQiniu.archive,
  ).href;
  fixtureManifest.dependencies['@lingcootech/frame-ai-openrouter'] = pathToFileURL(
    aiOpenrouter.archive,
  ).href;
  fixtureManifest.dependencies['@lingcootech/frame-payments'] = pathToFileURL(
    payments.archive,
  ).href;
  fixtureManifest.dependencies['@lingcootech/frame-jobs'] = pathToFileURL(jobs.archive).href;
  fixtureManifest.dependencies['@lingcootech/frame-notifications'] = pathToFileURL(
    notifications.archive,
  ).href;
  fixtureManifest.dependencies['@lingcootech/frame-extension-sdk'] = pathToFileURL(
    extensionSdk.archive,
  ).href;
  fixtureManifest.dependencies['@lingcootech/frame-admin'] = pathToFileURL(admin.archive).href;
  fixtureManifest.dependencies['@lingcootech/frame-cms'] = pathToFileURL(cms.archive).href;
  fixtureManifest.dependencies['@lingcootech/frame-web'] = pathToFileURL(web.archive).href;
  fixtureManifest.dependencies['@lingcootech/frame-design-tokens'] = pathToFileURL(
    designTokens.archive,
  ).href;
  fixtureManifest.dependencies['@lingcootech/frame-ui'] = pathToFileURL(ui.archive).href;
  fixtureManifest.dependencies['@lingcootech/frame-example-extension'] = pathToFileURL(
    exampleExtension.archive,
  ).href;
  await writeFile(fixtureManifestPath, `${JSON.stringify(fixtureManifest, null, 2)}\n`);

  execFileSync(
    'npm',
    [
      'install',
      '--prefer-offline',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--fetch-retries=0',
      '--fetch-timeout=10000',
    ],
    {
      cwd: consumerDirectory,
      stdio: 'inherit',
    },
  );
  execFileSync('npm', ['run', 'verify'], {
    cwd: consumerDirectory,
    env: process.env,
    stdio: 'inherit',
  });

  execFileSync(
    'node',
    [
      path.join(repositoryRoot, 'packages/create-frame-app/dist/cli.mjs'),
      generatedConsumerDirectory,
      '--package-scope',
      '@generated',
      '--system-id',
      'generated-consumer',
      '--display-name',
      'Generated Consumer',
      '--frame-version',
      frameVersion,
      '--registry',
      'github',
      '--no-install',
    ],
    { cwd: repositoryRoot, stdio: 'inherit' },
  );

  const generatedArchives = new Map([
    ['@lingcootech/create-frame-app', createFrameApp.archive],
    ['@lingcootech/frame', frame.archive],
    ['@lingcootech/frame-admin', admin.archive],
    ['@lingcootech/frame-cms', cms.archive],
    ['@lingcootech/frame-database', database.archive],
    ['@lingcootech/frame-audit', audit.archive],
    ['@lingcootech/frame-design-tokens', designTokens.archive],
    ['@lingcootech/frame-extension-sdk', extensionSdk.archive],
    ['@lingcootech/frame-kernel', kernel.archive],
    ['@lingcootech/frame-fastify', fastify.archive],
    ['@lingcootech/frame-opentelemetry', opentelemetry.archive],
    ['@lingcootech/frame-identity', identity.archive],
    ['@lingcootech/frame-integrations', integrations.archive],
    ['@lingcootech/frame-assets', assets.archive],
    ['@lingcootech/frame-presentation', presentation.archive],
    ['@lingcootech/frame-mail-nodemailer', mailNodemailer.archive],
    ['@lingcootech/frame-storage-qiniu', storageQiniu.archive],
    ['@lingcootech/frame-ai-openrouter', aiOpenrouter.archive],
    ['@lingcootech/frame-payments', payments.archive],
    ['@lingcootech/frame-jobs', jobs.archive],
    ['@lingcootech/frame-notifications', notifications.archive],
    ['@lingcootech/frame-ui', ui.archive],
    ['@lingcootech/frame-web', web.archive],
  ]);
  const vendoredArchives = new Map();
  const vendoredDirectory = path.join(generatedConsumerDirectory, '.frame-packages');
  await mkdir(vendoredDirectory, { recursive: true });
  for (const [packageName, archive] of generatedArchives) {
    const vendoredArchive = path.join(vendoredDirectory, path.basename(archive));
    await cp(archive, vendoredArchive);
    vendoredArchives.set(packageName, vendoredArchive);
  }
  for (const manifestPath of await findPackageManifests(generatedConsumerDirectory)) {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (manifestPath === path.join(generatedConsumerDirectory, 'package.json')) {
      manifest.dependencies ??= {};
      for (const packageName of generatedArchives.keys()) {
        if (packageName !== '@lingcootech/create-frame-app') {
          manifest.dependencies[packageName] ??= frameVersion;
        }
      }
    }
    for (const field of [
      'dependencies',
      'devDependencies',
      'optionalDependencies',
      'peerDependencies',
    ]) {
      for (const dependencyName of Object.keys(manifest[field] ?? {})) {
        const archive = vendoredArchives.get(dependencyName);
        if (archive) {
          const relativeArchive = path.relative(path.dirname(manifestPath), archive);
          manifest[field][dependencyName] = `file:${relativeArchive.split(path.sep).join('/')}`;
        }
      }
    }
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  execFileSync(
    'npm',
    [
      'install',
      '--prefer-offline',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--fetch-retries=0',
      '--fetch-timeout=10000',
    ],
    {
      cwd: generatedConsumerDirectory,
      env: {
        ...process.env,
        NODE_AUTH_TOKEN:
          process.env.NODE_AUTH_TOKEN ?? 'generated-consumer-uses-local-frame-tarballs',
      },
      stdio: 'inherit',
    },
  );
  execFileSync('npm', ['run', 'frame:verify'], {
    cwd: generatedConsumerDirectory,
    env: { ...process.env, FRAME_ALLOW_LOCAL_TARBALLS: '1' },
    stdio: 'inherit',
  });
  execFileSync('npm', ['run', 'check'], {
    cwd: generatedConsumerDirectory,
    env: { ...process.env, FRAME_ALLOW_LOCAL_TARBALLS: '1' },
    stdio: 'inherit',
  });
  execFileSync('npm', ['run', 'build:all'], {
    cwd: generatedConsumerDirectory,
    env: process.env,
    stdio: 'inherit',
  });
  if (process.env.DATABASE_URL) {
    execFileSync('npm', ['run', 'db:migrate'], {
      cwd: generatedConsumerDirectory,
      env: process.env,
      stdio: 'inherit',
    });
  }
  if (process.env.VERIFY_GENERATED_DOCKER === '1') {
    const dockerfilePath = path.join(generatedConsumerDirectory, 'Dockerfile');
    const verificationDockerfilePath = path.join(generatedConsumerDirectory, 'Dockerfile.verify');
    const dockerfile = await readFile(dockerfilePath, 'utf8');
    const manifestCopy = 'COPY packages/domain/package.json ./packages/domain/';
    assert.ok(dockerfile.includes(manifestCopy), 'Generated Dockerfile structure changed');
    await writeFile(
      verificationDockerfilePath,
      dockerfile.replace(manifestCopy, `${manifestCopy}\nCOPY .frame-packages ./.frame-packages`),
    );
    const dummySecret = path.join(temporaryRoot, 'dummy-npm-token');
    await writeFile(dummySecret, 'local-tarball-verification');
    execFileSync(
      'docker',
      [
        'build',
        '--file',
        'Dockerfile.verify',
        '--secret',
        `id=npm_token,src=${dummySecret}`,
        '--tag',
        `frame-generated-consumer:${frameVersion.replaceAll('+', '-')}`,
        '.',
      ],
      { cwd: generatedConsumerDirectory, env: process.env, stdio: 'inherit' },
    );
  }

  console.log('All Frame package tarballs and the generated Consumer verified.');
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
