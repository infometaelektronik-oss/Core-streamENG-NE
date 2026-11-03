// AI-assisted content categorization & normalization using Gemini 3.8 Flash and smart heuristics
import { GoogleGenAI, Type } from "@google/genai";

export interface StreamResolutionResult {
  title: string;
  type: "live_tv" | "movie" | "series" | "radio";
  category: string;
  quality: string;
  geo_country?: string | null;
  isTurkish?: boolean;
  confidence: number;
  reasoning?: string;
}

/**
 * Enhanced smart heuristic pattern resolver for Turkish and international channels/streams.
 * Resolves cryptic stream URLs, slugs, and "Bilinmeyen" titles without needing external calls.
 */
export function smartHeuristicResolve(stream: {
  title?: string;
  stream_url?: string;
  url?: string;
  source?: string;
  source_website?: string;
}): StreamResolutionResult {
  const url = (stream.stream_url || stream.url || "").toLowerCase();
  const rawTitle = (stream.title || "").trim();
  const isUnknown =
    !rawTitle ||
    /^(bilinmeyen|unknown|untitled|stream|live|film|video|tv|channel|broadcast|isimsiz)$/i.test(rawTitle) ||
    rawTitle.startsWith("http://") ||
    rawTitle.startsWith("https://") ||
    rawTitle.includes(".m3u8");

  let title = isUnknown ? "" : rawTitle;
  let category = "Diğer";
  let type: StreamResolutionResult["type"] =
    url.includes("/movie/") || url.includes("/movies/") || url.includes("cinema") || /film|movie|sinema/i.test(rawTitle)
      ? "movie"
      : url.includes("/series/") || /dizi|series/i.test(rawTitle)
      ? "series"
      : url.includes("/radio/") || /radyo|radio/i.test(rawTitle)
      ? "radio"
      : "live_tv";
  let quality = "unknown";
  let geo_country: string | null = null;
  let confidence = 0.5;

  // 1. TURKISH BROADCASTER DETECTION & NAME RESOLUTION
  if (url.includes("trt1") || url.includes("trt_1") || /trt\s*1/i.test(rawTitle)) {
    title = "TRT 1 HD";
    category = "Ulusal";
    geo_country = "TR";
    confidence = 0.95;
  } else if (url.includes("trthaber") || url.includes("trt_haber") || /trt\s*haber/i.test(rawTitle)) {
    title = "TRT Haber HD";
    category = "Haber";
    geo_country = "TR";
    confidence = 0.95;
  } else if (url.includes("trtspor") || url.includes("trt_spor") || /trt\s*spor/i.test(rawTitle)) {
    title = url.includes("yildiz") ? "TRT Spor Yıldız HD" : "TRT Spor HD";
    category = "Spor";
    geo_country = "TR";
    confidence = 0.95;
  } else if (url.includes("trtcocuk") || url.includes("trt_cocuk") || /trt\s*çocuk|trt\s*cocuk/i.test(rawTitle)) {
    title = url.includes("diyanet") ? "TRT Diyanet Çocuk" : "TRT Çocuk HD";
    category = "Çocuk";
    geo_country = "TR";
    confidence = 0.95;
  } else if (url.includes("trtbelgesel") || url.includes("trt_belgesel") || /trt\s*belgesel/i.test(rawTitle)) {
    title = "TRT Belgesel HD";
    category = "Belgesel";
    geo_country = "TR";
    confidence = 0.95;
  } else if (url.includes("trtmuzik") || url.includes("trt_muzik") || /trt\s*müzik|trt\s*muzik/i.test(rawTitle)) {
    title = "TRT Müzik HD";
    category = "Müzik";
    geo_country = "TR";
    confidence = 0.95;
  } else if (url.includes("trtworld") || url.includes("trt_world") || /trt\s*world/i.test(rawTitle)) {
    title = "TRT World FHD";
    category = "Haber";
    geo_country = "TR";
    confidence = 0.95;
  } else if (url.includes("trtturk") || url.includes("trt_turk") || /trt\s*türk|trt\s*turk/i.test(rawTitle)) {
    title = "TRT Türk HD";
    category = "Ulusal";
    geo_country = "TR";
    confidence = 0.95;
  } else if (url.includes("trtavaz") || url.includes("trt_avaz")) {
    title = "TRT Avaz HD";
    category = "Ulusal";
    geo_country = "TR";
    confidence = 0.95;
  } else if (url.includes("trtkurdi") || url.includes("trt_kurdi")) {
    title = "TRT Kurdî HD";
    category = "Ulusal";
    geo_country = "TR";
    confidence = 0.95;
  } else if (url.includes("trt2") || url.includes("trt_2")) {
    title = "TRT 2 Kültür Sanat HD";
    category = "Ulusal";
    geo_country = "TR";
    confidence = 0.95;
  } else if (url.includes("kanald") || url.includes("kanal_d") || /kanal\s*d/i.test(rawTitle)) {
    title = "Kanal D HD";
    category = "Ulusal";
    geo_country = "TR";
    confidence = 0.95;
  } else if (url.includes("cnnturk") || url.includes("cnn_turk") || /cnn\s*türk|cnn\s*turk/i.test(rawTitle)) {
    title = "CNN Türk HD";
    category = "Haber";
    geo_country = "TR";
    confidence = 0.95;
  } else if (url.includes("startv") || url.includes("star_tv") || /star\s*tv/i.test(rawTitle)) {
    title = "Star TV HD";
    category = "Ulusal";
    geo_country = "TR";
    confidence = 0.95;
  } else if (url.includes("ntv") || /ntv\s*haber|ntv\s*canli/i.test(rawTitle)) {
    title = "NTV HD";
    category = "Haber";
    geo_country = "TR";
    confidence = 0.95;
  } else if (url.includes("showtv") || url.includes("show_tv") || /show\s*tv/i.test(rawTitle)) {
    title = "Show TV HD";
    category = "Ulusal";
    geo_country = "TR";
    confidence = 0.95;
  } else if (url.includes("haberturk") || /haber\s*türk|haberturk/i.test(rawTitle)) {
    title = "Habertürk TV HD";
    category = "Haber";
    geo_country = "TR";
    confidence = 0.95;
  } else if (url.includes("atv") || /atv\s*canli|atv\s*türkiye/i.test(rawTitle)) {
    if (url.includes("aspor")) {
      title = "A Spor HD";
      category = "Spor";
    } else if (url.includes("ahaber")) {
      title = "A Haber HD";
      category = "Haber";
    } else if (url.includes("apara")) {
      title = "A Para HD";
      category = "Haber";
    } else if (url.includes("a2")) {
      title = "A2 TV HD";
      category = "Ulusal";
    } else {
      title = "ATV HD";
      category = "Ulusal";
    }
    geo_country = "TR";
    confidence = 0.95;
  } else if (url.includes("tv8") || /tv8\s*canli/i.test(rawTitle)) {
    title = url.includes("bucuk") || url.includes("8bucuk") || url.includes("8.5") ? "TV8.5 HD" : "TV8 HD";
    category = "Ulusal";
    geo_country = "TR";
    confidence = 0.95;
  } else if (url.includes("nowtv") || url.includes("foxtv") || /now\s*tv|fox\s*tv/i.test(rawTitle)) {
    title = "NOW TV HD (Fox)";
    category = "Ulusal";
    geo_country = "TR";
    confidence = 0.95;
  } else if (url.includes("sozcu") || url.includes("szctv") || /sözcü|sozcu|szc/i.test(rawTitle)) {
    title = "Sözcü TV HD (SZC)";
    category = "Haber";
    geo_country = "TR";
    confidence = 0.95;
  } else if (url.includes("halktv") || url.includes("halk_tv") || /halk\s*tv/i.test(rawTitle)) {
    title = "Halk TV HD";
    category = "Haber";
    geo_country = "TR";
    confidence = 0.95;
  } else if (url.includes("tele1") || /tele\s*1/i.test(rawTitle)) {
    title = "Tele1 HD";
    category = "Haber";
    geo_country = "TR";
    confidence = 0.95;
  } else if (url.includes("bloomberght") || /bloomberg\s*ht/i.test(rawTitle)) {
    title = "Bloomberg HT HD";
    category = "Haber";
    geo_country = "TR";
    confidence = 0.95;
  } else if (url.includes("kanal7") || /kanal\s*7/i.test(rawTitle)) {
    title = "Kanal 7 HD";
    category = "Ulusal";
    geo_country = "TR";
    confidence = 0.95;
  } else if (url.includes("teve2") || /teve\s*2/i.test(rawTitle)) {
    title = "teve2 HD";
    category = "Ulusal";
    geo_country = "TR";
    confidence = 0.95;
  } else if (url.includes("dmax") || /dmax/i.test(rawTitle)) {
    title = "DMAX Türkiye HD";
    category = "Belgesel";
    geo_country = "TR";
    confidence = 0.90;
  } else if (url.includes("tlc") || /tlc/i.test(rawTitle)) {
    title = "TLC Türkiye HD";
    category = "Belgesel";
    geo_country = "TR";
    confidence = 0.90;
  } else if (url.includes("kralpop") || url.includes("kralpoptv")) {
    title = "Kral Pop TV HD";
    category = "Müzik";
    geo_country = "TR";
    confidence = 0.90;
  } else if (url.includes("powerturk") || url.includes("power_turk")) {
    title = "Power Türk TV HD";
    category = "Müzik";
    geo_country = "TR";
    confidence = 0.90;
  }

  // 2. INTERNATIONAL / GENERAL PATTERNS
  if (!title) {
    if (url.includes("bbc")) {
      title = "BBC News HD";
      category = "Haber";
    } else if (url.includes("cnn") && !url.includes("turk")) {
      title = "CNN International HD";
      category = "Haber";
    } else if (url.includes("aljazeera")) {
      title = "Al Jazeera English HD";
      category = "Haber";
    } else if (url.includes("eurosport")) {
      title = "Eurosport HD";
      category = "Spor";
    } else if (url.includes("disney")) {
      title = "Disney Channel HD";
      category = "Çocuk";
    } else if (url.includes("cartoon")) {
      title = "Cartoon Network HD";
      category = "Çocuk";
    } else if (url.includes("discovery")) {
      title = "Discovery Channel HD";
      category = "Belgesel";
    } else if (url.includes("natgeo") || url.includes("nationalgeographic")) {
      title = "National Geographic HD";
      category = "Belgesel";
    } else if (url.includes("sport") || /sport|futbol|fifa|uefa/i.test(url)) {
      title = "Spor Yayını";
      category = "Spor";
    } else if (url.includes("movie") || url.includes("cinema") || url.includes("film")) {
      title = "Sinema Kanalı";
      category = "Sinema";
      type = "movie";
    } else if (url.includes("series") || url.includes("dizi")) {
      title = "Dizi Kanalı";
      category = "Dizi";
      type = "series";
    } else if (url.includes("radio") || url.includes("radyo")) {
      title = "Canlı Radyo";
      category = "Radyo";
      type = "radio";
    } else {
      // Extract from URL slug
      try {
        const u = new URL(stream.stream_url || stream.url || "http://localhost");
        const parts = u.pathname.split("/").filter(Boolean);
        const last = parts[parts.length - 1] || "";
        const cleanSlug = last.replace(/\.(m3u8|mp4|m3u|ts)$/i, "").replace(/[-_]/g, " ").trim();
        if (cleanSlug && cleanSlug.length > 2 && !/^(master|index|playlist|live|stream|chunklist)$/i.test(cleanSlug)) {
          title = cleanSlug.charAt(0).toUpperCase() + cleanSlug.slice(1);
        } else {
          title = u.hostname.replace(/^www\./, "").split(".")[0].toUpperCase() + " Yayını";
        }
      } catch {
        title = "Canlı Akış";
      }
    }
  }

  // Quality estimation
  if (url.includes("1080") || /1080p|fhd/i.test(title)) quality = "1080P";
  else if (url.includes("720") || /720p|hd/i.test(title)) quality = "720P";
  else if (url.includes("480") || /480p|sd/i.test(title)) quality = "480P";
  else if (url.includes("4k") || url.includes("2160")) quality = "4K";
  else if (type === "radio") quality = "AUDIO";

  return {
    title,
    type,
    category,
    quality,
    geo_country,
    isTurkish: geo_country === "TR",
    confidence,
  };
}

