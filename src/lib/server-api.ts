import type { Request, Response, NextFunction } from "express";
import {
  getOverviewData,
  listStreamsFiltered,
  updateStreamItem,
  getResourcesData,
  getRawDb,
  dbAdmin as supabaseAdmin,
  seedTurkishChannels,
  withTransaction,
} from "./db";
import { TURKISH_CHANNELS } from "./turkish-channels";
import { authenticateRequest, errorResponse, generateApiKey, sha256 } from "./api/auth.server";
import { verifyCron, loggedRun } from "./api/cron.server";
import { normKey, syncEpg } from "./scraper/epg.server";
import { runDiscovery, runWorker, runHealthCheck } from "./scraper/orchestrator.server";
import { notify } from "./scraper/webhooks.server";
import { smartFetch } from "./scraper/fetch.server";
import { resolveStreamWithGemini, batchResolveStreamsWithGemini } from "./scraper/nlp.server";
import { getSmartStreamHeaders } from "./scraper/smart-referrer";

export function handleCors(req: Request, res: Response, next: NextFunction) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-api-key, x-cron-token, Range, If-Modified-Since, Cache-Control, X-Requested-With, Origin, Accept"
  );
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Length, Content-Range, Content-Type, Accept-Ranges, ETag, Date"
  );
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
}

// ----------------------------------------------------
// Public IPTV Endpoints
// ----------------------------------------------------

