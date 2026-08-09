import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'lingcoo-frame-pack-'));
const archiveDirectory = path.join(temporaryRoot, 'archives');
const consumerDirectory = path.join(temporaryRoot, 'consumer');

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

await mkdir(archiveDirectory, { recursive: true });

try {
  const frame = packPackage(path.join(repositoryRoot, 'packages/frame'));
  const database = packPackage(path.join(repositoryRoot, 'packages/database'));
  const extensionSdk = packPackage(path.join(repositoryRoot, 'packages/extension-sdk'));
  const admin = packPackage(path.join(repositoryRoot, 'packages/admin-shell'));
  const cms = packPackage(path.join(repositoryRoot, 'packages/cms'));
  const web = packPackage(path.join(repositoryRoot, 'packages/web-shell'));
  const designTokens = packPackage(path.join(repositoryRoot, 'packages/design-tokens'));
  const ui = packPackage(path.join(repositoryRoot, 'packages/ui'));
  const exampleExtension = packPackage(path.join(repositoryRoot, 'fixtures/example-extension'));

  assertPackageFiles('@lingcootech/frame', frame.files, [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/host/app.js',
    'dist/runtime/worker.js',
    'dist/runtime/migrations.js',
    'dist/core/extension.js',
    'dist/core/manifest.js',
    'dist/integrations/cms/extension.js',
  ]);
  assert.equal(frame.files.has('apps/reference-admin/dist/index.html'), false);
  assert.equal(frame.files.has('apps/reference-web/dist/index.html'), false);
  assertPackageFiles('@lingcootech/frame-database', database.files, [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/migrations.js',
    'dist/schema.js',
    'drizzle/0000_base_system.sql',
    'drizzle/0010_account_security.sql',
  ]);
  assertPackageFiles('@lingcootech/frame-extension-sdk', extensionSdk.files, [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/server.js',
    'dist/worker.js',
    'dist/migrations.js',
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
  for (const [packageName, archive] of [
    ['@lingcootech/frame', frame],
    ['@lingcootech/frame-database', database],
    ['@lingcootech/frame-extension-sdk', extensionSdk],
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
  fixtureManifest.dependencies['@lingcootech/frame-database'] = pathToFileURL(
    database.archive,
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

  console.log('All Frame package tarballs verified.');
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
