import assert from 'node:assert/strict';
import { test } from 'node:test';
import { engineRange, supported, validate } from '../scripts/check-node-security-floor.mjs';

const engines = {
  'package.json': engineRange,
  'package-lock.json': engineRange,
  'src/package.json': engineRange,
  'src/package-lock.json': engineRange,
};

test('fixed supported lines pass; vulnerable, unsupported and prerelease versions fail', () => {
  for (const version of ['22.23.4', '24.22.1', '26.12.1', '24.23.0']) assert.equal(supported(version), true);
  for (const version of ['22.23.3', '24.19.0', '24.22.0', '26.12.0', '20.20.2', '24.22.1-rc.1', '24.022.1']) {
    assert.equal(supported(version), false);
  }
});

test('selector, active runtime, and each manifest and lock must satisfy the policy', () => {
  assert.deepEqual(validate({ selected: '24.22.1', active: '22.23.4', engines }), []);
  assert.notDeepEqual(validate({ selected: '24.19.0', active: '24.22.1', engines }), []);
  assert.notDeepEqual(validate({ selected: '24.22.1', active: '24.19.0', engines }), []);
  for (const name of Object.keys(engines)) {
    assert.notDeepEqual(validate({ selected: '24.22.1', active: '24.22.1', engines: { ...engines, [name]: '>=22.23.4' } }), []);
  }
});
