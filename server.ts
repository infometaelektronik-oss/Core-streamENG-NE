import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getRawDb } from "./src/lib/db";
import {
  handleCors,
  handlePlaylistM3u,
  handleEpgXml,
  handleStreamsList,
  handleStreamProxy,
  handleUniversalCorsProxy,
  handleVerifiedFeed,
  handleVerifiedFeedChunks,
  handleHookDiscover,
  handleHookWorker,
  handleHookHealth,
  handleHookEpg,
  handleConsoleClaimAdmin,
  handleConsoleOverview,
  handleConsoleStreams,
  handleConsoleUpdateStream,
  handleConsoleRunEngine,
   handleConsoleResources,
  handleConsoleAddProxy,
  handleConsoleTestProxy,
  handleConsoleCreateClient,
  handleConsoleAddWebhook,
  handleConsoleTestWebhook,
  handleConsoleAddEpg,
  handleConsoleAddQuery,
  handleConsoleToggleResource,
  handleBackupStatus,
  handleConsoleAiResolveStream,
  handleConsoleAiResolveBatch,
  handleConsoleSeedTurkish,
} from "./src/lib/server-api";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  // Initialize local SQLite database and verify tables
  console.log("[Core Stream Engine] Initializing local database...");
  getRawDb();
  console.log("[Core Stream Engine] Local database ready (SQLite WAL mode).");

  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(handleCors);

  // ------------------------------------------------------------------
  // 1. Public IPTV & API v1 Routes
  // ------------------------------------------------------------------
  app.get("/api/public/v1/playlist.m3u", handlePlaylistM3u);
  app.get("/api/public/v1/playlist", handlePlaylistM3u);
  app.get("/api/public/v1/epg.xml", handleEpgXml);
  app.get("/api/public/v1/epg", handleEpgXml);
  app.get("/api/public/v1/streams", handleStreamsList);
  app.get("/api/public/v1/stream/:id", handleStreamProxy);
  app.options("/api/public/v1/stream/:id", handleStreamProxy);
  app.get("/api/public/v1/cors-proxy", handleUniversalCorsProxy);
  app.options("/api/public/v1/cors-proxy", handleUniversalCorsProxy);

  // Verified & Chunked Consumer API (For Receiver Applications)
  app.get("/api/public/v1/verified-feed", handleVerifiedFeed);
  app.get("/api/public/v1/verified-feed.m3u", handleVerifiedFeed);
  app.get("/api/public/v1/verified-feed/chunks", handleVerifiedFeedChunks);

  // ------------------------------------------------------------------
  // 2. Scheduled Cron Hooks
  // ------------------------------------------------------------------
  app.get("/api/public/hooks/engine-discover", handleHookDiscover);
  app.post("/api/public/hooks/engine-discover", handleHookDiscover);

  app.get("/api/public/hooks/engine-worker", handleHookWorker);
  app.post("/api/public/hooks/engine-worker", handleHookWorker);

  app.get("/api/public/hooks/engine-health", handleHookHealth);
  app.post("/api/public/hooks/engine-health", handleHookHealth);

  app.get("/api/public/hooks/engine-epg", handleHookEpg);
  app.post("/api/public/hooks/engine-epg", handleHookEpg);

  // ------------------------------------------------------------------
  // 3. Admin Console Endpoints
  // ------------------------------------------------------------------
  app.post("/api/console/claim-admin", handleConsoleClaimAdmin);
  app.get("/api/console/claim-admin", handleConsoleClaimAdmin);
  app.get("/api/console/overview", handleConsoleOverview);
  app.get("/api/console/streams", handleConsoleStreams);
  app.post("/api/console/streams/update", handleConsoleUpdateStream);
  app.post("/api/console/run-engine", handleConsoleRunEngine);
  app.get("/api/console/resources", handleConsoleResources);
  app.post("/api/console/proxy/add", handleConsoleAddProxy);
  app.post("/api/console/proxy/test", handleConsoleTestProxy);
  app.post("/api/console/client/create", handleConsoleCreateClient);
  app.post("/api/console/webhook/add", handleConsoleAddWebhook);
  app.post("/api/console/webhook/test", handleConsoleTestWebhook);
  app.post("/api/console/epg/add", handleConsoleAddEpg);
  app.post("/api/console/query/add", handleConsoleAddQuery);
  app.post("/api/console/resource/toggle", handleConsoleToggleResource);
  app.get("/api/console/backup-status", handleBackupStatus);
  app.post("/api/console/ai/resolve-stream", handleConsoleAiResolveStream);
  app.post("/api/console/ai/resolve-unknowns", handleConsoleAiResolveBatch);
  app.post("/api/console/seed-turkish", handleConsoleSeedTurkish);

  // ------------------------------------------------------------------
  // 4. Vite Dev Server vs Production Static Files
  // ------------------------------------------------------------------
  const isProd = process.env.NODE_ENV === "production";

  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== "true" },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Core Stream Engine] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[Fatal Startup Error]:", err);
  process.exit(1);
});
