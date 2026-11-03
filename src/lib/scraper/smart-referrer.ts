// Domain-aware Referer and User-Agent resolution for Turkish and international TV/media CDNs.
// Solves CORS and hotlinking restrictions applied by Turkish broadcasters and IPTV providers.

export type StreamNetworkHeaders = Record<string, string>;

const DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";
const VLC_UA = "VLC/3.0.21 LibVLC/3.0.21";
const SMART_TV_UA = "Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/538.1 (KHTML, like Gecko) Version/6.0 TV Safari/538.1";

/**
 * Determines the required Referer, Origin, and User-Agent headers for a given stream URL
 * to bypass anti-hotlinking / token / geo / CORS protections.
 */
export function getSmartStreamHeaders(
  streamUrl: string,
  explicitReferer?: string,
  customHeaders?: Record<string, string>
): Record<string, string> {
  const url = (streamUrl || "").toLowerCase();
  const headers: Record<string, string> = {
    "User-Agent": customHeaders?.["User-Agent"] || DEFAULT_UA,
    Accept: "*/*",
    ...(customHeaders || {}),
  };

  // If explicit referer was passed in playlist or DB, prioritize it
  if (explicitReferer && explicitReferer.startsWith("http")) {
    headers.Referer = explicitReferer;
    try {
      headers.Origin = new URL(explicitReferer).origin;
    } catch {
      /* ignore */
    }
    return headers;
  }

  // Domain & Broadcaster Detection Rules:
  // 1. Show TV / Ciner Group
  if (url.includes("ciner.daioncdn.net") || url.includes("showtv") || url.includes("bloomberght") || url.includes("haberturk")) {
    if (url.includes("showtv")) {
      headers.Referer = "https://www.showtv.com.tr/";
      headers.Origin = "https://www.showtv.com.tr";
    } else if (url.includes("haberturk")) {
      headers.Referer = "https://www.haberturk.com/";
      headers.Origin = "https://www.haberturk.com";
    } else if (url.includes("bloomberg")) {
      headers.Referer = "https://www.bloomberght.com/";
      headers.Origin = "https://www.bloomberght.com";
    } else {
      headers.Referer = "https://www.showtv.com.tr/";
      headers.Origin = "https://www.showtv.com.tr";
    }
    headers["User-Agent"] = DEFAULT_UA;
    return headers;
  }

  // 2. Star TV / NTV / Kral Pop / Doğuş Group
  if (url.includes("dogus.daioncdn.net") || url.includes("startv") || url.includes("ntv") || url.includes("kralpop") || url.includes("kralmuzik")) {
    if (url.includes("startv")) {
      headers.Referer = "https://www.startv.com.tr/";
      headers.Origin = "https://www.startv.com.tr";
    } else if (url.includes("ntv")) {
      headers.Referer = "https://www.ntv.com.tr/";
      headers.Origin = "https://www.ntv.com.tr";
    } else if (url.includes("kral")) {
      headers.Referer = "https://www.kralmuzik.com.tr/";
      headers.Origin = "https://www.kralmuzik.com.tr";
    } else {
      headers.Referer = "https://www.startv.com.tr/";
      headers.Origin = "https://www.startv.com.tr";
    }
    headers["User-Agent"] = DEFAULT_UA;
    return headers;
  }

  // 3. NOW TV (Former Fox TV) / TurkNet CDN
  if (url.includes("nowtv") || url.includes("rkhubpaomb.turknet.ercdn.net") || url.includes("foxtv")) {
    headers.Referer = "https://www.nowtv.com.tr/";
    headers.Origin = "https://www.nowtv.com.tr";
    headers["User-Agent"] = DEFAULT_UA;
    return headers;
  }

  // 4. ATV / A Haber / A Spor / Turkuvaz Group / TurkNet CDN
  if (url.includes("atv") || url.includes("ahaber") || url.includes("aspor") || url.includes("apara") || url.includes("rnttwmjcin.turknet.ercdn.net")) {
    if (url.includes("aspor")) {
      headers.Referer = "https://www.aspor.com.tr/";
      headers.Origin = "https://www.aspor.com.tr";
    } else if (url.includes("ahaber")) {
      headers.Referer = "https://www.ahaber.com.tr/";
      headers.Origin = "https://www.ahaber.com.tr";
    } else {
      headers.Referer = "https://www.atv.com.tr/";
      headers.Origin = "https://www.atv.com.tr";
    }
    headers["User-Agent"] = DEFAULT_UA;
    return headers;
  }

  // 5. Kanal D / teve2 / Demirören / Duhnet / TurkNet CDN
  if (url.includes("kanald") || url.includes("teve2") || url.includes("ackaxsqacw.turknet.ercdn.net") || url.includes("live.duhnet.tv") || url.includes("cnnturk")) {
    if (url.includes("cnnturk")) {
      headers.Referer = "https://www.cnnturk.com/";
      headers.Origin = "https://www.cnnturk.com";
    } else if (url.includes("teve2")) {
      headers.Referer = "https://www.teve2.com.tr/";
      headers.Origin = "https://www.teve2.com.tr";
    } else {
      headers.Referer = "https://www.kanald.com.tr/";
      headers.Origin = "https://www.kanald.com.tr";
    }
    headers["User-Agent"] = DEFAULT_UA;
    return headers;
  }

  // 6. TV8 / TV8.5 / Acun Medya
  if (url.includes("tv8") || url.includes("tv8bucuk")) {
    headers.Referer = "https://www.tv8.com.tr/";
    headers.Origin = "https://www.tv8.com.tr";
    headers["User-Agent"] = DEFAULT_UA;
    return headers;
  }

  // 7. TRT (Turkish Radio & Television Corporation)
  if (url.includes("trt.com.tr") || url.includes("trt1") || url.includes("trthaber") || url.includes("trtspor") || url.includes("trtbelgesel") || url.includes("trtmuzik") || url.includes("trtcocuk")) {
    headers.Referer = "https://www.trtizle.com/";
    headers.Origin = "https://www.trtizle.com";
    headers["User-Agent"] = SMART_TV_UA;
    return headers;
  }

  // 8. Sözcü TV (SZC)
  if (url.includes("sozcutv") || url.includes("sozcu")) {
    headers.Referer = "https://www.sozcu.com.tr/";
    headers.Origin = "https://www.sozcu.com.tr";
    headers["User-Agent"] = DEFAULT_UA;
    return headers;
  }

  // 9. Halk TV
  if (url.includes("halktv")) {
    headers.Referer = "https://halktv.com.tr/";
    headers.Origin = "https://halktv.com.tr";
    return headers;
  }

  // 10. Tele1
  if (url.includes("tele1")) {
    headers.Referer = "https://tele1.com.tr/";
    headers.Origin = "https://tele1.com.tr";
    return headers;
  }

  // 11. Kanal 7
  if (url.includes("kanal7") || url.includes("blutv.com/kanal7")) {
    headers.Referer = "https://www.kanal7.com/";
    headers.Origin = "https://www.kanal7.com";
    return headers;
  }

  // 12. Generic fallback: use the stream's own origin as referer
  try {
    const origin = new URL(streamUrl).origin;
    headers.Referer = `${origin}/`;
    headers.Origin = origin;
  } catch {
    headers["User-Agent"] = VLC_UA;
  }

  return headers;
}