/**
 * Resolves a single stream with Google Gemini 3.8 Flash API
 */
export async function resolveStreamWithGemini(stream: {
  id?: string;
  title?: string;
  stream_url: string;
  category?: string;
  resolution?: string;
  source?: string;
  source_website?: string;
}): Promise<StreamResolutionResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const prompt = `Sen dünya çapında ve özellikle Türkiye'deki IPTV, canlı televizyon, radyo, sinema filmi ve dizi akışlarını inceleyen uzman bir yapay zekasın.
Aşağıda verilen akış linkini, mevcut başlığını ve domain bilgilerini incele.
Eğer başlık "Bilinmeyen", "Untitled", GitHub dosya yolu veya anlamsızsa, akış linkinin URL yapısından, subdomain/domain adından ve parametrelerinden gerçek kanal, film veya yayın ismini tespit et.
Özellikle Türkiye kanalları (TRT kanalları, ATV, Kanal D, Star TV, Show TV, NOW TV, TV8, Sözcü TV, Halk TV, Tele1, Habertürk, CNN Türk, NTV vb.) için standart resmi Türkçe kanal ismini yaz (Örn: "TRT 1 HD", "Kanal D HD", "TRT Spor HD").

İncelenecek Akış Verisi:
- Başlık: ${stream.title || "Bilinmeyen"}
- URL: ${stream.stream_url}
- Kaynak Site: ${stream.source_website || stream.source || "Bilinmiyor"}
- Mevcut Kategori: ${stream.category || "Bilinmiyor"}

JSON Formatında döndür:
{
  "title": "Temizlenmiş, standart ve doğru kanal / film adı",
  "type": "live_tv | movie | series | radio",
  "category": "Ulusal | Haber | Spor | Belgesel | Sinema | Dizi | Çocuk | Müzik | Eğlence | Dini | Radyo | Diğer",
  "quality": "4K | 1080P | 720P | 480P | SD | AUDIO",
  "isTurkish": true / false,
  "reasoning": "Kısa açıklama (örn: Duhnet CDN kanald slug tespiti)"
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              type: { type: Type.STRING },
              category: { type: Type.STRING },
              quality: { type: Type.STRING },
              isTurkish: { type: Type.BOOLEAN },
              reasoning: { type: Type.STRING },
            },
            required: ["title", "type", "category"],
          },
        },
      });

      const jsonStr = (response.text ?? "").trim();
      if (jsonStr) {
        const parsed = JSON.parse(jsonStr);
        const validTypes = ["live_tv", "movie", "series", "radio"] as const;
        const mappedType = validTypes.includes(parsed.type) ? parsed.type : "live_tv";

        return {
          title: parsed.title || stream.title || "Bilinmeyen Akış",
          type: mappedType,
          category: parsed.category || "Diğer",
          quality: parsed.quality || "720P",
          geo_country: parsed.isTurkish ? "TR" : null,
          confidence: 0.98,
          reasoning: parsed.reasoning,
        };
      }
    } catch (err: any) {
      console.warn("[Gemini AI classify error]:", err?.message);
    }
  }

  // Fallback to advanced smart heuristic pattern matcher
  return smartHeuristicResolve(stream);
}

/**
 * Batch resolves multiple streams at once using Gemini 3.8 Flash for maximum speed
 */
export async function batchResolveStreamsWithGemini(
  streams: Array<{ id: string; title?: string; stream_url: string; category?: string }>
): Promise<Map<string, StreamResolutionResult>> {
  const results = new Map<string, StreamResolutionResult>();
  if (!streams.length) return results;

  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const streamList = streams.map((s, idx) => ({
        index: idx,
        id: s.id,
        currentTitle: s.title || "Bilinmeyen",
        url: s.stream_url,
      }));

      const prompt = `Sen profesyonel IPTV akış analiz motorusun. Aşağıdaki ${streams.length} adet akışın linklerini ve başlıklarını analiz et.
