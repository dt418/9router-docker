#!/usr/bin/env node

import { mkdir, writeFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '../..');
const hooksDir = join(projectRoot, '.git', 'hooks');
const sourceHooksDir = join(__dirname, 'hooks');

async function installHook(hookName) {
  const targetPath = join(hooksDir, hookName);
  const sourceHook = join(sourceHooksDir, hookName);
  
  try {
    await stat(sourceHook);
  } catch {
    console.log(`  Skipping ${hookName} (not found)`);
    return;
  }

  await writeFile(targetPath, `#!/bin/sh\nnode "${join(__dirname, 'trigger.js')}" "$@"\n`, { mode: 0o755 });
  
  console.log(`  Installed ${hookName}`);
}

async function main() {
  console.log('Installing git hooks...');
  
  if (!existsSync(hooksDir)) {
    console.log('  Creating hooks directory');
    await mkdir(hooksDir, { recursive: true });
  }

  const availableHooks = ['prepare-commit-msg', 'post-commit', 'post-merge'];
  
  for (const hook of availableHooks) {
    await installHook(hook);
  }

  console.log('Done!');
  console.log('\nUsage:');
  console.log('  git commit -m "feat: add new feature"        # Preview only');
  console.log('  git commit -m "feat: add feature" -- --docs-auto  # Auto-commit docs');
}

main().catch(console.error);
