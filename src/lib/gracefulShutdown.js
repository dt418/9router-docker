let isShuttingDown = false;
let activeRequests = 0;
const shutdownCallbacks = [];

export function initGracefulShutdown() {
  const gracefulShutdown = async (signal) => {
    if (isShuttingDown) {
      console.log(`[Shutdown] Already shutting down, ignoring ${signal}`);
      return;
    }

    isShuttingDown = true;
    console.log(`[Shutdown] Received ${signal}. Starting graceful shutdown...`);

    const forceTimeout = setTimeout(() => {
      console.error('[Shutdown] Forced shutdown after timeout');
      process.exit(1);
    }, 30000);

    try {
      console.log('[Shutdown] Stopping new request acceptance');

      if (activeRequests > 0) {
        console.log(`[Shutdown] Waiting for ${activeRequests} active requests to complete`);
        await new Promise((resolve) => {
          const checkInterval = setInterval(() => {
            if (activeRequests === 0) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);

          setTimeout(() => {
            clearInterval(checkInterval);
            resolve();
          }, 15000);
        });
      }

      console.log('[Shutdown] Running cleanup callbacks');
      for (const callback of shutdownCallbacks) {
        try {
          await callback();
        } catch (error) {
          console.error('[Shutdown] Cleanup callback error:', error);
        }
      }

      console.log('[Shutdown] Graceful shutdown complete');
      clearTimeout(forceTimeout);
      process.exit(0);

    } catch (error) {
      console.error('[Shutdown] Error during shutdown:', error);
      clearTimeout(forceTimeout);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  process.on('uncaughtException', (error) => {
    console.error('[Shutdown] Uncaught exception:', error);
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Shutdown] Unhandled rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
  });
}

export function trackRequestStart() {
  if (isShuttingDown) {
    throw new Error('Server is shutting down');
  }
  activeRequests++;
  return () => {
    activeRequests--;
  };
}

export function addShutdownCallback(callback) {
  shutdownCallbacks.push(callback);
}

export function isServerShuttingDown() {
  return isShuttingDown;
}

export function getActiveRequestCount() {
  return activeRequests;
}