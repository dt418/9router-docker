#!/usr/bin/env node

/**
 * Post-commit hook: Auto-update docs for important changes
 * This runs AFTER a commit is made and can amend it with doc changes
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..');

// Check if auto-docs should run (via environment variable)
function shouldAutoUpdate() {
  // Check if auto-docs is disabled
  if (process.env.NO_AUTO_DOCS === '1') {
    return false;
  }
  
  // Check if commit message indicates docs update
  try {
    const msgPath = join(projectRoot, '.git', 'COMMIT_EDITMSG');
    if (existsSync(msgPath)) {
      const msg = readFileSync(msgPath, 'utf-8').trim();
      // Skip if commit is already a docs commit
      if (msg.startsWith('docs:') || msg.startsWith('chore:')) {
        return false;
      }
    }
  } catch {}
  
  return true;
}

function getRecentCommitMessage() {
  try {
    return execSync('git log -1 --format=%s', {
      encoding: 'utf-8',
      cwd: projectRoot,
    }).trim();
  } catch {
    return '';
  }
}

function isImportantCommit(message) {
  const patterns = [
    /^(security|feat|fix|perf|refactor)/i,
    /docker/i,
    /api.*auth/i,
    /endpoint/i,
    /middleware/i,
    /provider/i,
    /combo/i,
  ];
  return patterns.some(p => p.test(message));
}

async function main() {
  if (!shouldAutoUpdate()) {
    process.exit(0);
  }
  
  const commitMsg = getRecentCommitMessage();
  
  if (!isImportantCommit(commitMsg)) {
    process.exit(0);
  }
  
  console.log('\n📝 Auto-Docs: Checking documentation updates...');
  
  try {
    // Run auto-docs check
    execSync('node scripts/auto-docs.js --check', {
      stdio: 'inherit',
      cwd: projectRoot,
    });
  } catch (e) {
    // Silently ignore errors
  }
}

main().catch(() => process.exit(0));
