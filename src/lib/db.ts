import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { TURKISH_CHANNELS } from "./turkish-channels";

export interface StreamRow {
  id: string;
  title: string;
  normalized_title?: string | null;
  type: string;
  category?: string | null;
  stream_url: string;
  poster_image_url?: string | null;
  resolution?: string | null;
  source?: string | null;
  source_website?: string | null;
  custom_headers?: Record<string, string> | string;
  failover_group?: string | null;
  status: string;
  failure_count: number;
  last_checked_at?: string | null;
  last_pushed_at?: string | null;
  choicely_id?: string | null;
  is_active: number | boolean;
  bitrate_kbps?: number | null;
  quality_tier?: string | null;
  variants?: any[] | string;
  response_ms?: number | null;
  priority: number;
  geo_country?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LogRow {
  id?: number;
  level: string;
  phase: string;
  message: string;
  meta?: any;
  created_at?: string;
}

export interface QueryRow {
  id: string;
  query: string;
  engine: string;
  active: number | boolean;
  hit_count: number;
  last_run_at?: string | null;
  created_at: string;
}

export interface ProxyRow {
  id: string;
  label: string;
  template: string;
  country?: string | null;
  success_count: number;
  fail_count: number;
  ban_count: number;
  active: number | boolean;
  created_at: string;
}

export interface ApiClientRow {
  id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  ip_whitelist: string[] | string;
  rate_limit_per_min: number;
  active: number | boolean;
  request_count: number;
  last_used_at?: string | null;
  created_at: string;
}

export interface WebhookRow {
  id: string;
  name: string;
  kind: string;
  url: string;
  telegram_chat_id?: string | null;
  events: string[] | string;
  active: number | boolean;
  last_status?: number | null;
  created_at: string;
}

export interface EpgSourceRow {
  id: string;
  url: string;
  active: number | boolean;
  last_synced_at?: string | null;
  program_count: number;
  created_at: string;
}

export interface CrawlJobRow {
  id: string;
  url: string;
  referer?: string | null;
  depth: number;
  status: string;
  attempts: number;
  error?: string | null;
  locked_at?: string | null;
  finished_at?: string | null;
  created_at: string;
}

let sqliteDbInstance: DatabaseSync | null = null;
let transactionCounter = 0;

export function withTransaction<T>(db: DatabaseSync, fn: () => T): T {
  const savepoint = `sp_${Date.now()}_${++transactionCounter}`;
  db.exec(`SAVEPOINT ${savepoint};`);
  try {
    const result = fn();
    db.exec(`RELEASE SAVEPOINT ${savepoint};`);
    return result;
  } catch (err) {
    try {
      db.exec(`ROLLBACK TO SAVEPOINT ${savepoint};`);
      db.exec(`RELEASE SAVEPOINT ${savepoint};`);
    } catch {
      try {
        db.exec("ROLLBACK;");
      } catch {}
    }
    throw err;
  }
}

export function getRawDb(): DatabaseSync {
  if (sqliteDbInstance) return sqliteDbInstance;

  const dataDir = path.resolve(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, "streams.db");
  const db = new DatabaseSync(dbPath);

  // Set busy timeout so concurrent processes wait instead of locking
  try {
    db.exec("PRAGMA busy_timeout = 5000;");
  } catch {}

  // Clean up any stale transaction state if left over from a previous error
  try {
    db.exec("ROLLBACK;");
  } catch {}

  try {
    db.exec("PRAGMA journal_mode = WAL;");
  } catch {}
  try {
    db.exec("PRAGMA synchronous = NORMAL;");
  } catch {}
  try {
    db.exec("PRAGMA foreign_keys = ON;");
  } catch {}
  try {
    db.exec("PRAGMA cache_size = -64000;"); // 64MB cache
  } catch {}

  initSchema(db);
  seedIfEmpty(db);

  sqliteDbInstance = db;
  return db;
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS autonomous_streams (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      normalized_title TEXT,
      type TEXT NOT NULL DEFAULT 'live_tv',
      category TEXT,
      stream_url TEXT UNIQUE NOT NULL,
      poster_image_url TEXT,
      resolution TEXT,
      source TEXT,
      source_website TEXT,
      custom_headers TEXT DEFAULT '{}',
      failover_group TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      failure_count INTEGER NOT NULL DEFAULT 0,
      last_checked_at TEXT,
      last_pushed_at TEXT,
      choicely_id TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      bitrate_kbps INTEGER,
      quality_tier TEXT,
      variants TEXT DEFAULT '[]',
      response_ms INTEGER,
      priority INTEGER NOT NULL DEFAULT 0,
      geo_country TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_streams_status ON autonomous_streams(status);
    CREATE INDEX IF NOT EXISTS idx_streams_category ON autonomous_streams(category);
    CREATE INDEX IF NOT EXISTS idx_streams_tier ON autonomous_streams(quality_tier);
    CREATE INDEX IF NOT EXISTS idx_streams_priority ON autonomous_streams(priority DESC);
    CREATE INDEX IF NOT EXISTS idx_streams_type ON autonomous_streams(type);
    CREATE INDEX IF NOT EXISTS idx_streams_failover ON autonomous_streams(failover_group);

    CREATE TABLE IF NOT EXISTS discovery_queries (
      id TEXT PRIMARY KEY,
      query TEXT NOT NULL,
      engine TEXT NOT NULL DEFAULT 'duckduckgo',
      active INTEGER NOT NULL DEFAULT 1,
      hit_count INTEGER NOT NULL DEFAULT 0,
      last_run_at TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      UNIQUE(engine, query)
    );

    CREATE TABLE IF NOT EXISTS scraper_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL DEFAULT 'info',
      phase TEXT NOT NULL,
      message TEXT NOT NULL,
      meta TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE INDEX IF NOT EXISTS idx_logs_created ON scraper_logs(created_at DESC);

    CREATE TABLE IF NOT EXISTS proxies (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      template TEXT NOT NULL,
      country TEXT,
      success_count INTEGER NOT NULL DEFAULT 0,
      fail_count INTEGER NOT NULL DEFAULT 0,
      ban_count INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS api_clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      key_prefix TEXT NOT NULL,
      ip_whitelist TEXT NOT NULL DEFAULT '[]',
      rate_limit_per_min INTEGER NOT NULL DEFAULT 60,
      active INTEGER NOT NULL DEFAULT 1,
      request_count INTEGER NOT NULL DEFAULT 0,
      last_used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS api_rate_buckets (
      client_id TEXT NOT NULL,
      window_start TEXT NOT NULL,
      hits INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (client_id, window_start)
    );

    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'generic',
      url TEXT NOT NULL,
      telegram_chat_id TEXT,
      events TEXT NOT NULL DEFAULT '["stream_down","new_source","run_failed"]',
      active INTEGER NOT NULL DEFAULT 1,
      last_status INTEGER,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS crawl_jobs (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      referer TEXT,
      depth INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'queued',
      attempts INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      locked_at TEXT,
      finished_at TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON crawl_jobs(status, created_at);

    CREATE TABLE IF NOT EXISTS epg_sources (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1,
      last_synced_at TEXT,
      program_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS epg_programs (
      id TEXT PRIMARY KEY,
      channel_key TEXT NOT NULL,
      channel_name TEXT,
      title TEXT NOT NULL,
      description TEXT,
      start_at TEXT NOT NULL,
      stop_at TEXT NOT NULL,
      UNIQUE(channel_key, start_at)
    );
    CREATE INDEX IF NOT EXISTS idx_epg_stop ON epg_programs(stop_at);

    CREATE TABLE IF NOT EXISTS engine_metrics (
      id TEXT PRIMARY KEY,
      ts TEXT NOT NULL,
      kind TEXT NOT NULL,
      requests INTEGER NOT NULL DEFAULT 0,
      success INTEGER NOT NULL DEFAULT 0,
      failed INTEGER NOT NULL DEFAULT 0,
      banned INTEGER NOT NULL DEFAULT 0,
      avg_ms INTEGER NOT NULL DEFAULT 0,
      found INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_metrics_ts ON engine_metrics(ts DESC);

    CREATE TABLE IF NOT EXISTS feed_cache (
      key TEXT PRIMARY KEY,
      body TEXT NOT NULL,
      content_type TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS engine_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      user_id TEXT PRIMARY KEY,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pool_sites (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'auto',
      active INTEGER NOT NULL DEFAULT 1,
      last_crawled_at TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

export function seedTurkishChannels(db: DatabaseSync) {
  try {
    const insert = db.prepare(`
      INSERT OR REPLACE INTO autonomous_streams (
        id, title, normalized_title, type, category, stream_url, poster_image_url,
        resolution, source, source_website, custom_headers, failover_group, status,
        failure_count, last_checked_at, is_active, quality_tier, priority, geo_country,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    withTransaction(db, () => {
      const now = new Date().toISOString();
      for (const c of TURKISH_CHANNELS) {
        insert.run(
          c.id,
          c.title,
          c.title.toLowerCase().replace(/[^a-z0-9]/g, ""),
          c.type,
          c.category,
          c.stream_url,
          c.poster_image_url || null,
          c.resolution,
          c.source,
          c.source_website,
          c.custom_headers ? JSON.stringify(c.custom_headers) : "{}",
          c.title.toLowerCase().replace(/[^a-z0-9]/g, ""),
          "active",
          0,
          now,
          1,
          c.quality_tier,
          c.priority,
          "TR",
          now,
          now
        );
      }
    });
    console.log(`[DB] Successfully loaded/updated ${TURKISH_CHANNELS.length} verified Turkish live channels.`);
  } catch (err) {
    console.error("[DB] Error loading Turkish channels:", err);
  }
}

function seedIfEmpty(db: DatabaseSync) {
  // Check default settings
  const tokenRow = db.prepare("SELECT value FROM engine_settings WHERE key = 'cron_token'").get() as { value?: string } | undefined;
  if (!tokenRow) {
    db.prepare("INSERT OR REPLACE INTO engine_settings (key, value, updated_at) VALUES ('cron_token', 'cron_live_core_stream_engine_token_2026', ?)").run(new Date().toISOString());
  }

  // Check admin user role
  const adminRow = db.prepare("SELECT user_id FROM user_roles WHERE role = 'admin' LIMIT 1").get();
  if (!adminRow) {
    db.prepare("INSERT OR REPLACE INTO user_roles (user_id, role, created_at) VALUES ('admin_local_user', 'admin', ?)").run(new Date().toISOString());
  }

  // Check streams count
  const streamCount = (db.prepare("SELECT count(*) as c FROM autonomous_streams").get() as { c: number }).c;
  if (streamCount === 0) {
    const backupPath = path.resolve(process.cwd(), "data/backup/autonomous_streams.json");
    if (fs.existsSync(backupPath)) {
      try {
        console.log("[DB] Seeding autonomous_streams from backup...");
        const raw = fs.readFileSync(backupPath, "utf-8");
        const items = JSON.parse(raw);
        const insert = db.prepare(`
          INSERT OR REPLACE INTO autonomous_streams (
            id, title, normalized_title, type, category, stream_url, poster_image_url,
            resolution, source, source_website, custom_headers, failover_group, status,
            failure_count, last_checked_at, last_pushed_at, choicely_id, is_active,
            bitrate_kbps, quality_tier, variants, response_ms, priority, geo_country,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        withTransaction(db, () => {
          for (const s of items) {
            let title = s.title || "Untitled";
            let category = s.category || null;
            let geo_country = s.geo_country || null;
            let priority = s.priority || 0;
            const urlLower = (s.stream_url || "").toLowerCase();

            // Intelligent pre-resolution for cryptic / unknown Turkish streams
            if (urlLower.includes("trt1") || urlLower.includes("trt_1")) {
              title = "TRT 1 HD"; category = "Ulusal"; geo_country = "TR"; priority = Math.max(priority, 90);
            } else if (urlLower.includes("trthaber")) {
              title = "TRT Haber HD"; category = "Haber"; geo_country = "TR"; priority = Math.max(priority, 90);
            } else if (urlLower.includes("trtspor")) {
              title = "TRT Spor HD"; category = "Spor"; geo_country = "TR"; priority = Math.max(priority, 90);
            } else if (urlLower.includes("trtcocuk")) {
              title = "TRT Çocuk HD"; category = "Çocuk"; geo_country = "TR"; priority = Math.max(priority, 85);
            } else if (urlLower.includes("trtbelgesel")) {
              title = "TRT Belgesel HD"; category = "Belgesel"; geo_country = "TR"; priority = Math.max(priority, 85);
            } else if (urlLower.includes("trtworld")) {
              title = "TRT World FHD"; category = "Haber"; geo_country = "TR"; priority = Math.max(priority, 85);
            } else if (urlLower.includes("kanald") || urlLower.includes("kanal_d")) {
              if (title === "Bilinmeyen" || title.includes("GitHub") || title.includes(".m3u8")) {
                title = "Kanal D HD"; category = "Ulusal"; geo_country = "TR"; priority = Math.max(priority, 90);
              }
            } else if (urlLower.includes("atv") && !urlLower.includes("xatv")) {
              if (title === "Bilinmeyen" || title.includes("GitHub") || title.includes(".m3u8")) {
                title = "ATV HD"; category = "Ulusal"; geo_country = "TR"; priority = Math.max(priority, 90);
              }
            } else if (urlLower.includes("startv")) {
              if (title === "Bilinmeyen" || title.includes("GitHub")) {
                title = "Star TV HD"; category = "Ulusal"; geo_country = "TR"; priority = Math.max(priority, 90);
              }
            } else if (urlLower.includes("showtv")) {
              if (title === "Bilinmeyen" || title.includes("GitHub")) {
                title = "Show TV HD"; category = "Ulusal"; geo_country = "TR"; priority = Math.max(priority, 90);
              }
            } else if (urlLower.includes("tv8")) {
              if (title === "Bilinmeyen" || title.includes("GitHub")) {
                title = "TV8 HD"; category = "Ulusal"; geo_country = "TR"; priority = Math.max(priority, 90);
              }
            }

            insert.run(
              s.id || crypto.randomUUID(),
              title,
              s.normalized_title || null,
              s.type || "live_tv",
              category,
              s.stream_url,
              s.poster_image_url || null,
              s.resolution || null,
              s.source || null,
              s.source_website || null,
              typeof s.custom_headers === "object" ? JSON.stringify(s.custom_headers) : (s.custom_headers || "{}"),
              s.failover_group || null,
              s.status || "active",
              s.failure_count || 0,
              s.last_checked_at || null,
              s.last_pushed_at || null,
              s.choicely_id || null,
              s.is_active ? 1 : 0,
              s.bitrate_kbps || null,
              s.quality_tier || null,
              typeof s.variants === "object" ? JSON.stringify(s.variants) : (s.variants || "[]"),
              s.response_ms || null,
              priority,
              geo_country,
              s.created_at || new Date().toISOString(),
              s.updated_at || new Date().toISOString()
            );
          }
        });
        console.log(`[DB] Successfully seeded ${items.length} autonomous streams.`);
      } catch (err) {
        console.error("[DB] Error seeding autonomous_streams:", err);
      }
    }
  }

  // Always ensure official Turkish channels are loaded & prioritized
  seedTurkishChannels(db);

  // Check discovery queries
  const queryCount = (db.prepare("SELECT count(*) as c FROM discovery_queries").get() as { c: number }).c;
  if (queryCount === 0) {
    const backupPath = path.resolve(process.cwd(), "data/backup/discovery_queries.json");
    if (fs.existsSync(backupPath)) {
      try {
        const raw = fs.readFileSync(backupPath, "utf-8");
        const items = JSON.parse(raw);
        const insert = db.prepare("INSERT OR REPLACE INTO discovery_queries (id, query, engine, active, hit_count, last_run_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
        withTransaction(db, () => {
          for (const q of items) {
            insert.run(q.id || crypto.randomUUID(), q.query, q.engine || "duckduckgo", q.active ? 1 : 0, q.hit_count || 0, q.last_run_at || null, q.created_at || new Date().toISOString());
          }
        });
        console.log(`[DB] Successfully seeded ${items.length} discovery queries.`);
      } catch (err) {
        console.error("[DB] Error seeding discovery_queries:", err);
      }
    }
  }

  // Check scraper logs
  const logCount = (db.prepare("SELECT count(*) as c FROM scraper_logs").get() as { c: number }).c;
  if (logCount === 0) {
    const backupPath = path.resolve(process.cwd(), "data/backup/scraper_logs.json");
    if (fs.existsSync(backupPath)) {
      try {
        const raw = fs.readFileSync(backupPath, "utf-8");
        const items = JSON.parse(raw);
        const insert = db.prepare("INSERT INTO scraper_logs (level, phase, message, meta, created_at) VALUES (?, ?, ?, ?, ?)");
        withTransaction(db, () => {
          for (const l of items.slice(0, 500)) {
            insert.run(l.level || "info", l.phase || "general", l.message || "", typeof l.meta === "object" ? JSON.stringify(l.meta) : (l.meta || "{}"), l.created_at || new Date().toISOString());
          }
        });
        console.log(`[DB] Successfully seeded ${items.length} logs.`);
      } catch (err) {
        console.error("[DB] Error seeding scraper_logs:", err);
      }
    }
  }
}

// ----------------------------------------------------
// High-Level Data Methods
// ----------------------------------------------------

export function getOverviewData() {
  const db = getRawDb();
  const total = (db.prepare("SELECT count(*) as c FROM autonomous_streams").get() as { c: number }).c;
  const active = (db.prepare("SELECT count(*) as c FROM autonomous_streams WHERE status = 'active'").get() as { c: number }).c;
  const dead = (db.prepare("SELECT count(*) as c FROM autonomous_streams WHERE status != 'active'").get() as { c: number }).c;
  const fhd = (db.prepare("SELECT count(*) as c FROM autonomous_streams WHERE status = 'active' AND (quality_tier = '1080P' OR resolution LIKE '%1080%')").get() as { c: number }).c;
  const hd = (db.prepare("SELECT count(*) as c FROM autonomous_streams WHERE status = 'active' AND (quality_tier = '720P' OR resolution LIKE '%720%')").get() as { c: number }).c;
  const sd = (db.prepare("SELECT count(*) as c FROM autonomous_streams WHERE status = 'active' AND (quality_tier = '480P' OR resolution LIKE '%480%' OR quality_tier = 'SD')").get() as { c: number }).c;
  const queuedJobs = (db.prepare("SELECT count(*) as c FROM crawl_jobs WHERE status = 'queued'").get() as { c: number }).c;
  const activeProxies = (db.prepare("SELECT count(*) as c FROM proxies WHERE active = 1").get() as { c: number }).c;
  const activeClients = (db.prepare("SELECT count(*) as c FROM api_clients WHERE active = 1").get() as { c: number }).c;
  const totalQueries = (db.prepare("SELECT count(*) as c FROM discovery_queries WHERE active = 1").get() as { c: number }).c;

  const logs = db.prepare("SELECT * FROM scraper_logs ORDER BY id DESC LIMIT 50").all().map((r: any) => ({
    ...r,
    meta: typeof r.meta === "string" ? safeJsonParse(r.meta) : r.meta
  }));

  const metrics = db.prepare("SELECT * FROM engine_metrics ORDER BY ts DESC LIMIT 20").all();

  return {
    streams: {
      total,
      active,
      dead,
      fhd,
      hd,
      sd,
    },
    engine: {
      queuedJobs,
      activeProxies,
      activeClients,
      totalQueries,
    },
    logs,
    metrics,
    lastChecked: new Date().toISOString(),
  };
}

export function listStreamsFiltered(opts: {
  q?: string;
  status?: string;
  tier?: string;
  type?: string;
  onlyTurkish?: boolean;
  onlyUnknown?: boolean;
  limit?: number;
  offset?: number;
}) {
  const db = getRawDb();
  let sql = `SELECT id, title, type, category, stream_url, poster_image_url, resolution, quality_tier, bitrate_kbps, response_ms, status, failure_count, source, priority, geo_country, last_checked_at, failover_group, custom_headers FROM autonomous_streams WHERE 1=1`;
  const params: any[] = [];

  if (opts.q) {
    sql += ` AND (title LIKE ? OR stream_url LIKE ? OR category LIKE ?)`;
    const pattern = `%${opts.q}%`;
    params.push(pattern, pattern, pattern);
  }

  if (opts.status) {
    sql += ` AND status = ?`;
    params.push(opts.status);
  }

  if (opts.tier) {
    sql += ` AND quality_tier = ?`;
    params.push(opts.tier.toUpperCase());
  }

  if (opts.type) {
    sql += ` AND type = ?`;
    params.push(opts.type);
  }

  if (opts.onlyTurkish) {
    sql += ` AND (geo_country = 'TR' OR title LIKE '%TRT%' OR title LIKE '%ATV%' OR title LIKE '%KANAL D%' OR title LIKE '%STAR TV%' OR title LIKE '%SHOW TV%' OR title LIKE '%TV8%' OR title LIKE '%SÖZCÜ%' OR title LIKE '%HALK TV%' OR title LIKE '%TELE1%' OR title LIKE '%NTV%' OR title LIKE '%HABERTÜRK%' OR title LIKE '%CNN TÜRK%' OR stream_url LIKE '%trt%' OR stream_url LIKE '%duhnet%' OR stream_url LIKE '%turknet%')`;
  }

  if (opts.onlyUnknown) {
    sql += ` AND (title = 'Bilinmeyen' OR title = 'BILINMEYEN' OR title LIKE '%unknown%' OR title LIKE '%untitled%' OR title LIKE '%github.com%' OR title LIKE '%.m3u%')`;
  }

  sql += ` ORDER BY priority DESC, updated_at DESC LIMIT ? OFFSET ?`;
  params.push(opts.limit ?? 300, opts.offset ?? 0);

  const rows = db.prepare(sql).all(...params) as any[];
  return rows.map((r) => ({
    ...r,
    custom_headers: typeof r.custom_headers === "string" ? safeJsonParse(r.custom_headers) : r.custom_headers,
  }));
}

export function updateStreamItem(data: { id: string; priority?: number; status?: string; remove?: boolean }) {
  const db = getRawDb();
  if (data.remove) {
    db.prepare("DELETE FROM autonomous_streams WHERE id = ?").run(data.id);
    return { ok: true };
  }

  const updates: string[] = [];
  const params: any[] = [];

  if (data.priority !== undefined) {
    updates.push("priority = ?");
    params.push(data.priority);
  }

  if (data.status) {
    updates.push("status = ?");
    updates.push("is_active = ?");
    params.push(data.status, data.status === "active" ? 1 : 0);
  }

  updates.push("updated_at = ?");
  params.push(new Date().toISOString());

  params.push(data.id);
  db.prepare(`UPDATE autonomous_streams SET ${updates.join(", ")} WHERE id = ?`).run(...params);
  return { ok: true };
}

export function getResourcesData() {
  const db = getRawDb();
  const proxies = db.prepare("SELECT * FROM proxies ORDER BY created_at DESC").all();
  const clients = db.prepare("SELECT id, name, key_prefix, ip_whitelist, rate_limit_per_min, active, request_count, last_used_at, created_at FROM api_clients ORDER BY created_at DESC").all().map((c: any) => ({
    ...c,
    ip_whitelist: typeof c.ip_whitelist === "string" ? safeJsonParse(c.ip_whitelist) : c.ip_whitelist,
  }));
  const webhooks = db.prepare("SELECT * FROM webhooks ORDER BY created_at DESC").all().map((w: any) => ({
    ...w,
    events: typeof w.events === "string" ? safeJsonParse(w.events) : w.events,
  }));
  const epg = db.prepare("SELECT * FROM epg_sources ORDER BY created_at DESC").all();
  const queries = db.prepare("SELECT id, engine, query, active, hit_count, last_run_at FROM discovery_queries ORDER BY hit_count DESC LIMIT 200").all();

  return {
    proxies,
    clients,
    webhooks,
    epg,
    queries,
    captchaReady: !!process.env.CAPTCHA_API_KEY,
  };
}

// ----------------------------------------------------
// Supabase-Compatible Query Builder Facade
// Allows all scraper and API files to work without rewriting their internals
// ----------------------------------------------------

class QueryBuilder {
  private table: string;
  private selectCols: string = "*";
  private whereClauses: string[] = [];
  private whereParams: any[] = [];
  private orderClause: string = "";
  private limitCount?: number;
  private offsetCount?: number;
  private isSingle: boolean = false;
  private isMaybeSingle: boolean = false;
  private mutationType?: "insert" | "update" | "delete" | "upsert";
  private mutationData?: any;
  private upsertOptions?: { onConflict?: string };

  constructor(table: string) {
    this.table = table;
  }

  select(columns: string = "*") {
    this.selectCols = columns;
    return this;
  }

  eq(column: string, value: any) {
    this.whereClauses.push(`${column} = ?`);
    this.whereParams.push(value === true ? 1 : value === false ? 0 : value);
    return this;
  }

  neq(column: string, value: any) {
    this.whereClauses.push(`${column} != ?`);
    this.whereParams.push(value === true ? 1 : value === false ? 0 : value);
    return this;
  }

  in(column: string, values: any[]) {
    if (!values || values.length === 0) {
      this.whereClauses.push("1=0");
      return this;
    }
    const placeholders = values.map(() => "?").join(", ");
    this.whereClauses.push(`${column} IN (${placeholders})`);
    this.whereParams.push(...values);
    return this;
  }

  ilike(column: string, pattern: string) {
    this.whereClauses.push(`${column} LIKE ?`);
    this.whereParams.push(pattern);
    return this;
  }

  gte(column: string, value: any) {
    this.whereClauses.push(`${column} >= ?`);
    this.whereParams.push(value);
    return this;
  }

  lte(column: string, value: any) {
    this.whereClauses.push(`${column} <= ?`);
    this.whereParams.push(value);
    return this;
  }

  or(expr: string) {
    // simplified handler for simple OR clauses
    if (expr.includes("status.in")) {
      this.whereClauses.push(`(status IN ('queued', 'running'))`);
    } else {
      this.whereClauses.push(`(${expr})`);
    }
    return this;
  }

  order(column: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    const dir = opts?.ascending === false ? "DESC" : "ASC";
    const nulls = opts?.nullsFirst ? `NULLS FIRST` : "";
    this.orderClause = `ORDER BY ${column} ${dir} ${nulls}`.trim();
    return this;
  }

  not(column: string, operator: string, value: any) {
    if (operator === "like") {
      this.whereClauses.push(`${column} NOT LIKE ?`);
      this.whereParams.push(value);
    } else {
      this.whereClauses.push(`${column} != ?`);
      this.whereParams.push(value);
    }
    return this;
  }

  limit(n: number) {
    this.limitCount = n;
    return this;
  }

  range(from: number, to: number) {
    this.offsetCount = from;
    this.limitCount = Math.max(1, to - from + 1);
    return this;
  }

  single() {
    this.isSingle = true;
    this.limitCount = 1;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    this.limitCount = 1;
    return this;
  }

  insert(data: any | any[]) {
    this.mutationType = "insert";
    this.mutationData = Array.isArray(data) ? data : [data];
    return this;
  }

  upsert(data: any | any[], opts?: { onConflict?: string }) {
    this.mutationType = "upsert";
    this.mutationData = Array.isArray(data) ? data : [data];
    this.upsertOptions = opts;
    return this;
  }

  update(patch: any) {
    this.mutationType = "update";
    this.mutationData = patch;
    return this;
  }

  delete() {
    this.mutationType = "delete";
    return this;
  }

  // Promise resolution
  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    const p = this.execute();
    return p.then(onfulfilled, onrejected);
  }

  private async execute(): Promise<{ data: any; error: any }> {
    try {
      const db = getRawDb();

      if (this.mutationType === "insert" || this.mutationType === "upsert") {
        const rawRows = this.mutationData || [];
        if (rawRows.length === 0) return { data: [], error: null };

        const now = new Date().toISOString();
        const rows = rawRows.map((raw: any) => {
          const row = { ...raw };

          if (row.created_at === undefined || row.created_at === null) {
            row.created_at = now;
          }

          if (
            (this.table === "autonomous_streams" || this.table === "engine_settings") &&
            (row.updated_at === undefined || row.updated_at === null)
          ) {
            row.updated_at = now;
          }

          if (row.id === undefined || row.id === null) {
            if (
              this.table !== "scraper_logs" &&
              this.table !== "engine_settings" &&
              this.table !== "feed_cache" &&
              this.table !== "api_rate_buckets"
            ) {
              row.id = crypto.randomUUID();
            }
          }

          if (this.table === "autonomous_streams") {
            if (row.type === undefined || row.type === null) row.type = "live_tv";
            if (row.status === undefined || row.status === null) row.status = "active";
            if (row.failure_count === undefined || row.failure_count === null) row.failure_count = 0;
            if (row.priority === undefined || row.priority === null) row.priority = 0;
            if (row.is_active === undefined || row.is_active === null) row.is_active = 1;
            if (row.custom_headers === undefined || row.custom_headers === null) row.custom_headers = "{}";
            if (row.variants === undefined || row.variants === null) row.variants = "[]";
          } else if (this.table === "crawl_jobs") {
            if (row.depth === undefined || row.depth === null) row.depth = 0;
            if (row.status === undefined || row.status === null) row.status = "queued";
            if (row.attempts === undefined || row.attempts === null) row.attempts = 0;
          } else if (this.table === "engine_metrics") {
            if (row.ts === undefined || row.ts === null) row.ts = now;
            if (row.requests === undefined || row.requests === null) row.requests = 0;
            if (row.success === undefined || row.success === null) row.success = 0;
            if (row.failed === undefined || row.failed === null) row.failed = 0;
            if (row.banned === undefined || row.banned === null) row.banned = 0;
            if (row.avg_ms === undefined || row.avg_ms === null) row.avg_ms = 0;
            if (row.found === undefined || row.found === null) row.found = 0;
          } else if (this.table === "discovery_queries") {
            if (row.engine === undefined || row.engine === null) row.engine = "duckduckgo";
            if (row.active === undefined || row.active === null) row.active = 1;
            if (row.hit_count === undefined || row.hit_count === null) row.hit_count = 0;
          } else if (this.table === "scraper_logs") {
            if (row.level === undefined || row.level === null) row.level = "info";
            if (row.meta === undefined || row.meta === null) row.meta = "{}";
          } else if (this.table === "proxies") {
            if (row.active === undefined || row.active === null) row.active = 1;
            if (row.success_count === undefined || row.success_count === null) row.success_count = 0;
            if (row.fail_count === undefined || row.fail_count === null) row.fail_count = 0;
            if (row.ban_count === undefined || row.ban_count === null) row.ban_count = 0;
          }

          return row;
        });

        const allKeys = Array.from(new Set(rows.flatMap((r: any) => Object.keys(r)))) as string[];
        const placeholders = allKeys.map(() => "?").join(", ");

        let conflictClause = "";
        if (this.mutationType === "upsert") {
          if (this.upsertOptions?.onConflict) {
            const updateCols = allKeys.filter(
              (k) => k !== this.upsertOptions?.onConflict && k !== "id" && k !== "created_at"
            );
            if (updateCols.length > 0) {
              conflictClause = `ON CONFLICT(${this.upsertOptions.onConflict}) DO UPDATE SET ${updateCols
                .map((k) => `${k}=excluded.${k}`)
                .join(", ")}`;
            } else {
              conflictClause = `ON CONFLICT(${this.upsertOptions.onConflict}) DO NOTHING`;
            }
          } else {
            conflictClause = "OR REPLACE";
          }
        }

        const sql = `INSERT ${conflictClause === "OR REPLACE" ? "OR REPLACE" : ""} INTO ${this.table} (${allKeys.join(", ")}) VALUES (${placeholders}) ${conflictClause.startsWith("ON CONFLICT") ? conflictClause : ""}`;
        const stmt = db.prepare(sql);

        withTransaction(db, () => {
          for (const row of rows as any[]) {
            const values = allKeys.map((k) => {
              const v = (row as any)[k];
              if (v === undefined || v === null) return null;
              if (typeof v === "object") return JSON.stringify(v);
              if (typeof v === "boolean") return v ? 1 : 0;
              return v;
            });
            stmt.run(...values);
          }
        });

        const returnData = (this.selectCols && this.selectCols !== "*")
          ? rows.map((r: any) => {
              const cols = this.selectCols.split(",").map((c) => c.trim());
              const projected: any = {};
              for (const c of cols) projected[c] = (r as any)[c];
              return projected;
            })
          : rows;

        return { data: returnData, error: null };
      }

      if (this.mutationType === "update") {
        const rawPatch = this.mutationData || {};
        const patch = { ...rawPatch };

        if (this.table === "autonomous_streams" && patch.updated_at === undefined) {
          patch.updated_at = new Date().toISOString();
        }

        const keys = Object.keys(patch);
        if (keys.length === 0) return { data: null, error: null };

        const setClauses = keys.map((k) => `${k} = ?`).join(", ");
        const setValues = keys.map((k) => {
          const v = patch[k];
          if (v === undefined || v === null) return null;
          if (typeof v === "object") return JSON.stringify(v);
          if (typeof v === "boolean") return v ? 1 : 0;
          return v;
        });

        let sql = `UPDATE ${this.table} SET ${setClauses}`;
        if (this.whereClauses.length > 0) {
          sql += ` WHERE ${this.whereClauses.join(" AND ")}`;
        }

        db.prepare(sql).run(...setValues, ...this.whereParams);
        return { data: patch, error: null };
      }

      if (this.mutationType === "delete") {
        let sql = `DELETE FROM ${this.table}`;
        if (this.whereClauses.length > 0) {
          sql += ` WHERE ${this.whereClauses.join(" AND ")}`;
        }
        db.prepare(sql).run(...this.whereParams);
        return { data: true, error: null };
      }

      // SELECT
      let sql = `SELECT ${this.selectCols === "*" ? "*" : this.selectCols} FROM ${this.table}`;
      if (this.whereClauses.length > 0) {
        sql += ` WHERE ${this.whereClauses.join(" AND ")}`;
      }
      if (this.orderClause) {
        sql += ` ${this.orderClause}`;
      }
      if (this.limitCount !== undefined) {
        sql += ` LIMIT ${this.limitCount}`;
      }
      if (this.offsetCount !== undefined) {
        sql += ` OFFSET ${this.offsetCount}`;
      }

      const rows = db.prepare(sql).all(...this.whereParams) as any[];

      // Parse JSON fields where appropriate
      const parsed = rows.map((r) => {
        const item: any = { ...r };
        for (const k of ["custom_headers", "variants", "meta", "events", "ip_whitelist"]) {
          if (typeof item[k] === "string") {
            item[k] = safeJsonParse(item[k]);
          }
        }
        return item;
      });

      if (this.isSingle) {
        return { data: parsed[0] || null, error: parsed.length === 0 ? { message: "Not found" } : null };
      }
      if (this.isMaybeSingle) {
        return { data: parsed[0] || null, error: null };
      }

      return { data: parsed, error: null };
    } catch (err: any) {
      console.error(`[DB Error ${this.table}]:`, err);
      return { data: null, error: err };
    }
  }
}

export const dbAdmin = {
  from(table: string) {
    return new QueryBuilder(table);
  },

  async rpc(fnName: string, args: Record<string, any> = {}) {
    const db = getRawDb();

    if (fnName === "api_hit") {
      const clientId = args._client;
      const limit = args._limit || 60;
      const now = new Date();
      const windowStart = new Date(Math.floor(now.getTime() / 60000) * 60000).toISOString();

      try {
        const hits = withTransaction(db, () => {
          db.prepare(`
            INSERT INTO api_rate_buckets (client_id, window_start, hits)
            VALUES (?, ?, 1)
            ON CONFLICT(client_id, window_start)
            DO UPDATE SET hits = api_rate_buckets.hits + 1
          `).run(clientId, windowStart);

          const bucket = db.prepare("SELECT hits FROM api_rate_buckets WHERE client_id = ? AND window_start = ?").get(clientId, windowStart) as { hits: number } | undefined;
          const currentHits = bucket?.hits || 1;

          db.prepare("UPDATE api_clients SET request_count = request_count + 1, last_used_at = ? WHERE id = ?").run(now.toISOString(), clientId);
          db.prepare("DELETE FROM api_rate_buckets WHERE window_start < datetime('now', '-10 minutes')").run();
          return currentHits;
        });

        return { data: hits <= limit, error: null };
      } catch (err) {
        return { data: false, error: err };
      }
    }

    if (fnName === "claim_jobs") {
      const n = args._n || 6;
      const nowIso = new Date().toISOString();

      try {
        const jobs = withTransaction(db, () => {
          // Reset stalled
          db.prepare("UPDATE crawl_jobs SET status = 'queued', locked_at = NULL WHERE status = 'running' AND locked_at < datetime('now', '-5 minutes')").run();

          // Select jobs
          const claimed = (db.prepare("SELECT * FROM crawl_jobs WHERE status = 'queued' ORDER BY depth ASC, created_at ASC LIMIT ?").all(n) as unknown) as CrawlJobRow[];

          if (claimed.length > 0) {
            const ids = claimed.map((j) => j.id);
            const placeholders = ids.map(() => "?").join(", ");
            db.prepare(`UPDATE crawl_jobs SET status = 'running', locked_at = ?, attempts = attempts + 1 WHERE id IN (${placeholders})`).run(nowIso, ...ids);
          }
          return claimed;
        });

        return { data: jobs, error: null };
      } catch (err) {
        return { data: [], error: err };
      }
    }

    if (fnName === "proxy_stat") {
      const id = args._id;
      const outcome = args._outcome;
      try {
        if (outcome === "success") {
          db.prepare("UPDATE proxies SET success_count = success_count + 1 WHERE id = ?").run(id);
        } else if (outcome === "ban") {
          db.prepare("UPDATE proxies SET ban_count = ban_count + 1 WHERE id = ?").run(id);
        } else {
          db.prepare("UPDATE proxies SET fail_count = fail_count + 1 WHERE id = ?").run(id);
        }
        return { data: true, error: null };
      } catch (err) {
        return { data: false, error: err };
      }
    }

    return { data: null, error: new Error(`Unknown RPC ${fnName}`) };
  },
};

// Export compatibility alias for any existing files
export const supabaseAdmin = dbAdmin;

function safeJsonParse(val: string): any {
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}
