import { execFileSync } from 'node:child_process';
import { access, cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';

export const FRAME_PACKAGE_PREFIX = '@lingcootech/frame';
export const FRAME_TOOL_PACKAGE = '@lingcootech/create-frame-app';
export const FRAME_CONFIG_FILE = 'lingcootech.frame.json';

const textExtensions = new Set([
  '',
  '.css',
  '.env',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.sql',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);

function assertSafeSegment(value, label) {
  if (!/^[a-z][a-z0-9-]*$/.test(value)) {
    throw new Error(`${label} must start with a lowercase letter and contain only a-z, 0-9, or -.`);
  }
}

export function normalizeOptions(options) {
  const directory = path.resolve(options.directory);
  const projectName = options.projectName ?? path.basename(directory);
  const packageScope = options.packageScope ?? '@example';
  const systemId = options.systemId ?? projectName;
  const displayName = options.displayName ?? projectName;
  const frameVersion = options.frameVersion;
  const registry = options.registry ?? 'github';
  const channel = options.channel ?? (registry === 'github' ? 'preview' : 'stable');

  assertSafeSegment(projectName, 'Project name');
  assertSafeSegment(systemId, 'System ID');
  if (!/^@[a-z][a-z0-9-]*$/.test(packageScope)) {
    throw new Error('Package scope must look like @acme.');
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(frameVersion)) {
    throw new Error('Frame version must be an exact semantic version.');
  }
  if (!['github', 'npmjs'].includes(registry)) {
    throw new Error('Registry must be github or npmjs.');
  }
  if (!['canary', 'preview', 'stable'].includes(channel)) {
    throw new Error('Channel must be canary, preview, or stable.');
  }
  if (registry === 'npmjs' && channel !== 'stable') {
    throw new Error('npmjs is only supported for the stable channel.');
  }

  return {
    ...options,
    channel,
    directory,
    displayName,
    frameVersion,
    packageScope,
    projectName,
    registry,
    systemId,
    cms: options.cms !== false,
    web: options.web !== false,
  };
}

function replaceTokens(source, options) {
  const replacements = {
    __DATABASE_NAME__: options.systemId.replaceAll('-', '_'),
    __DISPLAY_NAME__: options.displayName,
    __FRAME_VERSION__: options.frameVersion,
    __PACKAGE_SCOPE__: options.packageScope,
    __PROJECT_NAME__: options.projectName,
    __SYSTEM_ID__: options.systemId,
  };
  return Object.entries(replacements).reduce(
    (result, [token, value]) => result.replaceAll(token, value),
    source,
  );
}

function applyFeatureMarkers(source, feature, enabled) {
  const expression = new RegExp(
    `^.*<${feature}>.*\\r?\\n([\\s\\S]*?)^.*<\\/${feature}>.*(?:\\r?\\n|$)`,
    'gm',
  );
  return source.replace(expression, enabled ? '$1' : '');
}

async function walkFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walkFiles(entryPath)));
    else files.push(entryPath);
  }
  return files;
}

async function rewriteTemplateFiles(directory, options) {
  for (const file of await walkFiles(directory)) {
    if (!textExtensions.has(path.extname(file)) && !path.basename(file).startsWith('.')) continue;
    const source = await readFile(file, 'utf8');
    const rendered = replaceTokens(
      applyFeatureMarkers(
        applyFeatureMarkers(
          applyFeatureMarkers(applyFeatureMarkers(source, 'cms', options.cms), 'web', options.web),
          'github',
          options.registry === 'github',
        ),
        'npmjs',
        options.registry === 'npmjs',
      ),
      options,
    );
    await writeFile(file, rendered);
  }
}

function removeDependency(manifest, dependencyName) {
  for (const field of [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ]) {
    if (manifest[field]) delete manifest[field][dependencyName];
  }
}

