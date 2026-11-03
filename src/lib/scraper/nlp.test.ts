import test from "node:test";
import assert from "node:assert/strict";
import { smartHeuristicResolve } from "./nlp.server.js";

test("smartHeuristicResolve correctly identifies TRT 1 and Turkish channels", () => {
  const trt1 = smartHeuristicResolve({
    title: "bilinmeyen",
    url: "https://tv-trt1.medya.trt.com.tr/master.m3u8",
  });
  assert.equal(trt1.title, "TRT 1 HD");
  assert.equal(trt1.type, "live_tv");
  assert.equal(trt1.category, "Ulusal");
  assert.equal(trt1.isTurkish, true);

  const atv = smartHeuristicResolve({
    title: "http://turknet.live.atv.com.tr/atv/live.m3u8",
    url: "http://turknet.live.atv.com.tr/atv/live.m3u8",
  });
  assert.equal(atv.title, "ATV HD");
  assert.equal(atv.type, "live_tv");
  assert.equal(atv.category, "Ulusal");
  assert.equal(atv.isTurkish, true);

  const sozcu = smartHeuristicResolve({
    title: "Untitled",
    url: "https://sozcutv.daioncdn.net/sozcutv/sozcutv.m3u8",
  });
  assert.ok(sozcu.title.includes("Sözcü TV"));
  assert.equal(sozcu.category, "Haber");
  assert.equal(sozcu.isTurkish, true);
});

test("smartHeuristicResolve correctly identifies sports and movie channels", () => {
  const trtSpor = smartHeuristicResolve({
    title: "stream",
    url: "https://tv-trtspor.medya.trt.com.tr/master.m3u8",
  });
  assert.equal(trtSpor.title, "TRT Spor HD");
  assert.equal(trtSpor.category, "Spor");
  assert.equal(trtSpor.isTurkish, true);

  const movie = smartHeuristicResolve({
    title: "film",
    url: "https://cdn.example.com/movie/cinema-channel.m3u8",
  });
  assert.equal(movie.type, "movie");
  assert.equal(movie.category, "Sinema");
});