export async function handlePlaylistM3u(req: Request, res: Response) {
  try {
    // If API key is required
    const fakeReq = new Request(`http://${req.headers.host}${req.url}`, {
      headers: new Headers(req.headers as any),
    });
    const auth = await authenticateRequest(fakeReq);

    // If API key is provided and invalid, return error.
    // If not provided in prototype/console testing mode, allow with warning or require key:
    const requireKey = (process.env.REQUIRE_API_KEY === "true");
    if (requireKey && !auth.ok) {
      res.status(auth.status).json({ error: auth.message });
      return;
    }

    const type = (req.query.type as string) || "live_tv";
    const quality = req.query.quality as string | undefined;
    const proxied = req.query.proxied === "1";
    const apiKey = (req.headers["x-api-key"] as string) || (req.query.key as string) || "";

    const db = getRawDb();
    let sql = `SELECT id, title, category, stream_url, poster_image_url, quality_tier, custom_headers FROM autonomous_streams WHERE status = 'active' AND type = ?`;
    const params: any[] = [type];

    if (quality) {
      sql += ` AND quality_tier = ?`;
      params.push(quality.toUpperCase());
    }

    sql += ` ORDER BY priority DESC, updated_at DESC LIMIT 5000`;
    const data = db.prepare(sql).all(...params) as any[];

    const lines = ["#EXTM3U"];
    const protocol = req.protocol || "http";
    const host = req.get("host") || "localhost:3000";
    const origin = `${protocol}://${host}`;

    for (const s of data) {
      const headers = typeof s.custom_headers === "string" ? JSON.parse(s.custom_headers || "{}") : (s.custom_headers || {});
      const cleanTitle = (s.title || "Kanal").replace(/"/g, "");
      lines.push(
        `#EXTINF:-1 tvg-id="${normKey(s.title || "")}" tvg-name="${cleanTitle}" tvg-logo="${s.poster_image_url || ""}" group-title="${s.category || "Diğer"}",${s.title || cleanTitle}`
      );

      if (!proxied) {
        if (headers.Referer) lines.push(`#EXTVLCOPT:http-referrer=${headers.Referer}`);
        if (headers["User-Agent"]) lines.push(`#EXTVLCOPT:http-user-agent=${headers["User-Agent"]}`);
      }

      const streamTarget = proxied
        ? `${origin}/api/public/v1/stream/${s.id}?key=${encodeURIComponent(apiKey)}`
        : s.stream_url;

      lines.push(streamTarget);
    }

    res.setHeader("Content-Type", "audio/x-mpegurl; charset=utf-8");
    res.setHeader("Content-Disposition", 'inline; filename="playlist.m3u"');
    res.setHeader("Cache-Control", "private, max-age=30");
    res.send(lines.join("\n"));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function handleEpgXml(req: Request, res: Response) {
  try {
    const db = getRawDb();
    const nowIso = new Date().toISOString();
    const programs = db.prepare(`
      SELECT channel_key, channel_name, title, description, start_at, stop_at
      FROM epg_programs
      WHERE stop_at >= ?
      ORDER BY start_at ASC
      LIMIT 20000
    `).all(nowIso) as any[];

    const channels = new Map<string, string>();
    for (const p of programs) {
      channels.set(p.channel_key, p.channel_name || p.channel_key);
    }

    const esc = (s: string) => (s || "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] || c);
    const stamp = (iso: string) => {
      try {
        return new Date(iso).toISOString().replace(/[-:T]/g, "").slice(0, 14) + " +0000";
      } catch {
        return "";
      }
    };

    const out = ['<?xml version="1.0" encoding="UTF-8"?>', '<tv generator-info-name="Core Stream Engine">'];
    for (const [k, name] of channels) {
      out.push(`<channel id="${esc(k)}"><display-name>${esc(name)}</display-name></channel>`);
    }

    for (const p of programs) {
      out.push(
        `<programme start="${stamp(p.start_at)}" stop="${stamp(p.stop_at)}" channel="${esc(p.channel_key)}"><title>${esc(p.title)}</title>${p.description ? `<desc>${esc(p.description)}</desc>` : ""}</programme>`
      );
    }
    out.push("</tv>");

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(out.join("\n"));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function handleStreamsList(req: Request, res: Response) {
  try {
    const type = req.query.type as string | undefined;
    const category = req.query.category as string | undefined;
    const quality = req.query.quality as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 1000, 5000);

    const db = getRawDb();
    let sql = `SELECT id, title, type, category, stream_url, poster_image_url, resolution, quality_tier, bitrate_kbps, custom_headers, source, failover_group, geo_country, last_checked_at FROM autonomous_streams WHERE status = 'active'`;
    const params: any[] = [];

    if (type) {
      sql += ` AND type = ?`;
      params.push(type);
    }
    if (category) {
      sql += ` AND category = ?`;
      params.push(category);
    }
    if (quality) {
      sql += ` AND quality_tier = ?`;
      params.push(quality.toUpperCase());
    }

    sql += ` ORDER BY priority DESC LIMIT ?`;
    params.push(limit);

    const rows = db.prepare(sql).all(...params) as any[];
    const parsed = rows.map((r) => ({
      ...r,
      custom_headers: typeof r.custom_headers === "string" ? JSON.parse(r.custom_headers || "{}") : r.custom_headers,
    }));

    res.json({
      count: parsed.length,
      generated_at: new Date().toISOString(),
      streams: parsed,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

function rewriteM3uManifest(manifest: string, targetUrl: string, proxyBase: string, explicitReferer?: string): string {
  const refParam = explicitReferer ? `&referer=${encodeURIComponent(explicitReferer)}` : "";
  return manifest
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (!t) return "";

      // Rewrite URI="..." attributes (e.g. #EXT-X-KEY or #EXT-X-MAP)
      if (t.startsWith("#")) {
        return t.replace(/URI="([^"]+)"/g, (_m, u: string) => {
          try {
            const absolute = new URL(u, targetUrl).toString();
            return `URI="${proxyBase}${encodeURIComponent(absolute)}${refParam}"`;
          } catch {
            return _m;
          }
        });
      }

      // Stream / chunk URL lines
      try {
        const absolute = new URL(t, targetUrl).toString();
        return `${proxyBase}${encodeURIComponent(absolute)}${refParam}`;
      } catch {
        return t;
      }
    })
    .join("\n");
}

export async function handleUniversalCorsProxy(req: Request, res: Response) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Range, If-Modified-Since, Cache-Control, X-Requested-With, Origin, Accept, x-api-key"
  );
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Length, Content-Range, Content-Type, Accept-Ranges, ETag, Date"
  );

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const target = (req.query.url as string) || (req.query.u as string);
  if (!target) {
    res.status(400).json({ error: "Missing 'url' parameter" });
    return;
  }

  const explicitReferer = (req.query.referer as string) || (req.query.ref as string);
  const streamHeaders = getSmartStreamHeaders(target, explicitReferer);

  const protocol = req.protocol || "http";
  const host = req.get("host") || "localhost:3000";
  const proxyBase = `${protocol}://${host}/api/public/v1/cors-proxy?url=`;

  try {
    const fetchHeaders: Record<string, string> = {
      ...streamHeaders,
    };
    if (req.headers.range) {
      fetchHeaders["Range"] = req.headers.range as string;
    }

    const upstream = await fetch(target, {
      method: req.method === "HEAD" ? "HEAD" : "GET",
      headers: fetchHeaders,
      redirect: "follow",
    });

    if (upstream.status >= 400 && upstream.status !== 404) {
      // Retry via smartFetch fallback if standard fetch is blocked
      const fallback = await smartFetch(target, {
        method: req.method === "HEAD" ? "HEAD" : "GET",
        timeoutMs: 12000,
        kind: "media",
        referer: streamHeaders.Referer,
        extraHeaders: streamHeaders,
        attempts: 2,
      });

      if (fallback.status >= 200 && fallback.status < 400 && fallback.text) {
        if (fallback.text.includes("#EXTM3U") || target.includes(".m3u8")) {
          const rewritten = rewriteM3uManifest(fallback.text, target, proxyBase, explicitReferer);
          res.setHeader("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.send(rewritten);
          return;
        }
      }
    }

    const contentType = upstream.headers.get("content-type") || "";
    const isM3u = contentType.includes("mpegurl") || contentType.includes("m3u8") || target.includes(".m3u8");

    if (isM3u) {
      const text = await upstream.text();
      if (text.includes("#EXTM3U") || text.includes("#EXTINF")) {
        const rewritten = rewriteM3uManifest(text, target, proxyBase, explicitReferer);
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.send(rewritten);
        return;
      }
    }

    // Binary media segment (.ts, .m4s, .mp4, .aac, .key, etc.)
    res.status(upstream.status);
    res.setHeader("Content-Type", contentType || "video/mp2t");
    res.setHeader("Cache-Control", "no-store");
    if (upstream.headers.get("content-range")) {
      res.setHeader("Content-Range", upstream.headers.get("content-range")!);
    }
    if (upstream.headers.get("accept-ranges")) {
      res.setHeader("Accept-Ranges", upstream.headers.get("accept-ranges")!);
    }
    const len = upstream.headers.get("content-length");
    if (len) res.setHeader("Content-Length", len);

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    const buffer = await upstream.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err: any) {
    res.status(502).json({ error: `Universal CORS proxy fetch failed: ${err.message}` });
  }
}

export async function handleStreamProxy(req: Request, res: Response) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Range, If-Modified-Since, Cache-Control, X-Requested-With, Origin, Accept, x-api-key"
  );
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Length, Content-Range, Content-Type, Accept-Ranges, ETag, Date"
  );

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const { id } = req.params;
  const db = getRawDb();

  const row = db.prepare(`SELECT id, stream_url, custom_headers, failover_group, source_website, geo_country FROM autonomous_streams WHERE id = ?`).get(id) as any;
  if (!row) {
    res.status(404).json({ error: "Stream not found" });
    return;
  }

  const headers = typeof row.custom_headers === "string" ? JSON.parse(row.custom_headers || "{}") : (row.custom_headers || {});
  const override = req.query.u as string | undefined;
  const apiKey = (req.headers["x-api-key"] as string) || (req.query.key as string) || "";

  const candidates: string[] = [];
  if (override) {
    try {
      candidates.push(new URL(override, row.stream_url).toString());
    } catch {
      // ignore
    }
  } else {
    candidates.push(row.stream_url);
    if (row.failover_group) {
      const mirrors = db.prepare(`SELECT stream_url FROM autonomous_streams WHERE failover_group = ? AND status = 'active' AND id != ? LIMIT 4`).all(row.failover_group, row.id) as any[];
      for (const m of mirrors) candidates.push(m.stream_url);
    }
  }

  const protocol = req.protocol || "http";
  const host = req.get("host") || "localhost:3000";
  const base = `${protocol}://${host}/api/public/v1/stream/${row.id}?key=${encodeURIComponent(apiKey)}&u=`;

  for (const target of candidates) {
    const streamHeaders = getSmartStreamHeaders(target, headers.Referer || row.source_website, headers);

    const result = await smartFetch(target, {
      method: req.method === "HEAD" ? "HEAD" : "GET",
      timeoutMs: 12000,
      kind: "media",
      referer: streamHeaders.Referer,
      extraHeaders: streamHeaders,
      country: row.geo_country,
      attempts: 2,
    });

    if (result.status < 200 || result.status >= 400 || (!result.text && req.method !== "HEAD")) {
      // Direct fetch retry with smart headers
      try {
        const fetchHeaders: Record<string, string> = { ...streamHeaders };
        if (req.headers.range) fetchHeaders["Range"] = req.headers.range as string;
        const direct = await fetch(target, {
          method: req.method === "HEAD" ? "HEAD" : "GET",
          headers: fetchHeaders,
        });
        if (direct.status >= 200 && direct.status < 400) {
          const contentType = direct.headers.get("content-type") || "";
          if (contentType.includes("mpegurl") || contentType.includes("m3u8") || target.includes(".m3u8")) {
            const body = await direct.text();
            const rewritten = rewriteM3uManifest(body, target, base);
            res.setHeader("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
            res.setHeader("Cache-Control", "no-store");
            res.send(rewritten);
            return;
          }
          res.status(direct.status);
          res.setHeader("Content-Type", contentType || "video/mp2t");
          res.setHeader("Cache-Control", "no-store");
          if (direct.headers.get("content-range")) res.setHeader("Content-Range", direct.headers.get("content-range")!);
          if (direct.headers.get("accept-ranges")) res.setHeader("Accept-Ranges", direct.headers.get("accept-ranges")!);
          const len = direct.headers.get("content-length");
          if (len) res.setHeader("Content-Length", len);
          if (req.method === "HEAD") { res.end(); return; }
          const buf = await direct.arrayBuffer();
          res.send(Buffer.from(buf));
          return;
        }
      } catch {
        continue;
      }
      continue;
    }

    if (result.text && (result.text.includes("#EXTM3U") || target.includes(".m3u8"))) {
      const rewritten = rewriteM3uManifest(result.text, target, base);
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.send(rewritten);
      return;
    }

    // Direct segment proxy
    try {
      const fetchHeaders: Record<string, string> = { ...streamHeaders };
      if (req.headers.range) fetchHeaders["Range"] = req.headers.range as string;
      const upstream = await fetch(target, {
        method: req.method === "HEAD" ? "HEAD" : "GET",
        headers: fetchHeaders,
      });
      res.status(upstream.status);
      res.setHeader("Content-Type", upstream.headers.get("content-type") || "video/mp2t");
      res.setHeader("Cache-Control", "no-store");
      if (upstream.headers.get("content-range")) res.setHeader("Content-Range", upstream.headers.get("content-range")!);
      if (upstream.headers.get("accept-ranges")) res.setHeader("Accept-Ranges", upstream.headers.get("accept-ranges")!);
      const len = upstream.headers.get("content-length");
      if (len) res.setHeader("Content-Length", len);

      if (req.method === "HEAD") {
        res.end();
        return;
      }

      const buffer = await upstream.arrayBuffer();
      res.send(Buffer.from(buffer));
      return;
    } catch {
      continue;
    }
  }

  res.status(502).json({ error: "All stream sources unavailable or blocked by upstream CDN" });
}

