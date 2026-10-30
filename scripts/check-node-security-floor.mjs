import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const engineRange = '^22.23.4 || ^24.22.1 || ^26.12.1';
const floors = new Map([[22, [23, 4]], [24, [22, 1]], [26, [12, 1]]]);

export function supported(version) {
  const match = /^(22|24|26)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
  if (!match) return false;
  const [, major, minor, patch] = match.map(Number);
  if (![major, minor, patch].every(Number.isSafeInteger)) return false;
  const [minimumMinor, minimumPatch] = floors.get(major);
  return minor > minimumMinor || (minor === minimumMinor && patch >= minimumPatch);
}

export function validate({ selected, active, engines }) {
  const errors = [];
  if (!supported(selected)) errors.push(`Selected Node ${selected} is unsupported or below its security floor`);
  if (!supported(active)) errors.push(`Active Node ${active} is unsupported or below its security floor`);
  for (const [name, value] of Object.entries(engines)) {
    if (value !== engineRange) errors.push(`${name} must declare engines.node as ${engineRange}`);
  }
  return errors;
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const read = (name) => JSON.parse(readFileSync(resolve(root, name), 'utf8'));
  const selected = readFileSync(resolve(root, '.node-version'), 'utf8').trim();
  const engines = {
    'package.json': read('package.json').engines?.node,
    'package-lock.json': read('package-lock.json').packages?.['']?.engines?.node,
    'src/package.json': read('src/package.json').engines?.node,
    'src/package-lock.json': read('src/package-lock.json').packages?.['']?.engines?.node,
  };
  const errors = validate({ selected, active: process.versions.node, engines });
  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
  } else {
    console.log(`Selected Node ${selected} and active Node ${process.versions.node} meet the security floor.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
