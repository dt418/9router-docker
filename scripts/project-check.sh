#!/bin/bash
# Project Checker Script for 9Router
# Usage: ./scripts/project-check.sh [--full]
#   --full    Include lint check (default: build + tests only)

set -e
set -o pipefail

FULL_CHECK=false
if [ "$1" = "--full" ]; then
	FULL_CHECK=true
fi

echo "========================================"
echo "  9Router Project Checker"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall status
BUILD_STATUS=0
LINT_STATUS=0
TEST_STATUS=0

# 1. Build
echo "📦 Running build..."
echo "----------------------------------------"
if npm run build 2>&1 | tail -10; then
	echo -e "${GREEN}✅ Build: PASS${NC}"
else
	echo -e "${RED}❌ Build: FAIL${NC}"
	BUILD_STATUS=1
fi
echo ""

# 2. Lint (optional)
if [ "$FULL_CHECK" = true ]; then
	echo "🔍 Running lint..."
	echo "----------------------------------------"
	if npx eslint . 2>&1 | head -30; then
		echo -e "${GREEN}✅ Lint: PASS${NC}"
	else
		echo -e "${YELLOW}⚠️ Lint: WARNINGS${NC}"
		LINT_STATUS=1
	fi
	echo ""
fi

# 3. Tests
echo "🧪 Running tests..."
echo "----------------------------------------"
if npx vitest run 2>&1 | tail -20; then
	echo -e "${GREEN}✅ Tests: PASS${NC}"
else
	echo -e "${RED}❌ Tests: FAIL${NC}"
	TEST_STATUS=1
fi
echo ""

# 4. Git Status (if in git repo)
if [ -d .git ]; then
	echo "📝 Git Status"
	echo "----------------------------------------"
	git status --short
	echo ""
fi

# Summary
echo "========================================"
echo "  Summary"
echo "========================================"
if [ $BUILD_STATUS -eq 0 ]; then
	echo -e "Build:  ${GREEN}✅ PASS${NC}"
else
	echo -e "Build:  ${RED}❌ FAIL${NC}"
fi

if [ "$FULL_CHECK" = true ]; then
	if [ $LINT_STATUS -eq 0 ]; then
		echo -e "Lint:   ${GREEN}✅ PASS${NC}"
	else
		echo -e "Lint:   ${YELLOW}⚠️ WARNINGS${NC}"
	fi
fi

if [ $TEST_STATUS -eq 0 ]; then
	echo -e "Tests:  ${GREEN}✅ PASS${NC}"
else
	echo -e "Tests:  ${RED}❌ FAIL${NC}"
fi
echo ""

# Exit with error if any failed
if [ $BUILD_STATUS -ne 0 ] || [ $TEST_STATUS -ne 0 ]; then
	exit 1
fi