// ----------------------------------------------------
// Scheduled Hooks
// ----------------------------------------------------

export async function handleHookDiscover(req: Request, res: Response) {
  const fakeReq = new Request(`http://${req.headers.host}${req.url}`, {
    headers: new Headers(req.headers as any),
  });
  if (!(await verifyCron(fakeReq))) {
    res.status(401).json({ error: "Unauthorized cron token" });
    return;
  }
  const result = await loggedRun("discover", () => runDiscovery({ manual: false }));
  res.status(result.status).json(await result.json());
}

export async function handleHookWorker(req: Request, res: Response) {
  const fakeReq = new Request(`http://${req.headers.host}${req.url}`, {
    headers: new Headers(req.headers as any),
  });
  if (!(await verifyCron(fakeReq))) {
    res.status(401).json({ error: "Unauthorized cron token" });
    return;
  }
  const result = await loggedRun("worker", () => runWorker({ batch: 10 }));
  res.status(result.status).json(await result.json());
}

export async function handleHookHealth(req: Request, res: Response) {
  const fakeReq = new Request(`http://${req.headers.host}${req.url}`, {
    headers: new Headers(req.headers as any),
  });
  if (!(await verifyCron(fakeReq))) {
    res.status(401).json({ error: "Unauthorized cron token" });
    return;
  }
  const result = await loggedRun("health", () => runHealthCheck());
  res.status(result.status).json(await result.json());
}

