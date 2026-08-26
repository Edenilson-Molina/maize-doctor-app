#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const envFile = join(root, '.env.production');

if (!existsSync(envFile)) {
  console.error('Falta .env.production: el APK se construiria sin EXPO_PUBLIC_API_URL de prod.');
  process.exit(1);
}

const passthrough = process.argv.slice(2);
const args = ['expo', 'run:android', '--variant', 'release', ...passthrough];

console.log(`> NODE_ENV=production npx ${args.join(' ')}`);

const result = spawnSync('npx', args, {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NODE_ENV: 'production' },
});

process.exit(result.status ?? 1);
