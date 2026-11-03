// Robust parser for Extended M3U / M3U8 playlists.
// Extracts structured channel metadata (#EXTINF, tvg-name, tvg-logo, group-title, headers)
// and handles nested master playlists with quality resolution.

export interface ParsedM3uItem {
  title: string;
  streamUrl: string;
  category: string;
  logo: string | null;
  epgId: string | null;
  qualityTier: "FHD" | "HD" | "SD" | "AUDIO" | "unknown";
  resolution: string | null;
  bitrateKbps: number | null;
  customHeaders: Record<string, string>;
  rawExtInf?: string;
}

export interface ParsedPlaylistResult {
  isMasterPlaylist: boolean;
  items: ParsedM3uItem[];
  totalChannels: number;
}

function tierFromHeight(h: number): ParsedM3uItem["qualityTier"] {
  if (h >= 1080) return "FHD";
  if (h >= 576) return "HD";
  if (h > 0) return "SD";
  return "unknown";
}

/**
 * Parses full extended M3U/M3U8 text into rich stream items.
 */
export function parseM3uExtended(content: string, baseUrl?: string): ParsedPlaylistResult {
  const lines = content.split(/\r?\n/).map((l) => l.trim());
  const items: ParsedM3uItem[] = [];
  let isMasterPlaylist = false;

  let currentTitle = "";
  let currentCategory = "Diğer";
  let currentLogo: string | null = null;
  let currentEpgId: string | null = null;
  let currentHeaders: Record<string, string> = {};
  let currentResolution: string | null = null;
  let currentBitrate: number | null = null;
  let currentTier: ParsedM3uItem["qualityTier"] = "unknown";
  let rawExtInf = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Detect master playlist variant tag
    if (line.startsWith("#EXT-X-STREAM-INF:")) {
      isMasterPlaylist = true;
      const resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/i);
      const bwMatch = line.match(/(?:AVERAGE-)?BANDWIDTH=(\d+)/i);

      if (resMatch) {
        const height = parseInt(resMatch[2], 10);
        currentResolution = `${resMatch[1]}x${resMatch[2]}`;
        currentTier = tierFromHeight(height);
      }
      if (bwMatch) {
        currentBitrate = Math.round(parseInt(bwMatch[1], 10) / 1000);
      }
      continue;
    }

    // Parse #EXTVLCOPT headers (commonly used in IPTV lists)
    if (line.startsWith("#EXTVLCOPT:")) {
      const opt = line.slice(11).trim();
      const eqIdx = opt.indexOf("=");
      if (eqIdx !== -1) {
        const key = opt.slice(0, eqIdx).trim().toLowerCase();
        const val = opt.slice(eqIdx + 1).trim();
        if (key === "http-referrer" || key === "http-referer") {
          currentHeaders["Referer"] = val;
        } else if (key === "http-user-agent") {
          currentHeaders["User-Agent"] = val;
        }
      }
      continue;
    }

    // Parse #EXTHTTP headers
    if (line.startsWith("#EXTHTTP:")) {
      try {
        const jsonStr = line.slice(9).trim();
        const parsed = JSON.parse(jsonStr);
        if (typeof parsed === "object" && parsed !== null) {
          Object.assign(currentHeaders, parsed);
        }
      } catch {
        /* ignore */
      }
      continue;
    }

    // Parse #EXTINF metadata
    if (line.startsWith("#EXTINF:")) {
      rawExtInf = line;
      // Extract title: everything after the last comma
      const lastComma = line.lastIndexOf(",");
      if (lastComma !== -1) {
        currentTitle = line.slice(lastComma + 1).trim();
      }

      // Extract tvg attributes: tvg-name="...", tvg-logo="...", group-title="..."
      const tvgName = line.match(/tvg-name=["']([^"']+)["']/i);
      const tvgLogo = line.match(/tvg-logo=["']([^"']+)["']/i);
      const groupTitle = line.match(/group-title=["']([^"']+)["']/i);
      const tvgId = line.match(/tvg-id=["']([^"']+)["']/i);

      if (tvgName && (!currentTitle || currentTitle.toLowerCase() === "bilinmeyen")) {
        currentTitle = tvgName[1].trim();
      }
      if (groupTitle) {
        currentCategory = groupTitle[1].trim();
      }
      if (tvgLogo) {
        currentLogo = tvgLogo[1].trim();
      }
      if (tvgId) {
        currentEpgId = tvgId[1].trim();
      }

      // Quality clues inside title
      if (/1080p|fhd/i.test(currentTitle)) currentTier = "FHD";
      else if (/720p|hd/i.test(currentTitle)) currentTier = "HD";
      else if (/4k|uhd/i.test(currentTitle)) currentTier = "FHD";
      else if (/radio|radyo/i.test(currentTitle)) currentTier = "AUDIO";

      continue;
    }

    // Check if line is a stream URL (not a comment)
    if (!line.startsWith("#")) {
      let fullUrl = line;
      if (baseUrl && !/^https?:\/\//i.test(fullUrl)) {
        try {
          fullUrl = new URL(fullUrl, baseUrl).toString();
        } catch {
          continue;
        }
      }

      if (/^https?:\/\//i.test(fullUrl)) {
        // Fallback title if empty
        let title = currentTitle;
        if (!title || title.toLowerCase() === "bilinmeyen" || /^(stream|live|untitled)$/i.test(title)) {
          try {
            const u = new URL(fullUrl);
            const slug = u.pathname.split("/").filter(Boolean).pop() || "";
            const cleanSlug = slug.replace(/\.(m3u8|mp4|ts|m3u)$/i, "").replace(/[-_]/g, " ");
            title = cleanSlug.length > 2 ? cleanSlug.charAt(0).toUpperCase() + cleanSlug.slice(1) : u.hostname;
          } catch {
            title = "Canlı Yayın";
          }
        }

        items.push({
          title,
          streamUrl: fullUrl,
          category: currentCategory,
          logo: currentLogo,
          epgId: currentEpgId,
          qualityTier: currentTier,
          resolution: currentResolution,
          bitrateKbps: currentBitrate,
          customHeaders: { ...currentHeaders },
          rawExtInf,
        });
      }

      // Reset per-stream state
      currentTitle = "";
      currentCategory = "Diğer";
      currentLogo = null;
      currentEpgId = null;
      currentHeaders = {};
      currentResolution = null;
      currentBitrate = null;
      currentTier = "unknown";
      rawExtInf = "";
    }
  }

  return {
    isMasterPlaylist,
    items,
    totalChannels: items.length,
  };
}
