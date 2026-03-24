#!/usr/bin/env node

/**
 * Git hook trigger - runs docs-sync on commit
 * Automatically updates CHANGELOG for important changes
 */

import { spawn } from 'child_process';
import { argv, env } from 'process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..');

const hookName = argv[2];
const args = argv.slice(3);

// Get current commit message
function getCommitMessage() {
  try {
    // Try COMMIT_EDITMSG for commit-msg hook
    const msgPath = join(projectRoot, '.git', 'COMMIT_EDITMSG');
    return readFileSync(msgPath, 'utf-8').trim();
  } catch {
    return '';
  }
}

// Check if commit message is important (needs docs update)
function isImportantCommit(message) {
  const patterns = [
    /^(security|feat|fix|perf|refactor)/i,
    /docker/i,
    /api.*auth/i,
    /endpoint/i,
    /middleware/i,
  ];
  return patterns.some(p => p.test(message));
}

// Run auto-docs with preview
function runDocsSync() {
  return new Promise((resolve) => {
    const autoDocsPath = join(__dirname, '..', 'auto-docs.js');
    const child = spawn('node', [autoDocsPath, '--preview'], {
      stdio: 'inherit',
      cwd: projectRoot,
    });
    
    child.on('close', (code) => {
      resolve(code);
    });
  });
}

async function main() {
  const commitMsg = getCommitMessage();
  
  // Always run preview for important commits
  if (hookName === 'prepare-commit-msg' || hookName === 'commit-msg') {
    if (isImportantCommit(commitMsg)) {
      console.log('\n--- 📋 Auto-Docs Preview ---');
      await runDocsSync();
      console.log('---------------------------\n');
    }
  }
}

main().catch(console.error);
