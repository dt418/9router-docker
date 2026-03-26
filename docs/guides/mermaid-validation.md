# Mermaid Validation Workflow

Automated validation of Mermaid diagrams in markdown documentation using @probelabs/maid.

## Overview

This workflow ensures all Mermaid diagrams in documentation are syntactically correct and compatible with GitHub's renderer.

## Components

### 1. GitHub Actions (`.github/workflows/mermaid-validate.yml`)

Automatically validates Mermaid diagrams on:
- Push to `main` when docs change
- Pull requests with documentation changes

Features:
- Installs `@probelabs/maid` for validation
- Validates all markdown files with mermaid blocks
- Comments on PRs with validation results

### 2. Lefthook (`.lefthook.yml`)

Pre-commit validation runs automatically before every commit.

Commands:
- `mermaid-check` - Validates staged markdown files
- `markdown-lint` - Lints markdown for style issues

### 3. Agent Skill (`.agents/skills/mermaid-validator/SKILL.md`)

Provides AI agents with:
- Validation commands
- Common error fixes
- Integration examples

## Usage

### Local Development

```bash
# Install dependencies
npm install

# Validate all documentation
for f in docs/*.md; do
  npx @probelabs/maid "$f"
done

# Or validate specific file
npx @probelabs/maid docs/DIAGRAMS.md
```

### CI/CD

Workflow automatically runs on GitHub Actions.

### Pre-commit

Hooks run automatically on every commit:
```bash
git commit -m "Update documentation"
# Automatically validates mermaid diagrams
```

## Common Fixes

| Error | Fix |
|-------|-----|
| `FL-LABEL-PARENS-UNQUOTED` | Quote label: `A[name (desc)]` → `A["name (desc)"]` |
| `FL-LABEL-SLASH-UNQUOTED` | Quote label: `A[/path]` → `A["/path"]` |
| `FL-ARROW-INVALID` | Use `-->`: `A -> B` → `A --> B` |
| `FL-LABEL-BRACKET-IN-UNQUOTED` | Quote: `A[items[]]` → `A["items[]"]` or `A[items&#91;&#93;]` |

## Status Indicators

- ✅ **Pass** - All diagrams valid
- ⚠️ **Warning** - Non-critical issues (e.g., sequence diagram activation)
- ❌ **Error** - Syntax errors that need fixing

## Files

```
.github/workflows/mermaid-validate.yml   # CI workflow
.agents/skills/mermaid-validator/        # Agent skill
lefthook.yml                              # Pre-commit hooks
```

## Integration with Project Checker

The project checker (`project-checker` skill) now includes mermaid validation:

```bash
./scripts/project-check.sh
# Runs: build → lint → test → mermaid-validate
```