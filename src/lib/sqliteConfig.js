export function createOptimizedDatabase(dbPath, db = null) {
  if (!db) return null;

  try {
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -64000');
    db.pragma('temp_store = MEMORY');
    db.pragma('mmap_size = 268435456');
    db.pragma('busy_timeout = 5000');

    return db;
  } catch (error) {
    console.error('[SQLite Config] Failed to apply pragmas:', error.message);
    return db;
  }
}

export function setupWALCheckpoint(db, intervalMs = 300000) {
  if (!db) return;

  setInterval(() => {
    try {
      const result = db.pragma('wal_checkpoint(TRUNCATE)');
      if (result[0].busy > 0) {
        console.warn(`[SQLite] WAL checkpoint had ${result[0].busy} busy pages`);
      }
    } catch (error) {
      console.error('[SQLite] WAL checkpoint failed:', error);
    }
  }, intervalMs);
}

export function getDatabaseStats(db) {
  if (!db) return null;

  try {
    return {
      journalMode: db.pragma('journal_mode')[0].journal_mode,
      synchronous: db.pragma('synchronous')[0].synchronous,
      cacheSize: db.pragma('cache_size')[0].cache_size,
      busyTimeout: db.pragma('busy_timeout')[0].busy_timeout,
    };
  } catch (error) {
    return { error: error.message };
  }
}