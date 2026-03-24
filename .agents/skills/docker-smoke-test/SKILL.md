---
name: docker-smoke-test
description: Automatically build Docker image, run smoke tests via docker-compose, and verify all changes are working correctly. Use when user asks to test docker, verify container, smoke test, or check if changes work in containerized environment.
compatibility:
  - docker
  - docker-compose
  - curl
---

# Docker Smoke Test

Automatically build Docker image, run smoke tests via docker-compose, and verify changes are working correctly.

## Workflow

### 1. Build Docker Image
```bash
cd /home/thanhd/9router && docker compose build --no-cache
```
Check for build errors. Report success or failure immediately.

### 2. Start Container
```bash
cd /home/thanhd/9router && docker compose up -d && sleep 8
```
Wait for container to be ready.

### 3. Get Container IP
```bash
docker inspect 9router --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
```

### 4. Run Smoke Tests

Execute these tests in order:

#### Test 1: Health Check
```bash
docker exec 9router wget -q --spider -O /dev/null http://127.0.0.1:20128
echo "Health check: $?"
```

#### Test 2: Public Endpoint
```bash
curl -s http://<CONTAINER_IP>:20128/api/version | grep -q "currentVersion"
echo "Public endpoint: $?"
```

#### Test 3: Protected POST - No Auth (Should return 401)
```bash
result=$(curl -s -w "%{http_code}" -o /dev/null -X POST http://<CONTAINER_IP>:20128/api/providers -H "Content-Type: application/json" -d '{"provider":"openai","apiKey":"test","name":"test"}')
[ "$result" = "401" ]
echo "Protected endpoint (no auth): $?"
```

#### Test 4: Protected POST - With Fake Auth (Should return 401)
```bash
result=$(curl -s -w "%{http_code}" -o /dev/null -X POST http://<CONTAINER_IP>:20128/api/providers -H "Content-Type: application/json" -H "Cookie: auth_token=fake" -d '{"provider":"openai","apiKey":"test","name":"test"}')
[ "$result" = "401" ]
echo "Protected endpoint (fake auth): $?"
```

#### Test 5: Login and Test Authenticated Request
```bash
# Login to get auth token
TOKEN=$(curl -s -X POST http://<CONTAINER_IP>:20128/api/auth/login -H "Content-Type: application/json" -d '{"password":"ChangeMe123!"}' -c - | grep auth_token | awk '{print $7}')

# Test protected endpoint with valid token
result=$(curl -s -w "%{http_code}" -o /dev/null -X POST http://<CONTAINER_IP>:20128/api/providers -H "Content-Type: application/json" -H "Cookie: auth_token=$TOKEN" -d '{"provider":"openai","apiKey":"test","name":"test-auth"}')
echo "Authenticated request: $result"
```

#### Test 6: Test Shutdown Endpoint (Should be 401 without auth)
```bash
result=$(curl -s -w "%{http_code}" -o /dev/null -X POST http://<CONTAINER_IP>:20128/api/shutdown)
# If 401, good - if 200, bad (shutdown endpoint is not protected)
echo "Shutdown endpoint: $result"
```

#### Test 7: Test Settings Endpoint (Should be 401 without auth)
```bash
result=$(curl -s -w "%{http_code}" -o /dev/null -X PATCH http://<CONTAINER_IP>:20128/api/settings -H "Content-Type: application/json" -d '{}')
[ "$result" = "401" ]
echo "Settings endpoint: $?"
```

#### Test 8: Test Combos Endpoint (Should be 401 without auth)
```bash
result=$(curl -s -w "%{http_code}" -o /dev/null -X POST http://<CONTAINER_IP>:20128/api/combos -H "Content-Type: application/json" -d '{"name":"test-combo"}')
[ "$result" = "401" ]
echo "Combos endpoint: $?"
```

### 5. Cleanup
```bash
cd /home/thanhd/9router && docker compose down
```

### 6. Provide Report

Format the report as:
```
## Docker Smoke Test Results

### Build: ✅ PASS / ❌ FAIL
[summary]

### Container Start: ✅ PASS / ❌ FAIL
[container status]

### Smoke Tests:
| Test | Status |
|------|--------|
| Health Check | ✅/❌ |
| Public Endpoint | ✅/❌ |
| Protected POST (no auth) | ✅/❌ |
| Protected POST (fake auth) | ✅/❌ |
| Authenticated Request | ✅/❌ |
| Shutdown Endpoint | ✅/❌ |
| Settings Endpoint | ✅/❌ |
| Combos Endpoint | ✅/❌ |

## Summary
[overall assessment]
```

## Error Handling

If any step fails:
1. Report the failure immediately with error message
2. Run docker compose down to cleanup
3. Ask user if they want to fix before continuing

## Context

This skill verifies:
- Docker build works correctly
- Container starts successfully
- Public endpoints (like /api/version) work
- Protected endpoints return 401 without authentication
- Protected endpoints accept authenticated requests
- Specific security changes are working (JWT auth on management APIs)

The container IP is needed because Traefik may route requests differently than direct container access.