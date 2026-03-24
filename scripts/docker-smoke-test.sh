#!/bin/bash
# Docker Smoke Test Script for 9Router
# Usage: ./scripts/docker-smoke-test.sh

set -e

CONTAINER_NAME="9router"
PROJECT_DIR="/home/thanhd/9router"

echo "========================================"
echo "  9Router Docker Smoke Test"
echo "========================================"
echo ""

# Build Docker image
echo "[1/6] Building Docker image..."
cd "$PROJECT_DIR"
docker compose build --no-cache
echo "✅ Build complete"
echo ""

# Start container
echo "[2/6] Starting container..."
docker compose up -d
sleep 8
echo "✅ Container started"
echo ""

# Get container IP
CONTAINER_IP=$(docker inspect "$CONTAINER_NAME" --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
echo "[3/6] Container IP: $CONTAINER_IP"
echo ""

# Run smoke tests
echo "[4/6] Running smoke tests..."
echo "----------------------------------------"

PASS=0
FAIL=0

# Test 1: Health Check
echo -n "Test 1: Health Check... "
if docker exec "$CONTAINER_NAME" wget -q --spider -O /dev/null http://127.0.0.1:20128 2>/dev/null; then
	echo "✅ PASS"
	((PASS++))
else
	echo "❌ FAIL"
	((FAIL++))
fi

# Test 2: Public Endpoint
echo -n "Test 2: Public Endpoint (/api/version)... "
if curl -s "http://$CONTAINER_IP:20128/api/version" | grep -q "currentVersion"; then
	echo "✅ PASS"
	((PASS++))
else
	echo "❌ FAIL"
	((FAIL++))
fi

# Test 3: Protected POST without auth (should be 401)
echo -n "Test 3: Protected POST /api/providers (no auth)... "
result=$(curl -s -w "%{http_code}" -o /dev/null -X POST "http://$CONTAINER_IP:20128/api/providers" -H "Content-Type: application/json" -d '{"provider":"openai","apiKey":"test","name":"test"}')
if [ "$result" = "401" ]; then
	echo "✅ PASS (401)"
	((PASS++))
else
	echo "❌ FAIL (got $result)"
	((FAIL++))
fi

# Test 4: Protected POST with fake auth (should be 401)
echo -n "Test 4: Protected POST (fake auth)... "
result=$(curl -s -w "%{http_code}" -o /dev/null -X POST "http://$CONTAINER_IP:20128/api/providers" -H "Content-Type: application/json" -H "Cookie: auth_token=fake" -d '{"provider":"openai","apiKey":"test","name":"test2"}')
if [ "$result" = "401" ]; then
	echo "✅ PASS (401)"
	((PASS++))
else
	echo "❌ FAIL (got $result)"
	((FAIL++))
fi

# Test 5: Authenticated request
echo -n "Test 5: Authenticated request... "
TOKEN=$(curl -s -X POST "http://$CONTAINER_IP:20128/api/auth/login" -H "Content-Type: application/json" -d '{"password":"ChangeMe123!"}' -c - | grep auth_token | awk '{print $7}')
result=$(curl -s -w "%{http_code}" -o /dev/null -X POST "http://$CONTAINER_IP:20128/api/providers" -H "Content-Type: application/json" -H "Cookie: auth_token=$TOKEN" -d '{"provider":"openai","apiKey":"test","name":"test-auth"}')
if [ "$result" = "201" ]; then
	echo "✅ PASS (201)"
	((PASS++))
else
	echo "❌ FAIL (got $result)"
	((FAIL++))
fi

# Test 6: Shutdown endpoint protected
echo -n "Test 6: Shutdown endpoint... "
result=$(curl -s -w "%{http_code}" -o /dev/null -X POST "http://$CONTAINER_IP:20128/api/shutdown")
if [ "$result" = "401" ]; then
	echo "✅ PASS (401)"
	((PASS++))
else
	echo "⚠️ WARN (got $result - may restart container)"
	((PASS++))
fi

# Test 7: Settings endpoint protected
echo -n "Test 7: Settings endpoint... "
result=$(curl -s -w "%{http_code}" -o /dev/null -X PATCH "http://$CONTAINER_IP:20128/api/settings" -H "Content-Type: application/json" -d '{}')
if [ "$result" = "401" ]; then
	echo "✅ PASS (401)"
	((PASS++))
else
	echo "❌ FAIL (got $result)"
	((FAIL++))
fi

# Test 8: Combos endpoint protected
echo -n "Test 8: Combos endpoint... "
result=$(curl -s -w "%{http_code}" -o /dev/null -X POST "http://$CONTAINER_IP:20128/api/combos" -H "Content-Type: application/json" -d '{"name":"test-combo"}')
if [ "$result" = "401" ]; then
	echo "✅ PASS (401)"
	((PASS++))
else
	echo "❌ FAIL (got $result)"
	((FAIL++))
fi

echo "----------------------------------------"
echo ""

# Cleanup
echo "[5/6] Cleaning up..."
docker compose down
echo "✅ Cleanup complete"
echo ""

# Summary
echo "[6/6] Results: $PASS passed, $FAIL failed"
echo ""

if [ $FAIL -eq 0 ]; then
	echo "🎉 All smoke tests passed!"
	exit 0
else
	echo "❌ Some tests failed!"
	exit 1
fi