Her biri için:
- İsmi "Bilinmeyen" veya anlamsız ise URL yapısından, subdomain/domain adından ve yayıncı kimliğinden gerçek kanal veya film/dizi adını tespit et.
- Türkiye kanallarını (TRT, ATV, Kanal D, Star TV, Show TV, TV8, NOW, Sözcü, Halk TV, CNN Türk, NTV vb.) standart resmi Türkçe adıyla adlandır ve isTurkish: true yap.
- Doğru tür ve kategori ata.

Akış Listesi:
${JSON.stringify(streamList, null, 2)}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                type: { type: Type.STRING },
                category: { type: Type.STRING },
                quality: { type: Type.STRING },
                isTurkish: { type: Type.BOOLEAN },
              },
              required: ["id", "title", "type", "category"],
            },
          },
        },
      });

      const jsonStr = (response.text ?? "").trim();
      if (jsonStr) {
        const items = JSON.parse(jsonStr) as Array<{
          id: string;
          title: string;
          type: "live_tv" | "movie" | "series" | "radio";
          category: string;
          quality?: string;
          isTurkish?: boolean;
        }>;

        for (const item of items) {
          results.set(item.id, {
            title: item.title,
            type: item.type || "live_tv",
            category: item.category || "Diğer",
            quality: item.quality || "720P",
            geo_country: item.isTurkish ? "TR" : null,
            confidence: 0.98,
          });
        }
      }
    } catch (err: any) {
      console.warn("[Gemini Batch Error]:", err?.message);
    }
  }

  // For any streams that failed or were omitted, resolve using smart heuristics
  for (const s of streams) {
    if (!results.has(s.id)) {
      results.set(s.id, smartHeuristicResolve(s));
    }
  }

  return results;
}

// Backward-compatible classifyContent function for scraper orchestrator
export async function classifyContent(
  hint: { title?: string; description?: string; sourceUrl?: string; streamUrl: string }
) {
  const res = await resolveStreamWithGemini({
    title: hint.title,
    stream_url: hint.streamUrl,
    source_website: hint.sourceUrl,
  });

  return {
    title: res.title,
    type: res.type,
    category: res.category,
    quality: res.quality,
  };
}
