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
  const frame = packPackage(repositoryRoot);
  const database = packPackage(path.join(repositoryRoot, 'packages/database'));
  const designTokens = packPackage(path.join(repositoryRoot, 'packages/design-tokens'));
  const ui = packPackage(path.join(repositoryRoot, 'packages/ui'));

  assertPackageFiles('@lingcoo/frame', frame.files, [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/app.js',
    'dist/runtime/worker.js',
    'admin-ui/dist/index.html',
    'public-web/dist/index.html',
  ]);
  assertPackageFiles('@lingcoo/frame-database', database.files, [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/migrations.js',
    'dist/schema.js',
    'drizzle/0000_base_system.sql',
    'drizzle/0011_cms_workflow.sql',
  ]);
  assertPackageFiles('@lingcoo/frame-design-tokens', designTokens.files, [
    'dist/base.css',
    'dist/admin.css',
    'dist/public.css',
  ]);
  assertPackageFiles('@lingcoo/frame-ui', ui.files, [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/Button.js',
    'dist/Button.d.ts',
    'dist/styles.css',
  ]);

  await cp(path.join(repositoryRoot, 'fixtures/consumer'), consumerDirectory, { recursive: true });
  const fixtureManifestPath = path.join(consumerDirectory, 'package.json');
  const fixtureManifest = JSON.parse(await readFile(fixtureManifestPath, 'utf8'));
  fixtureManifest.dependencies['@lingcoo/frame'] = pathToFileURL(frame.archive).href;
  fixtureManifest.dependencies['@lingcoo/frame-database'] = pathToFileURL(database.archive).href;
  fixtureManifest.dependencies['@lingcoo/frame-design-tokens'] = pathToFileURL(
    designTokens.archive,
  ).href;
  fixtureManifest.dependencies['@lingcoo/frame-ui'] = pathToFileURL(ui.archive).href;
  await writeFile(fixtureManifestPath, `${JSON.stringify(fixtureManifest, null, 2)}\n`);

  execFileSync('npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: consumerDirectory,
    stdio: 'inherit',
  });
  execFileSync('npm', ['run', 'verify'], {
    cwd: consumerDirectory,
    env: process.env,
    stdio: 'inherit',
  });

  console.log('All Frame package tarballs verified.');
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
