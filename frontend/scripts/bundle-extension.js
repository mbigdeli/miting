#!/usr/bin/env node
/**
 * Put the companion extension into the Tauri resources before a build.
 * Release builds rebuild it from source first, as CI does: copying whatever
 * extension/dist held shipped a months-old extension that never paired with
 * the app ("Desktop app unavailable"). Dev runs keep the quick copy.
 *
 * Usage: node bundle-extension.js [dev|build]
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const command = process.argv[2] || 'dev';
const repoRoot = path.resolve(__dirname, '..', '..');
const extensionDir = path.join(repoRoot, 'extension');

if (command === 'build') {
  console.log('Building the companion extension...');
  if (!fs.existsSync(path.join(extensionDir, 'node_modules'))) {
    execSync('npm ci', { cwd: extensionDir, stdio: 'inherit' });
  }
  execSync('npm run build', { cwd: extensionDir, stdio: 'inherit' });
}

const sync = path.join(repoRoot, 'scripts', 'sync-extension-dist.mjs');
execSync(`node "${sync}"${command === 'build' ? ' --require' : ''}`, { stdio: 'inherit' });
