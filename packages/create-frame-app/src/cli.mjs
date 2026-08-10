#!/usr/bin/env node

import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApplication, upgradeApplication, verifyApplicationVersions } from './generator.mjs';

function parseArguments(argv) {
  const positional = [];
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) {
      positional.push(argument);
      continue;
    }
    const key = argument.slice(2);
    if (key.startsWith('no-')) {
      flags[key.slice(3)] = false;
      continue;
    }
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) flags[key] = true;
    else {
      flags[key] = next;
      index += 1;
    }
  }
  return { flags, positional };
}

function help() {
  console.log(`Create a Frame application

Usage:
  create-frame-app <directory> --package-scope @acme --system-id my-system [options]
  create-frame-app upgrade <version> [directory] [--no-lockfile]
  create-frame-app verify [directory]

Create options:
  --display-name <name>       Human-readable application name
  --frame-version <version>   Exact Frame version (defaults to generator version)
  --registry github|npmjs     Package registry (default: github)
  --channel <channel>         canary, preview, or stable
  --no-cms                    Exclude the CMS extension
  --no-web                    Exclude the public web application
  --no-install                Generate without npm install
  --force                     Replace a non-empty target directory

Upgrade options:
  --allow-unsupported         Allow an undocumented cross-minor upgrade
  --no-lockfile               Do not regenerate package-lock.json
`);
}

async function packageVersion() {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  return manifest.version;
}

async function templateDirectory() {
  const packaged = fileURLToPath(new URL('./template/', import.meta.url));
  try {
    await access(packaged);
    return packaged;
  } catch {
    return fileURLToPath(new URL('../../../templates/application/', import.meta.url));
  }
}

const { flags, positional } = parseArguments(process.argv.slice(2));
if (flags.help || positional[0] === 'help') {
  help();
  process.exit(0);
}

try {
  if (positional[0] === 'upgrade') {
    const changes = await upgradeApplication({
      allowUnsupported: flags['allow-unsupported'] === true,
      channel: flags.channel,
      directory: positional[2] ?? '.',
      lockfile: flags.lockfile !== false,
      registry: flags.registry,
      targetVersion: positional[1],
    });
    console.log(`Updated ${changes.length} Frame dependency declarations.`);
    for (const change of changes) console.log(`- ${change}`);
  } else if (positional[0] === 'verify') {
    const config = await verifyApplicationVersions(path.resolve(positional[1] ?? '.'));
    console.log(`Frame dependency set is consistent at ${config.frameVersion}.`);
  } else {
    if (!positional[0]) {
      help();
      process.exit(1);
    }
    const generatorVersion = await packageVersion();
    if (flags['frame-version'] && flags['frame-version'] !== generatorVersion) {
      throw new Error(
        `Generator ${generatorVersion} can only create a Frame ${generatorVersion} application. Run the generator version that matches the required Frame version.`,
      );
    }
    const options = await createApplication({
      channel: flags.channel,
      cms: flags.cms !== false,
      directory: positional[0],
      displayName: flags['display-name'],
      force: flags.force === true,
      frameVersion: generatorVersion,
      install: flags.install !== false,
      packageScope: flags['package-scope'],
      projectName: flags['project-name'],
      registry: flags.registry,
      systemId: flags['system-id'],
      templateDirectory: await templateDirectory(),
      web: flags.web !== false,
    });
    console.log(`Created ${options.displayName} in ${options.directory}.`);
    if (options.registry === 'github') {
      console.log('GitHub Packages requires NODE_AUTH_TOKEN for npm install and Docker builds.');
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
