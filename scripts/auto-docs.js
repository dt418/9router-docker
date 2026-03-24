#!/usr/bin/env node

/**
 * Auto-Docs: Automatically update documentation for important changes
 * 
 * Usage:
 *   node scripts/auto-docs.js --check    # Check if docs need update
 *   node scripts/auto-docs.js --update   # Update docs and commit
 *   node scripts/auto-docs.js --preview  # Preview changes only
 */

import { readFile, writeFile, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const FILES = {
  changelog: join(projectRoot, 'CHANGELOG.md'),
  readme: join(projectRoot, 'README.md'),
  architecture: join(projectRoot, 'docs', 'ARCHITECTURE.md'),
  faq: join(projectRoot, 'docs', 'guides', 'faq.md'),
};

// Define what types of changes affect which docs
const DOC_IMPACT = {
  security: {
    priority: 'HIGH',
    files: ['changelog', 'faq'],
    autoUpdate: true,
  },
  feat: {
    priority: 'MEDIUM',
    files: ['changelog'],
    autoUpdate: true,
  },
  fix: {
    priority: 'MEDIUM',
    files: ['changelog'],
    autoUpdate: true,
  },
  perf: {
    priority: 'MEDIUM',
    files: ['changelog'],
    autoUpdate: true,
  },
  refactor: {
    priority: 'LOW',
    files: ['changelog'],
    autoUpdate: true,
  },
  docs: {
    priority: 'LOW',
    files: ['changelog'],
    autoUpdate: false, // Already docs change
  },
  test: {
    priority: 'LOW',
    files: ['changelog'],
    autoUpdate: true,
  },
};

// Patterns that indicate important changes requiring docs
const IMPORTANT_PATTERNS = [
  /api.*auth/i,
  /security/i,
  /docker/i,
  /dockerfile/i,
  /docker-compose/i,
  /env/i,
  /secret/i,
  /jwt/i,
  /password/i,
  /endpoint/i,
  /middleware/i,
];

function getRecentCommits(count = 10) {
  try {
    const output = execSync(`git log --oneline --format="%H %s" -n ${count}`, {
      encoding: 'utf-8',
      cwd: projectRoot,
    });
    return output.split('\n').filter(Boolean).map(line => {
      const match = line.match(/^([a-f0-9]+)\s+(.+)$/);
      if (!match) return null;
      const [, hash, message] = match;
      const typeMatch = message.match(/^(\w+)(?:\(([^)]+)\))?:\s+(.+)$/);
      if (!typeMatch) return { hash, message, type: 'other', scope: null, description: message };
      const [, type, scope, description] = typeMatch;
      return { hash, message, type, scope, description };
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function isImportantChange(commit) {
  // Check if commit type is important
  if (['security', 'feat', 'fix', 'perf'].includes(commit.type)) {
    return true;
  }
  
  // Check if commit message contains important patterns
  return IMPORTANT_PATTERNS.some(pattern => pattern.test(commit.message));
}

function getCurrentDate() {
  return new Date().toISOString().split('T')[0];
}

async function getLatestChangelogVersion() {
  try {
    const content = await readFile(FILES.changelog, 'utf-8');
    const match = content.match(/^###?\s+v?(\d+\.\d+\.\d+)(?:-dt418)?\s+\((\d{4}-\d{2}-\d{2})\)/m);
    return match ? { version: match[1], date: match[2] } : null;
  } catch {
    return null;
  }
}

function bumpVersion(currentVersion, type = 'patch') {
  if (!currentVersion) return '0.3.61'; // fallback
  const parts = currentVersion.split('.').map(Number);
  if (type === 'major') parts[0]++;
  else if (type === 'minor') parts[1]++;
  else parts[2]++;
  return parts.join('.');
}

function groupCommitsByType(commits) {
  const groups = {
    security: [],
    feat: [],
    fix: [],
    perf: [],
    refactor: [],
    docs: [],
    test: [],
    other: [],
  };
  
  for (const commit of commits) {
    const type = commit.type || 'other';
    if (groups[type]) {
      groups[type].push(commit);
    } else {
      groups.other.push(commit);
    }
  }
  
  return groups;
}

async function updateChangelog(commits) {
  const groups = groupCommitsByType(commits);
  
  // Only update if there are meaningful changes
  const hasChanges = ['security', 'feat', 'fix', 'perf', 'refactor', 'test'].some(
    type => groups[type].length > 0
  );
  
  if (!hasChanges) {
    console.log('No documentation-worthy changes found.');
    return false;
  }
  
  const current = await getLatestChangelogVersion();
  const newVersion = current ? bumpVersion(current.version) : '0.3.62';
  const date = getCurrentDate();
  
  let content = await readFile(FILES.changelog, 'utf-8');
  
  // Build new entry
  const sections = [];
  
  if (groups.security.length > 0) {
    const items = groups.security.map(c => `  - ${c.description}`).join('\n');
    sections.push(`#### Security\n${items}`);
  }
  
  if (groups.feat.length > 0) {
    const items = groups.feat.map(c => {
      const scope = c.scope ? ` (${c.scope})` : '';
      return `  - ${c.description}${scope}`;
    }).join('\n');
    sections.push(`#### Features\n${items}`);
  }
  
  if (groups.fix.length > 0) {
    const items = groups.fix.map(c => {
      const scope = c.scope ? ` (${c.scope})` : '';
      return `  - ${c.description}${scope}`;
    }).join('\n');
    sections.push(`#### Fixes\n${items}`);
  }
  
  if (groups.perf.length > 0) {
    const items = groups.perf.map(c => {
      const scope = c.scope ? ` (${c.scope})` : '';
      return `  - ${c.description}${scope}`;
    }).join('\n');
    sections.push(`#### Performance\n${items}`);
  }
  
  if (groups.refactor.length > 0) {
    const items = groups.refactor.map(c => {
      const scope = c.scope ? ` (${c.scope})` : '';
      return `  - ${c.description}${scope}`;
    }).join('\n');
    sections.push(`#### Changes\n${items}`);
  }
  
  if (groups.test.length > 0) {
    const items = groups.test.map(c => {
      const scope = c.scope ? ` (${c.scope})` : '';
      return `  - ${c.description}${scope}`;
    }).join('\n');
    sections.push(`#### Tests\n${items}`);
  }
  
  const newEntry = `### v${newVersion}-dt418 (${date})\n\n${sections.join('\n\n')}\n`;
  
  // Insert after the fork changes header
  const insertMarker = '## Fork Changes (dt418/9router-docker)';
  const insertIndex = content.indexOf(insertMarker);
  
  if (insertIndex !== -1) {
    const afterMarker = insertIndex + insertMarker.length;
    const nextLine = content.indexOf('\n', afterMarker);
    content = content.slice(0, nextLine + 1) + '\n' + newEntry + content.slice(nextLine + 1);
  }
  
  await writeFile(FILES.changelog, content);
  console.log(`✅ Updated CHANGELOG.md with v${newVersion}`);
  
  return true;
}

async function previewChanges(commits) {
  console.log('\n📋 Auto-Docs Preview\n');
  
  const important = commits.filter(isImportantChange);
  console.log(`Found ${important.length} important changes out of ${commits.length} recent commits:\n`);
  
  const groups = groupCommitsByType(important);
  
  for (const [type, items] of Object.entries(groups)) {
    if (items.length === 0) continue;
    const emoji = {
      security: '🔒', feat: '✨', fix: '🐛', perf: '⚡', 
      refactor: '♻️', docs: '📝', test: '🧪', other: '📦'
    }[type] || '📦';
    
    console.log(`${emoji} ${type.charAt(0).toUpperCase() + type.slice(1)}:`);
    for (const item of items) {
      console.log(`   ${item.hash.slice(0, 7)} ${item.description}`);
    }
    console.log('');
  }
  
  if (important.length === 0) {
    console.log('No important changes that require docs update.');
  }
}

async function checkDocsNeedUpdate() {
  const commits = getRecentCommits(5);
  const important = commits.filter(isImportantChange);
  
  if (important.length === 0) {
    console.log('✅ Docs are up to date');
    return false;
  }
  
  console.log('⚠️ Docs may need update for:');
  for (const commit of important) {
    console.log(`   - ${commit.description}`);
  }
  return true;
}

async function updateAndCommit() {
  const commits = getRecentCommits(10);
  const needsUpdate = await checkDocsNeedUpdate();
  
  if (!needsUpdate) {
    return;
  }
  
  console.log('\n📝 Updating documentation...\n');
  const updated = await updateChangelog(commits);
  
  if (updated) {
    try {
      execSync('git add CHANGELOG.md', { cwd: projectRoot });
      execSync('git commit --amend --no-edit', { cwd: projectRoot });
      console.log('\n✅ Documentation updated and committed');
    } catch (e) {
      console.log('\n⚠️ Could not auto-commit. Please commit manually.');
    }
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--check')) {
    await checkDocsNeedUpdate();
  } else if (args.includes('--update')) {
    await updateAndCommit();
  } else if (args.includes('--preview')) {
    const commits = getRecentCommits(10);
    await previewChanges(commits);
  } else {
    // Default: preview
    const commits = getRecentCommits(10);
    await previewChanges(commits);
  }
}

main().catch(console.error);
