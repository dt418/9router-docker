import { NextResponse } from 'next/server';

const MEMORY_WARNING_THRESHOLD = parseInt(process.env.HEALTH_MEMORY_THRESHOLD_MB || '500', 10) * 1024 * 1024;

export async function GET() {
  const startTime = Date.now();
  const checks = {};

  const memoryUsage = process.memoryUsage();
  checks.memory = {
    status: memoryUsage.heapUsed < MEMORY_WARNING_THRESHOLD ? 'ok' : 'warning',
    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
    rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB'
  };

  checks.uptime = {
    status: 'ok',
    seconds: Math.floor(process.uptime()),
    human: formatUptime(process.uptime())
  };

  checks.environment = {
    status: 'ok',
    nodeVersion: process.version,
    env: process.env.NODE_ENV || 'development',
    platform: process.platform,
    arch: process.arch
  };

  const hasError = Object.values(checks).some(check => check.status === 'error');
  const hasWarning = Object.values(checks).some(check => check.status === 'warning');

  let overallStatus;
  if (hasError) {
    overallStatus = 'error';
  } else if (hasWarning) {
    overallStatus = 'warning';
  } else {
    overallStatus = 'healthy';
  }

  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.0.0',
    checks,
    duration: Date.now() - startTime + 'ms'
  };

  return NextResponse.json(response, {
    status: hasError ? 503 : 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Health-Check': 'true'
    }
  });
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const secs = Math.floor(seconds % 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export async function HEAD() {
  return NextResponse.json({ status: 'ok' }, { status: 200 });
}