async function updateJson(file, update) {
  const value = JSON.parse(await readFile(file, 'utf8'));
  update(value);
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function configureFeatures(directory, options) {
  const rootManifestPath = path.join(directory, 'package.json');
  await updateJson(rootManifestPath, (manifest) => {
    if (!options.web) {
      delete manifest.scripts['dev:web'];
      delete manifest.scripts['build:web'];
      manifest.scripts['build:all'] =
        'npm run build:packages && npm run build:system && npm run build:admin';
    }
  });

  if (!options.cms) {
    for (const relativeManifest of [
      'apps/system/package.json',
      'apps/admin/package.json',
      ...(options.web ? ['apps/web/package.json'] : []),
    ]) {
      await updateJson(path.join(directory, relativeManifest), (manifest) => {
        removeDependency(manifest, '@lingcootech/frame-cms');
      });
    }
  }
  if (!options.web) {
    await rm(path.join(directory, 'apps/web'), { recursive: true, force: true });
    await rm(path.join(directory, 'packages/domain/src/web.tsx'), { force: true });
    await updateJson(path.join(directory, 'packages/domain/package.json'), (manifest) => {
      delete manifest.exports['./web'];
      removeDependency(manifest, '@lingcootech/frame-web');
    });
  }

  const githubNpmrc = path.join(directory, 'npmrc.github');
  if (options.registry === 'github') await rename(githubNpmrc, path.join(directory, '.npmrc'));
  else await rm(githubNpmrc, { force: true });
}

async function ensureEmptyTarget(directory, force) {
  try {
    const existing = await readdir(directory);
    if (existing.length > 0 && !force) {
      throw new Error(`Target directory is not empty: ${directory}`);
    }
    if (existing.length > 0) {
      const protectedDirectories = new Set([
        path.parse(directory).root,
        path.resolve(homedir()),
        path.resolve(process.cwd()),
      ]);
      if (protectedDirectories.has(directory)) {
        throw new Error(`Refusing to replace protected directory: ${directory}`);
      }
      await rm(directory, { recursive: true, force: true });
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  await mkdir(directory, { recursive: true });
}

export async function createApplication(rawOptions) {
  const options = normalizeOptions(rawOptions);
  await ensureEmptyTarget(options.directory, options.force === true);
  await cp(options.templateDirectory, options.directory, { recursive: true });
  await rewriteTemplateFiles(options.directory, options);
  await configureFeatures(options.directory, options);

  const config = {
    $schema:
      'https://raw.githubusercontent.com/LingcooTech/lingcoo-system-base-framework/main/docs/application-manifest.schema.json',
    schemaVersion: 1,
    frameVersion: options.frameVersion,
    channel: options.channel,
    registry: options.registry,
    features: { cms: options.cms, web: options.web },
  };
  await writeFile(
    path.join(options.directory, FRAME_CONFIG_FILE),
    `${JSON.stringify(config, null, 2)}\n`,
  );

  if (options.install !== false) {
    execFileSync('npm', ['install'], {
      cwd: options.directory,
      env: process.env,
      stdio: 'inherit',
    });
  }
  return options;
}

async function findPackageManifests(root) {
  const manifests = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (['.git', 'dist', 'node_modules'].includes(entry.name)) continue;
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(entryPath);
      else if (entry.name === 'package.json') manifests.push(entryPath);
    }
  }
  await visit(root);
  return manifests;
}

function isManagedFramePackage(name) {
  return (
    name === FRAME_TOOL_PACKAGE ||
    name === FRAME_PACKAGE_PREFIX ||
    name.startsWith(`${FRAME_PACKAGE_PREFIX}-`)
  );
}

export async function verifyApplicationVersions(directory) {
  const configPath = path.join(directory, FRAME_CONFIG_FILE);
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const mismatches = [];
  for (const manifestPath of await findPackageManifests(directory)) {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    for (const field of [
      'dependencies',
      'devDependencies',
      'optionalDependencies',
      'peerDependencies',
    ]) {
      for (const [name, version] of Object.entries(manifest[field] ?? {})) {
        if (isManagedFramePackage(name) && version !== config.frameVersion) {
          if (process.env.FRAME_ALLOW_LOCAL_TARBALLS === '1' && version.startsWith('file:')) {
            continue;
          }
          mismatches.push(`${path.relative(directory, manifestPath)}:${field}:${name}=${version}`);
        }
      }
    }
  }
  if (mismatches.length > 0) {
    throw new Error(
      `Frame packages must all match ${config.frameVersion}:\n${mismatches.join('\n')}`,
    );
  }
  return config;
}

export async function upgradeApplication(rawOptions) {
  const directory = path.resolve(rawOptions.directory ?? '.');
  const configPath = path.join(directory, FRAME_CONFIG_FILE);
  await access(configPath);
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const targetVersion = rawOptions.targetVersion;
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(targetVersion)) {
    throw new Error('Target Frame version must be an exact semantic version.');
  }
  const [currentMajor, currentMinor] = config.frameVersion.split('.').map(Number);
  const [targetMajor, targetMinor] = targetVersion.split('.').map(Number);
  const currentCore = config.frameVersion.split('-')[0].split('.').map(Number);
  const targetCore = targetVersion.split('-')[0].split('.').map(Number);
  const coreOrder = targetCore.findIndex((part, index) => part !== currentCore[index]);
  if (coreOrder >= 0 && targetCore[coreOrder] < currentCore[coreOrder]) {
    throw new Error(
      `Frame downgrade is not supported: ${config.frameVersion} -> ${targetVersion}.`,
    );
  }
  if (coreOrder < 0 && !config.frameVersion.includes('-') && targetVersion.includes('-')) {
    throw new Error(
      `Frame downgrade is not supported: ${config.frameVersion} -> ${targetVersion}.`,
    );
  }
  if (
    !rawOptions.allowUnsupported &&
    (currentMajor !== targetMajor || currentMinor !== targetMinor)
  ) {
    throw new Error(
      `Unsupported direct upgrade ${config.frameVersion} -> ${targetVersion}. Use each documented intermediate version or --allow-unsupported.`,
    );
  }

  const changes = [];
  for (const manifestPath of await findPackageManifests(directory)) {
    await updateJson(manifestPath, (manifest) => {
      for (const field of [
        'dependencies',
        'devDependencies',
        'optionalDependencies',
        'peerDependencies',
      ]) {
        for (const name of Object.keys(manifest[field] ?? {})) {
          if (!isManagedFramePackage(name)) continue;
          const previous = manifest[field][name];
          manifest[field][name] = targetVersion;
          changes.push(
            `${path.relative(directory, manifestPath)}: ${name} ${previous} -> ${targetVersion}`,
          );
        }
      }
    });
  }
  config.frameVersion = targetVersion;
  if (rawOptions.channel) config.channel = rawOptions.channel;
  if (rawOptions.registry) config.registry = rawOptions.registry;
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

  if (rawOptions.lockfile !== false) {
    execFileSync('npm', ['install', '--package-lock-only', '--ignore-scripts'], {
      cwd: directory,
      env: process.env,
      stdio: 'inherit',
    });
  }
  await verifyApplicationVersions(directory);
  return changes;
}