export async function handleHookEpg(req: Request, res: Response) {
  const fakeReq = new Request(`http://${req.headers.host}${req.url}`, {
    headers: new Headers(req.headers as any),
  });
  if (!(await verifyCron(fakeReq))) {
    res.status(401).json({ error: "Unauthorized cron token" });
    return;
  }
  const result = await loggedRun("epg", () => syncEpg());
  res.status(result.status).json(await result.json());
}

// ----------------------------------------------------
// Console Admin API Handlers
// ----------------------------------------------------

export function handleConsoleClaimAdmin(req: Request, res: Response) {
  const db = getRawDb();
  db.prepare("INSERT OR REPLACE INTO user_roles (user_id, role, created_at) VALUES ('admin_local_user', 'admin', ?)").run(new Date().toISOString());
  res.json({ isAdmin: true, user: { id: "admin_local_user", role: "admin", name: "Yönetici" } });
}

export function handleConsoleOverview(req: Request, res: Response) {
  try {
    const data = getOverviewData();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export function handleConsoleStreams(req: Request, res: Response) {
  try {
    const q = req.query.q as string | undefined;
    const status = req.query.status as string | undefined;
    const tier = req.query.tier as string | undefined;
    const type = req.query.type as string | undefined;
    const onlyTurkish = req.query.onlyTurkish === "1" || req.query.onlyTurkish === "true";
    const onlyUnknown = req.query.onlyUnknown === "1" || req.query.onlyUnknown === "true";
    const limit = Number(req.query.limit) || 300;
    const offset = Number(req.query.offset) || 0;

    const data = listStreamsFiltered({ q, status, tier, type, onlyTurkish, onlyUnknown, limit, offset });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function handleConsoleAiResolveStream(req: Request, res: Response) {
  try {
    const { id } = req.body;
    if (!id) {
      res.status(400).json({ error: "Missing stream id" });
      return;
    }
    const db = getRawDb();
    const stream = db.prepare("SELECT * FROM autonomous_streams WHERE id = ?").get(id) as any;
    if (!stream) {
      res.status(404).json({ error: "Stream not found" });
      return;
    }

    const resolved = await resolveStreamWithGemini({
      id: stream.id,
      title: stream.title,
      stream_url: stream.stream_url,
      category: stream.category,
      resolution: stream.resolution,
      source: stream.source,
      source_website: stream.source_website,
    });

    const isTurkish = resolved.geo_country === "TR";
    const newPriority = isTurkish ? Math.max(stream.priority || 0, 95) : stream.priority;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE autonomous_streams
      SET title = ?, type = ?, category = ?, quality_tier = ?, geo_country = ?, priority = ?, updated_at = ?
      WHERE id = ?
    `).run(
      resolved.title,
      resolved.type,
      resolved.category,
      resolved.quality,
      resolved.geo_country || stream.geo_country || null,
      newPriority,
      now,
      id
    );

    db.prepare("INSERT INTO scraper_logs (level, phase, message, created_at) VALUES (?, ?, ?, ?)").run(
      "ok",
      "ai",
      `Gemini AI: "${stream.title}" → "${resolved.title}" [${resolved.category} / ${resolved.quality}]`,
      now
    );

    res.json({
      ok: true,
      resolved,
      stream: {
        ...stream,
        title: resolved.title,
        type: resolved.type,
        category: resolved.category,
        quality_tier: resolved.quality,
        geo_country: resolved.geo_country || stream.geo_country,
        priority: newPriority,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function handleConsoleAiResolveBatch(req: Request, res: Response) {
  try {
    const limit = Math.min(Number(req.body.limit) || 25, 60);
    const db = getRawDb();
    const unknowns = db.prepare(`
      SELECT id, title, stream_url, category, resolution, source, source_website
      FROM autonomous_streams
      WHERE title = 'Bilinmeyen' OR title = 'BILINMEYEN' OR title LIKE '%unknown%' OR title LIKE '%untitled%' OR title LIKE '%github.com%' OR title LIKE '%.m3u%'
      LIMIT ?
    `).all(limit) as any[];

    if (!unknowns.length) {
      res.json({ ok: true, count: 0, message: "İsimlendirilecek bilinmeyen akış kalmadı." });
      return;
    }

    const resolutions = await batchResolveStreamsWithGemini(unknowns);
    const now = new Date().toISOString();
    let updatedCount = 0;

    withTransaction(db, () => {
      const updateStmt = db.prepare(`
        UPDATE autonomous_streams
        SET title = ?, type = ?, category = ?, quality_tier = ?, geo_country = ?, priority = ?, updated_at = ?
        WHERE id = ?
      `);

      for (const u of unknowns) {
        const r = resolutions.get(u.id);
        if (r && r.title && r.title !== "Bilinmeyen") {
          const isTr = r.geo_country === "TR";
          const prio = isTr ? Math.max(u.priority || 0, 95) : (u.priority || 0);
          updateStmt.run(r.title, r.type, r.category, r.quality, r.geo_country || null, prio, now, u.id);
          updatedCount++;
        }
      }
    });

    db.prepare("INSERT INTO scraper_logs (level, phase, message, created_at) VALUES (?, ?, ?, ?)").run(
      "ok",
      "ai",
      `Gemini 3.8 Flash: ${updatedCount} adet bilinmeyen akış yapay zeka ile başarıyla isimlendirildi ve sınıflandırıldı.`,
      now
    );

    res.json({
      ok: true,
      count: updatedCount,
      message: `${updatedCount} adet akış yapay zeka ile başarıyla isimlendirildi ve kategorize edildi.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export function handleConsoleSeedTurkish(req: Request, res: Response) {
  try {
    const db = getRawDb();
    seedTurkishChannels(db);

    // Also promote any other Turkish channels in the db
    db.prepare(`
      UPDATE autonomous_streams
      SET priority = 90, geo_country = 'TR'
      WHERE (title LIKE '%TRT%' OR title LIKE '%ATV%' OR title LIKE '%KANAL D%' OR title LIKE '%STAR TV%' OR title LIKE '%SHOW TV%' OR title LIKE '%TV8%' OR title LIKE '%SÖZCÜ%' OR title LIKE '%HALK TV%' OR title LIKE '%TELE1%' OR stream_url LIKE '%trt%' OR stream_url LIKE '%duhnet%' OR stream_url LIKE '%turknet%')
      AND priority < 90
    `).run();

    res.json({
      ok: true,
      count: TURKISH_CHANNELS.length,
      message: `${TURKISH_CHANNELS.length} resmi Türk kanalı başarıyla yüklendi ve listenin en üstüne yerleştirildi.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export function handleConsoleUpdateStream(req: Request, res: Response) {
  try {
    const { id, priority, status, remove } = req.body;
    const result = updateStreamItem({ id, priority, status, remove });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function handleConsoleRunEngine(req: Request, res: Response) {
  try {
    const { task } = req.body;
    if (task === "epg") {
      const result = await syncEpg();
      res.json({ task, result });
      return;
    }
    if (task === "discover") {
      const r = await runDiscovery({ manual: true });
      res.json({ task, result: { enqueued: r.enqueued, inserted: r.inserted, validated: r.validated } });
      return;
    }
    if (task === "worker") {
      const r = await runWorker({ batch: 10 });
      res.json({ task, result: { pages: r.pages, inserted: r.inserted, validated: r.validated } });
      return;
    }
    if (task === "health") {
      const result = await runHealthCheck();
      res.json({ task, result });
      return;
    }
    res.status(400).json({ error: `Geçersiz görev: ${task}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export function handleConsoleResources(req: Request, res: Response) {
  try {
    const data = getResourcesData();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function handleConsoleAddProxy(req: Request, res: Response) {
  try {
    const { label, template, country } = req.body;
    if (!label || !template) {
      res.status(400).json({ error: "Etiket ve şablon zorunludur" });
      return;
    }
    const db = getRawDb();
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO proxies (id, label, template, country, success_count, fail_count, ban_count, active, created_at)
      VALUES (?, ?, ?, ?, 0, 0, 0, 1, ?)
    `).run(id, label, template, country ? country.toUpperCase() : null, new Date().toISOString());
    res.json({ ok: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function handleConsoleTestProxy(req: Request, res: Response) {
  const startTime = Date.now();
  try {
    const { id, testUrl, country } = req.body;
    let template = req.body.template as string | undefined;

    const db = getRawDb();
    if (id && !template) {
      const row = db.prepare("SELECT template, country FROM proxies WHERE id = ?").get(id) as any;
      if (row) {
        template = row.template;
      }
    }

    if (!template) {
      res.status(400).json({ error: "Test edilecek proxy şablonu belirtilmedi" });
      return;
    }

    const target = (testUrl || "https://tv-trt1.medya.trt.com.tr/master_720.m3u8").trim();

    // Resolve URL through proxy template
    let resolvedUrl = template;
    if (template.includes("{url}")) {
      resolvedUrl = template.replace("{url}", encodeURIComponent(target));
    } else if (template.includes("{rawUrl}")) {
      resolvedUrl = template.replace("{rawUrl}", target);
    } else if (!template.startsWith("http://") && !template.startsWith("https://")) {
      resolvedUrl = `http://${template}/${target}`;
    }

    if (resolvedUrl.includes("{country}")) {
      resolvedUrl = resolvedUrl.replace("{country}", (country || "TR").toLowerCase());
    }

    if (resolvedUrl.startsWith("/")) {
      const port = process.env.PORT || 3000;
      resolvedUrl = `http://127.0.0.1:${port}${resolvedUrl}`;
    }

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 8000);

    const testRes = await fetch(resolvedUrl, {
      method: "GET",
      signal: abortController.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "*/*",
      },
    });
    clearTimeout(timeout);

    const latencyMs = Date.now() - startTime;
    const corsHeader = testRes.headers.get("access-control-allow-origin");
    const contentType = testRes.headers.get("content-type") || "";
    const isCorsSafe = corsHeader === "*" || Boolean(corsHeader);

    const bodyText = await testRes.text().catch(() => "");
    const preview = bodyText.slice(0, 300);
    const isSuccess = testRes.status >= 200 && testRes.status < 400;

    if (id) {
      if (isSuccess) {
        db.prepare("UPDATE proxies SET success_count = success_count + 1 WHERE id = ?").run(id);
      } else {
        db.prepare("UPDATE proxies SET fail_count = fail_count + 1 WHERE id = ?").run(id);
      }
    }

    res.json({
      ok: true,
      success: isSuccess,
      status: testRes.status,
      statusText: testRes.statusText,
      latencyMs,
      corsAllowed: isCorsSafe,
      corsHeader: corsHeader || "Yok (CORS Kısıtlı)",
      contentType,
      resolvedUrl,
      targetUrl: target,
      preview,
      message: isSuccess
        ? `Proxy bağlantısı başarılı (${latencyMs} ms). ${isCorsSafe ? "CORS başlıkları aktif." : "CORS başlığı tespit edilemedi."}`
        : `Proxy HTTP ${testRes.status} ${testRes.statusText} yanıtı döndü.`,
    });
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    res.json({
      ok: true,
      success: false,
      status: 0,
      statusText: "Error",
      latencyMs,
      corsAllowed: false,
      corsHeader: "Yok",
      contentType: "",
      message: `Bağlantı başarısız: ${err.name === "AbortError" ? "Zaman aşımı (8s)" : err.message}`,
    });
  }
}

export async function handleConsoleCreateClient(req: Request, res: Response) {
  try {
    const { name, ips, rate } = req.body;
    if (!name) {
      res.status(400).json({ error: "İstemci adı zorunludur" });
      return;
    }
    const key = generateApiKey();
    const keyHash = await sha256(key);
    const keyPrefix = key.slice(0, 14);
    const ipList = (ips || "").split(/[\s,]+/).map((s: string) => s.trim()).filter(Boolean);

    const db = getRawDb();
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO api_clients (id, name, key_hash, key_prefix, ip_whitelist, rate_limit_per_min, active, request_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?)
    `).run(id, name, keyHash, keyPrefix, JSON.stringify(ipList), rate || 60, new Date().toISOString());

    res.json({ key });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function handleConsoleAddWebhook(req: Request, res: Response) {
  try {
    const { name, kind, url, chatId } = req.body;
    const db = getRawDb();
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO webhooks (id, name, kind, url, telegram_chat_id, events, active, created_at)
      VALUES (?, ?, ?, ?, ?, '["stream_down","new_source","run_failed"]', 1, ?)
    `).run(id, name, kind || "generic", url, chatId || null, new Date().toISOString());
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function handleConsoleTestWebhook(req: Request, res: Response) {
  try {
    await notify("run_done", "Test bildirimi", "Core Stream Engine bağlantısı başarıyla test edildi.");
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export function handleConsoleAddEpg(req: Request, res: Response) {
  try {
    const { url } = req.body;
    const db = getRawDb();
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO epg_sources (id, url, active, program_count, created_at)
      VALUES (?, ?, 1, 0, ?)
    `).run(id, url, new Date().toISOString());
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export function handleConsoleAddQuery(req: Request, res: Response) {
  try {
    const { engine, query } = req.body;
    const db = getRawDb();
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT OR REPLACE INTO discovery_queries (id, engine, query, active, hit_count, created_at)
      VALUES (?, ?, ?, 1, 0, ?)
    `).run(id, engine || "duckduckgo", query, new Date().toISOString());
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export function handleConsoleToggleResource(req: Request, res: Response) {
  try {
    const { table, id, active, remove } = req.body;
    const allowed = ["proxies", "api_clients", "webhooks", "epg_sources", "discovery_queries"];
    if (!allowed.includes(table)) {
      res.status(400).json({ error: "Geçersiz kaynak tablosu" });
      return;
    }

    const db = getRawDb();
    if (remove) {
      db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    } else {
      db.prepare(`UPDATE ${table} SET active = ? WHERE id = ?`).run(active ? 1 : 0, id);
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// ----------------------------------------------------
// Backup & DB Status Handlers
// ----------------------------------------------------

export function handleBackupStatus(req: Request, res: Response) {
  try {
    const db = getRawDb();
    const streamCount = (db.prepare("SELECT count(*) as c FROM autonomous_streams").get() as { c: number }).c;
    const queryCount = (db.prepare("SELECT count(*) as c FROM discovery_queries").get() as { c: number }).c;
    const logCount = (db.prepare("SELECT count(*) as c FROM scraper_logs").get() as { c: number }).c;
    const clientCount = (db.prepare("SELECT count(*) as c FROM api_clients").get() as { c: number }).c;
    const proxyCount = (db.prepare("SELECT count(*) as c FROM proxies").get() as { c: number }).c;

    res.json({
      status: "healthy",
      database: "Local SQLite (WAL Mode)",
      databasePath: "data/streams.db",
      backupDirectory: "data/backup/",
      counts: {
        autonomous_streams: streamCount,
        discovery_queries: queryCount,
        scraper_logs: logCount,
        api_clients: clientCount,
        proxies: proxyCount,
      },
      supabaseDisconnected: true,
      lovableDisconnected: true,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// ----------------------------------------------------
// Verified & Chunked Consumer API (For Receiver Apps)
// ----------------------------------------------------

export async function handleVerifiedFeed(req: Request, res: Response) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(250, Math.max(1, parseInt((req.query.limit || req.query.chunk_size) as string, 10) || 50));
    const offset = (page - 1) * limit;

    const category = req.query.category as string | undefined;
    const quality = req.query.quality as string | undefined;
    const type = req.query.type as string | undefined;
    const country = req.query.country as string | undefined;
    const q = req.query.q as string | undefined;
    const format = ((req.query.format as string) || (req.path.endsWith(".m3u") ? "m3u" : "json")).toLowerCase();
    const proxied = req.query.proxied !== "0"; // default to CORS-proxied for receiver stability

    const db = getRawDb();

    // Base filter for verified, active, working streams:
    // 1. status = 'active'
    // 2. failure_count < 3
    // 3. valid http/https stream_url
    // 4. title not empty or broken
    let whereClause = `
      status = 'active'
      AND failure_count < 3
      AND stream_url IS NOT NULL
      AND length(stream_url) > 10
      AND (stream_url LIKE 'http://%' OR stream_url LIKE 'https://%')
      AND length(title) > 1
    `;
    const params: any[] = [];

    if (category) {
      whereClause += ` AND category = ?`;
      params.push(category);
    }
    if (quality) {
      whereClause += ` AND quality_tier = ?`;
      params.push(quality.toUpperCase());
    }
    if (type) {
      whereClause += ` AND type = ?`;
      params.push(type);
    }
    if (country) {
      whereClause += ` AND geo_country = ?`;
      params.push(country.toUpperCase());
    }
    if (q) {
      whereClause += ` AND (title LIKE ? OR normalized_title LIKE ? OR category LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    // Total count of verified items matching filter
    const countSql = `SELECT count(*) as total FROM autonomous_streams WHERE ${whereClause}`;
    const totalRow = db.prepare(countSql).get(...params) as { total: number };
    const totalItems = totalRow?.total || 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    // Fetch chunk items
    const selectSql = `
      SELECT id, title, type, category, stream_url, poster_image_url, resolution,
             quality_tier, bitrate_kbps, custom_headers, source, response_ms,
             priority, geo_country, last_checked_at, updated_at
      FROM autonomous_streams
      WHERE ${whereClause}
      ORDER BY priority DESC,
               CASE WHEN geo_country = 'TR' THEN 0 ELSE 1 END,
               CASE WHEN response_ms IS NOT NULL AND response_ms > 0 THEN response_ms ELSE 9999 END ASC,
               updated_at DESC
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(selectSql).all(...params, limit, offset) as any[];

    const protocol = req.protocol || "http";
    const host = req.get("host") || "localhost:3000";
    const origin = `${protocol}://${host}`;

    // M3U Output format for receiver players
    if (format === "m3u") {
      const lines = [
        "#EXTM3U",
        `#EXT-X-FEED-META:PAGE=${page},TOTAL_PAGES=${totalPages},CHUNK_SIZE=${limit},TOTAL_ITEMS=${totalItems}`,
      ];

      for (const s of rows) {
        const cleanTitle = (s.title || "Kanal").replace(/"/g, "");
        const playbackUrl = proxied ? `${origin}/api/public/v1/stream/${s.id}` : s.stream_url;
        lines.push(
          `#EXTINF:-1 tvg-id="${s.id}" tvg-name="${cleanTitle}" tvg-logo="${s.poster_image_url || ""}" group-title="${s.category || "Genel"}",${cleanTitle}`
        );
        lines.push(playbackUrl);
      }

      res.setHeader("Content-Type", "audio/x-mpegurl; charset=utf-8");
      res.setHeader("Content-Disposition", `inline; filename="verified-streams-chunk-${page}.m3u"`);
      res.setHeader("Cache-Control", "public, max-age=30, s-maxage=60");
      res.send(lines.join("\n"));
      return;
    }

    // Standard high-reliability JSON response for receiver applications
    const nextUrl = page < totalPages
      ? `${origin}/api/public/v1/verified-feed?page=${page + 1}&limit=${limit}${category ? `&category=${encodeURIComponent(category)}` : ""}${quality ? `&quality=${encodeURIComponent(quality)}` : ""}${type ? `&type=${encodeURIComponent(type)}` : ""}${country ? `&country=${encodeURIComponent(country)}` : ""}`
      : null;

    const prevUrl = page > 1
      ? `${origin}/api/public/v1/verified-feed?page=${page - 1}&limit=${limit}${category ? `&category=${encodeURIComponent(category)}` : ""}${quality ? `&quality=${encodeURIComponent(quality)}` : ""}${type ? `&type=${encodeURIComponent(type)}` : ""}${country ? `&country=${encodeURIComponent(country)}` : ""}`
      : null;

    const items = rows.map((r) => {
      const playbackUrl = `${origin}/api/public/v1/stream/${r.id}`;
      const corsProxyUrl = `${origin}/api/public/v1/cors-proxy?url=${encodeURIComponent(r.stream_url)}`;

      return {
        id: r.id,
        title: r.title,
        type: r.type || "live_tv",
        category: r.category || "Genel",
        country: r.geo_country || "TR",
        quality: r.quality_tier || r.resolution || "HD",
        resolution: r.resolution || null,
        bitrate_kbps: r.bitrate_kbps || null,
        latency_ms: r.response_ms || null,
        playback_url: playbackUrl,
        direct_url: r.stream_url,
        cors_proxy_url: corsProxyUrl,
        logo: r.poster_image_url || null,
        is_verified: true,
        health: (r.response_ms && r.response_ms < 500) ? "optimal" : "active",
        status: "active",
        last_verified_at: r.last_checked_at || r.updated_at,
      };
    });

    res.setHeader("Cache-Control", "public, max-age=30, s-maxage=60");
    res.json({
      ok: true,
      service: "Core Stream Engine - Verified Feed API",
      status: "stable",
      generated_at: new Date().toISOString(),
      pagination: {
        total_items: totalItems,
        total_chunks: totalPages,
        current_chunk: page,
        chunk_size: limit,
        has_next_chunk: page < totalPages,
        has_prev_chunk: page > 1,
        next_chunk_url: nextUrl,
        prev_chunk_url: prevUrl,
      },
      filters: {
        category: category || null,
        quality: quality || null,
        type: type || null,
        country: country || null,
        q: q || null,
      },
      streams: items,
    });
  } catch (err: any) {
    res.status(500).json({
      ok: false,
      error: "Verified stream feed query error",
      message: err.message,
    });
  }
}

export function handleVerifiedFeedChunks(req: Request, res: Response) {
  try {
    const db = getRawDb();
    const protocol = req.protocol || "http";
    const host = req.get("host") || "localhost:3000";
    const origin = `${protocol}://${host}`;

    const totalVerified = (db.prepare(`
      SELECT count(*) as c FROM autonomous_streams
      WHERE status = 'active'
        AND failure_count < 3
        AND stream_url IS NOT NULL
        AND length(stream_url) > 10
        AND (stream_url LIKE 'http://%' OR stream_url LIKE 'https://%')
        AND length(title) > 1
    `).get() as { c: number }).c;

    const categories = db.prepare(`
      SELECT category, count(*) as count
      FROM autonomous_streams
      WHERE status = 'active' AND failure_count < 3 AND category IS NOT NULL
      GROUP BY category
      ORDER BY count DESC
    `).all() as any[];

    const qualities = db.prepare(`
      SELECT quality_tier, count(*) as count
      FROM autonomous_streams
      WHERE status = 'active' AND failure_count < 3 AND quality_tier IS NOT NULL
      GROUP BY quality_tier
      ORDER BY count DESC
    `).all() as any[];

    const countries = db.prepare(`
      SELECT geo_country, count(*) as count
      FROM autonomous_streams
      WHERE status = 'active' AND failure_count < 3 AND geo_country IS NOT NULL
      GROUP BY geo_country
      ORDER BY count DESC
    `).all() as any[];

    const defaultChunkSize = 50;
    const totalChunks = Math.ceil(totalVerified / defaultChunkSize);

    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=120");
    res.json({
      ok: true,
      service: "Core Stream Engine - Verified Feed Directory",
      total_verified_streams: totalVerified,
      chunk_size_default: defaultChunkSize,
      total_chunks: totalChunks,
      endpoints: {
        feed: `${origin}/api/public/v1/verified-feed?page=1&limit=50`,
        m3u: `${origin}/api/public/v1/verified-feed.m3u?page=1&limit=50`,
      },
      categories: categories.map((c) => ({
        name: c.category,
        count: c.count,
        feed_url: `${origin}/api/public/v1/verified-feed?category=${encodeURIComponent(c.category)}&page=1&limit=50`,
      })),
      qualities: qualities.map((q) => ({
        tier: q.quality_tier,
        count: q.count,
        feed_url: `${origin}/api/public/v1/verified-feed?quality=${encodeURIComponent(q.quality_tier)}&page=1&limit=50`,
      })),
      countries: countries.map((c) => ({
        country: c.geo_country,
        count: c.count,
        feed_url: `${origin}/api/public/v1/verified-feed?country=${encodeURIComponent(c.geo_country)}&page=1&limit=50`,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

