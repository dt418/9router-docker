# DocSync Agent/Skill Specification

## Overview
Tự động sync tài liệu (CHANGELOG.md, README.md, API docs) với code changes qua local git hook và GitHub Actions.

## Components

### 1. Git Hook (`scripts/git-hooks/prepare-commit-msg`)
- Hook vào `prepare-commit-msg` (chạy sau khi viết message, trước khi commit hoàn tất)
- Detect các file thay đổi trong commit
- Parse commit message theo conventional commits
- Gọi sync script để generate doc updates
- Hiển thị preview nếu có changes
- Auto-commit nếu có flag `--docs-auto`

### 2. Sync Script (`scripts/docs-sync.js`)
```javascript
// Chức năng chính:
- parseCommits(fromHash, toHash) // Lấy commits trong range
- generateChangelog(commits)     // Tạo changelog entries
- updateChangelog(entries)       // Cập nhật CHANGELOG.md
- updateReadme(commits)          // Cập nhật README.md nếu cần
- updateApiDocs(commits)         // Cập nhật API docs nếu có thay đổi
- preview()                     // Hiển thị changes không commit
- autoCommit()                  // Tạo commit với doc changes
```

### 3. GitHub Actions (`.github/workflows/docs-sync.yml`)
```yaml
on:
  push:
    branches: [main, master]
  workflow_dispatch:

jobs:
  docs-sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.ref }}
          fetch-depth: 0
      - name: Run docs sync
        run: node scripts/docs-sync.js --auto
      - name: Commit changes
        run: |
          git config --local user.email "github-actions[bot]@users.noreply.github.com"
          git config --local user.name "github-actions[bot]"
          git add -A
          git diff --staged --quiet && exit 0
          git commit -m "docs: auto-sync documentation"
          git push
```

## Conventional Commits Parser
| Type | Destination |
|------|-------------|
| `feat:` | CHANGELOG.md → Features section |
| `fix:` | CHANGELOG.md → Fixes section |
| `docs:` | README.md, docs/*.md |
| `refactor:` | CHANGELOG.md → Changes section |
| `chore:` | Skip (internal only) |

## File Locations to Update
1. `CHANGELOG.md` - Tất cả feature/fix changes
2. `README.md` - Nếu có `docs:` hoặc thay đổi installation/usage
3. `docs/guides/*.md` - Theo mapping trong config

## Usage

### Local (Git Hook)
```bash
# Preview only (mặc định)
git commit -m "feat: add new provider"

# Auto-commit docs
git commit -m "feat: add new provider" -- --docs-auto
```

### Manual
```bash
node scripts/docs-sync.js --preview
node scripts/docs-sync.js --auto
node scripts/docs-sync.js --from=v0.3.60
```

## Acceptance Criteria
1. ✅ Git hook install được qua script
2. ✅ Parse đúng conventional commits
3. ✅ Update CHANGELOG.md với đúng format
4. ✅ Preview mode hiển thị changes
5. ✅ Auto-commit tạo commit với message "docs: auto-sync documentation"
6. ✅ GitHub Actions workflow chạy được
7. ✅ Không infinite loop (tránh trigger lại khi push)
