#!/usr/bin/env node

import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const CHANGELOG_PATH = join(projectRoot, 'CHANGELOG.md');
const README_PATH = join(projectRoot, 'README.md');
const DOCS_PATH = join(projectRoot, 'docs');

const TYPE_MAPPING = {
  feat: { section: 'Features', file: 'CHANGELOG.md' },
  fix: { section: 'Fixes', file: 'CHANGELOG.md' },
  docs: { section: 'Documentation', file: 'README.md' },
  refactor: { section: 'Changes', file: 'CHANGELOG.md' },
  perf: { section: 'Performance', file: 'CHANGELOG.md' },
  test: { section: 'Tests', file: 'CHANGELOG.md' },
  chore: { section: null, file: null },
  style: { section: null, file: null },
  ci: { section: null, file: null },
};

function getCurrentDate() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

function parseCommit(commitLine) {
  const match = commitLine.match(/^([a-f0-9]+)\s+(.+)$/);
  if (!match) return null;

  const [, hash, message] = match;
  const typeMatch = message.match(/^(\w+)(?:\(([^)]+)\))?:\s+(.+)$/);
  
  if (!typeMatch) return null;

  const [, type, scope, description] = typeMatch;
  const mapping = TYPE_MAPPING[type];

  return {
    hash: hash.slice(0, 7),
    fullHash: hash,
    type,
    scope: scope || null,
    description,
    mapping,
  };
}

function getCommits(from, to = 'HEAD') {
  const range = from ? `${from}..${to}` : to;
  try {
    const output = execSync(`git log ${range} --oneline --format="%H %s"`, {
      encoding: 'utf-8',
      cwd: projectRoot,
    });
    return output.split('\n').filter(Boolean).map(parseCommit).filter(Boolean);
  } catch (e) {
    return [];
  }
}

function getLastChangelogVersion() {
  try {
    const content = execSync(`git log --all --oneline --grep="^v" | head -1`, {
      encoding: 'utf-8',
      cwd: projectRoot,
    });
    const match = content.match(/v(\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function bumpVersion(currentVersion) {
  if (!currentVersion) return '0.0.1';
  const parts = currentVersion.split('.').map(Number);
  parts[2]++;
  return parts.join('.');
}

async function updateChangelog(commits) {
  const features = [];
  const fixes = [];
  const changes = [];

  for (const commit of commits) {
    if (!commit.mapping?.section) continue;
    
    const entry = commit.scope 
      ? `- ${commit.description} (${commit.scope})`
      : `- ${commit.description}`;

    if (commit.type === 'feat') features.push(entry);
    else if (commit.type === 'fix') fixes.push(entry);
    else if (commit.mapping.section === 'Changes') changes.push(entry);
  }

  if (features.length === 0 && fixes.length === 0 && changes.length === 0) {
    return null;
  }

  const currentVersion = getLastChangelogVersion();
  const newVersion = currentVersion ? bumpVersion(currentVersion) : '0.0.1';
  const date = getCurrentDate();

  let changelogContent = await readFile(CHANGELOG_PATH, 'utf-8');
  
  const versionHeader = `\n## v${newVersion} (${date})\n`;
  const sections = [];

  if (features.length > 0) {
    sections.push('## Features\n' + features.join('\n'));
  }
  if (fixes.length > 0) {
    sections.push('## Fixes\n' + fixes.join('\n'));
  }
  if (changes.length > 0) {
    sections.push('## Changes\n' + changes.join('\n'));
  }

  const newEntry = versionHeader + sections.join('\n\n') + '\n';

  const insertPoint = changelogContent.indexOf('\n## ');
  if (insertPoint === -1) {
    changelogContent += '\n' + newEntry;
  } else {
    changelogContent = changelogContent.slice(0, insertPoint) + newEntry + changelogContent.slice(insertPoint);
  }

  return { content: changelogContent, version: newVersion };
}

async function updateReadme(commits) {
  const hasDocsChanges = commits.some(c => c.type === 'docs');
  if (!hasDocsChanges) return null;

  const readmeContent = await readFile(README_PATH, 'utf-8');
  return { content: readmeContent };
}

async function previewChanges(commits) {
  console.log('\n=== DocSync Preview ===\n');
  console.log(`Found ${commits.length} commits with conventional format:\n`);

  const grouped = {};
  for (const commit of commits) {
    if (!commit.mapping?.section) continue;
    if (!grouped[commit.mapping.section]) {
      grouped[commit.mapping.section] = [];
    }
    grouped[commit.mapping.section].push(commit);
  }

  for (const [section, items] of Object.entries(grouped)) {
    console.log(`### ${section}`);
    for (const item of items) {
      const scope = item.scope ? ` (${item.scope})` : '';
      console.log(`  - ${item.description}${scope}`);
    }
    console.log('');
  }

  if (Object.keys(grouped).length === 0) {
    console.log('No documentation-worthy changes found.');
  }
}

async function autoCommitDocs(changelogUpdate) {
  const filesToCommit = [];
  
  if (changelogUpdate) {
    await writeFile(CHANGELOG_PATH, changelogUpdate.content);
    filesToCommit.push('CHANGELOG.md');
    console.log(`Updated CHANGELOG.md to v${changelogUpdate.version}`);
  }

  if (filesToCommit.length > 0) {
    try {
      execSync(`git add ${filesToCommit.join(' ')}`, { cwd: projectRoot });
      execSync(`git commit -m "docs: auto-sync documentation"`, { cwd: projectRoot });
      console.log(`Committed: ${filesToCommit.join(', ')}`);
    } catch (e) {
      console.log('No changes to commit or commit failed.');
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isHook = args.includes('--hook');
  const isAuto = args.includes('--auto');
  const isPreview = args.includes('--preview');
  
  let fromRef = null;
  const fromIndex = args.indexOf('--from');
  if (fromIndex !== -1 && args[fromIndex + 1]) {
    fromRef = args[fromIndex + 1];
  }

  const commits = getCommits(fromRef);
  
  if (isPreview || (!isAuto && !isHook)) {
    await previewChanges(commits);
  }

  if (isAuto) {
    const changelogUpdate = await updateChangelog(commits);
    await autoCommitDocs(changelogUpdate);
  }

  if (isHook) {
    await previewChanges(commits);
  }
}

main().catch(console.error);
