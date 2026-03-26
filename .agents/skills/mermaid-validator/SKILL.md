---
name: mermaid-validator
description: Validate Mermaid diagrams in markdown files using @probelabs/maid. Use when user asks to validate mermaid, check diagrams, or validate markdown documentation.
compatibility:
  - npm
  - node
  - markdown
---

# Mermaid Validator

Validate Mermaid diagrams in markdown files using @probelabs/maid for GitHub-compatible rendering.

## When to Use

- User asks to "validate mermaid", "check diagrams", or "validate markdown"
- Before committing markdown files with mermaid diagrams
- During code review of documentation changes
- Running project checker with mermaid validation

## Workflow

### 1. Install Dependency (if not available)

```bash
npm install -D @probelabs/maid
```

### 2. Find Markdown Files with Mermaid

```bash
find docs -name "*.md" -exec grep -l '```mermaid' {} \;
```

### 3. Validate Each File

```bash
npx @probelabs/maid <file>
```

### 4. Fix Common Issues

If validation fails, fix these common issues:

#### Issue: Unquoted Pipe in Node Labels
```mermaid
graph LR
    A[text|description]  ❌ Invalid
    A["text|description"]  ✅ Quoted
```

#### Issue: Unquoted Parentheses in Subgraph Labels
```mermaid
subgraph Name[Name (description)]  ❌ Invalid
subgraph Name["Name (description)"]  ✅ Quoted
```

#### Issue: Unquoted Leading Slashes
```mermaid
A[/path]  ❌ Invalid
A["/path"]  ✅ Quoted
```

#### Issue: Invalid Arrow Syntax
```mermaid
A -> B  ❌ Invalid
A --> B  ✅ Valid

A -> B -> C  ❌ Invalid
A --> B --> C  ✅ Valid
```

#### Issue: Arrow in Node Label Text
```mermaid
A[text -> value]  ❌ Invalid
A[text to value]  ✅ Replace with "to"
```

#### Issue: Square Brackets in Node Labels
```mermaid
A[items[]]  ❌ Invalid
A["items[]"]  ✅ Quoted
A[items&#91;&#93;]  ✅ HTML entities
```

## Command Examples

### Validate Single File
```bash
npx @probelabs/maid docs/DIAGRAMS.md
```

### Validate All Documentation
```bash
for f in docs/*.md; do npx @probelabs/maid "$f"; done
```

### Validate with Glob
```bash
npx @probelabs/maid "docs/**/*.md"
```

## Exit Codes

- `0` - All diagrams valid
- `1` - Validation errors found

## Integration

### GitHub Actions
See `.github/workflows/mermaid-validate.yml`

### Lefthook
In `lefthook.yml`:
```yaml
mermaid-check:
  glob: "docs/**/*.md"
  run: |
    echo "Validating Mermaid diagrams..."
    npx @probelabs/maid {staged_files}
```

## Notes

- @probelabs/maid is stricter than GitHub's renderer - it catches issues before rendering
- Some warnings (like sequence diagram activation) are acceptable
- Always validate before committing markdown with diagrams