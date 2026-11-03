import test from "node:test";
import assert from "node:assert/strict";
import { getSmartStreamHeaders } from "./smart-referrer.js";
import { parseM3uExtended } from "./m3u-parser.js";

test("getSmartStreamHeaders accurately maps Turkish broadcasters to official Referer & Origin", () => {
  // Show TV (Ciner / daioncdn)
  const showHeaders = getSmartStreamHeaders("https://ciner.daioncdn.net/showtv/showtv.m3u8?app=web");
  assert.equal(showHeaders.Referer, "https://www.showtv.com.tr/");
  assert.equal(showHeaders.Origin, "https://www.showtv.com.tr");

  // Star TV (Doğuş / daioncdn)
  const starHeaders = getSmartStreamHeaders("https://dogus.daioncdn.net/startv/startv.m3u8?app=web");
  assert.equal(starHeaders.Referer, "https://www.startv.com.tr/");
  assert.equal(starHeaders.Origin, "https://www.startv.com.tr");

  // ATV (TurkNet / ercdn)
  const atvHeaders = getSmartStreamHeaders("https://rnttwmjcin.turknet.ercdn.net/lcpmvefbyo/atv/atv_720p.m3u8");
  assert.equal(atvHeaders.Referer, "https://www.atv.com.tr/");
  assert.equal(atvHeaders.Origin, "https://www.atv.com.tr");

  // NOW TV
  const nowHeaders = getSmartStreamHeaders("https://rkhubpaomb.turknet.ercdn.net/nowtv/nowtv_720p.m3u8");
  assert.equal(nowHeaders.Referer, "https://www.nowtv.com.tr/");

  // Kanal D
  const kanalDHeaders = getSmartStreamHeaders("https://ackaxsqacw.turknet.ercdn.net/ozfkfbbjba/kanald/kanald_1080p.m3u8");
  assert.equal(kanalDHeaders.Referer, "https://www.kanald.com.tr/");

  // TV8
  const tv8Headers = getSmartStreamHeaders("https://tv8.daioncdn.net/tv8/tv8.m3u8");
  assert.equal(tv8Headers.Referer, "https://www.tv8.com.tr/");
});

test("parseM3uExtended correctly parses IPTV playlist with titles, logos, categories and VLC headers", () => {
  const sampleM3u = `#EXTM3U
#EXTINF:-1 tvg-id="trt1" tvg-name="TRT 1 HD" tvg-logo="https://example.com/trt1.png" group-title="Ulusal",TRT 1 HD
https://tv-trt1.medya.trt.com.tr/master_720.m3u8
#EXTINF:-1 tvg-id="show" tvg-name="Show TV" tvg-logo="https://example.com/show.png" group-title="Ulusal",Show TV HD
#EXTVLCOPT:http-referrer=https://www.showtv.com.tr/
https://ciner.daioncdn.net/showtv/showtv.m3u8?app=showtv_web
#EXTINF:-1 tvg-id="spor" group-title="Spor",TRT Spor HD
https://tv-trtspor.medya.trt.com.tr/master.m3u8
`;

  const parsed = parseM3uExtended(sampleM3u);
  assert.equal(parsed.items.length, 3);

  const trt1 = parsed.items[0];
  assert.equal(trt1.title, "TRT 1 HD");
  assert.equal(trt1.category, "Ulusal");
  assert.equal(trt1.logo, "https://example.com/trt1.png");
  assert.equal(trt1.epgId, "trt1");

  const show = parsed.items[1];
  assert.equal(show.title, "Show TV HD");
  assert.equal(show.category, "Ulusal");
  assert.equal(show.customHeaders["Referer"], "https://www.showtv.com.tr/");

  const spor = parsed.items[2];
  assert.equal(spor.title, "TRT Spor HD");
  assert.equal(spor.category, "Spor");
});
