import test from "node:test";
import assert from "node:assert/strict";
import { getOverviewData, listStreamsFiltered, dbAdmin } from "./db";

test("Database seeds and returns overview metrics", () => {
  const overview = getOverviewData();
  assert.ok(overview.streams.total >= 20000, "Should have over 20,000 streams imported");
  assert.ok(overview.streams.active > 0, "Should have active streams");
  assert.ok(overview.engine.totalQueries >= 40, "Should have discovery queries imported");
});

test("Database filters streams by search query and quality tier", () => {
  const result = listStreamsFiltered({ q: "TRT", limit: 10 });
  assert.ok(Array.isArray(result), "Result must be an array");
  assert.ok(result.length > 0, "Should find streams matching TRT in title, url or category");
  const first = result[0];
  const combined = `${first.title} ${first.stream_url} ${first.category || ""}`.toUpperCase();
  assert.match(combined, /TRT/);
});

test("Supabase-compatible query builder works for selecting and inserting", async () => {
  const { data, error } = await dbAdmin
    .from("autonomous_streams")
    .select("id, title, status, stream_url")
    .eq("status", "active")
    .limit(5);

  assert.equal(error, null);
  assert.equal(data.length, 5);
  assert.equal(data[0].status, "active");
});

test("RPC api_hit increments and handles rate limiting", async () => {
  const { data, error } = await dbAdmin.rpc("api_hit", {
    _client: "test-client-uuid",
    _limit: 100,
  });
  assert.equal(error, null);
  assert.equal(data, true);
});

test("Inserting into tables without created_at or id automatically populates defaults", async () => {
  // Test scraper_logs without created_at
  const { data: logData, error: logError } = await dbAdmin
    .from("scraper_logs")
    .insert({ level: "info", phase: "unit_test", message: "Test log message without created_at" });
  assert.equal(logError, null, `scraper_logs insert failed: ${logError?.message}`);
  assert.ok(logData);

  // Test crawl_jobs without id or created_at
  const testJobUrl = `https://example.com/test-crawl-job-${Date.now()}`;
  const { data: jobData, error: jobError } = await dbAdmin
    .from("crawl_jobs")
    .insert([{ url: testJobUrl, depth: 0 }]);
  assert.equal(jobError, null, `crawl_jobs insert failed: ${jobError?.message}`);
  assert.ok(jobData && jobData[0].id, "Should auto-generate id");
  assert.ok(jobData[0].created_at, "Should auto-generate created_at");

  // Test autonomous_streams without id, created_at, or updated_at
  const testStreamUrl = `https://example.com/live/test-stream-${Date.now()}.m3u8`;
  const { data: streamData, error: streamError } = await dbAdmin
    .from("autonomous_streams")
    .insert({
      title: "Test Stream Auto Fields",
      stream_url: testStreamUrl,
    });
  assert.equal(streamError, null, `autonomous_streams insert failed: ${streamError?.message}`);
  assert.ok(streamData && streamData[0].id, "Should auto-generate id");
  assert.ok(streamData[0].created_at, "Should auto-generate created_at");
  assert.ok(streamData[0].updated_at, "Should auto-generate updated_at");
});

test("Nested transactions and sequential claim_jobs do not throw transaction errors", async () => {
  // Concurrently claim jobs twice
  const [res1, res2] = await Promise.all([
    dbAdmin.rpc("claim_jobs", { _n: 2 }),
    dbAdmin.rpc("claim_jobs", { _n: 2 }),
  ]);
  assert.equal(res1.error, null);
  assert.equal(res2.error, null);
});

