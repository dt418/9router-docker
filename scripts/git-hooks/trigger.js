#!/usr/bin/env node

import { spawn } from 'child_process';
import { argv } from 'process';

const hookName = argv[2];
const args = argv.slice(3);

const docsSyncPath = new URL('../docs-sync.js', import.meta.url).pathname;

function run() {
  return new Promise((resolve) => {
    const child = spawn('node', [docsSyncPath, '--hook', hookName, ...args], {
      stdio: 'inherit',
      shell: true
    });
    
    child.on('close', (code) => {
      resolve(code);
    });
  });
}

run();
