#!/bin/sh
set -eu

expected_integrity='sha512-i8hE43iSIAMFuYVi8TxsEISdELM4fIza600aLjJ0ankGPLqd0oTPKMJqAcO/QWm307MbSlWGzJcNZ0lGMQgHPA=='
npm_config_engine_strict=true npm_config_registry=https://registry.npmjs.org \
  npm pack npm@11.10.0 --pack-destination /tmp --json > /tmp/npm-11.10.0.pack.json
actual_integrity=$(node -e "process.stdout.write('sha512-' + require('node:crypto').createHash('sha512').update(require('node:fs').readFileSync('/tmp/npm-11.10.0.tgz')).digest('base64'))")
if [ "$actual_integrity" != "$expected_integrity" ]; then
  printf '%s\n' 'npm@11.10.0 tarball bytes do not match the official Registry SRI value' >&2
  exit 1
fi
npm_config_engine_strict=true npm install --global --ignore-scripts /tmp/npm-11.10.0.tgz
if [ "$(npm --version)" != "11.10.0" ]; then
  printf '%s\n' 'npm bootstrap did not activate version 11.10.0' >&2
  exit 1
fi
rm -f /tmp/npm-11.10.0.tgz /tmp/npm-11.10.0.pack.json
