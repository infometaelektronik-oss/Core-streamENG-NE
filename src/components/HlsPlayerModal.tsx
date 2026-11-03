import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { X, Play, AlertCircle, Copy, Check, ExternalLink, ShieldCheck, RefreshCw, Volume2, Sparkles } from "lucide-react";
import type { StreamItem } from "../lib/api-client";

interface Props {
  stream: StreamItem | null;
  onClose: () => void;
}

export function HlsPlayerModal({ stream, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [useProxy, setUseProxy] = useState(true);
  const [levels, setLevels] = useState<Array<{ id: number; name: string }>>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [hlsInstance, setHlsInstance] = useState<Hls | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!stream || !videoRef.current) return;

    setError(null);
    setIsPlaying(false);
    setLevels([]);
    setCurrentLevel(-1);

    const video = videoRef.current;
    let hls: Hls | null = null;

    // Resolve target playback URL
    // Default to our dedicated server-side CORS bypass stream proxy / tunnel
    const targetUrl = useProxy
      ? (stream.id
          ? `/api/public/v1/stream/${stream.id}`
          : `/api/public/v1/cors-proxy?url=${encodeURIComponent(stream.stream_url)}`)
      : stream.stream_url;

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        xhrSetup: (xhr, url) => {
          // If accessing directly or via proxy, ensure credentials & headers
          xhr.withCredentials = false;
        },
      });

      hls.loadSource(targetUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        if (data.levels && data.levels.length > 1) {
          const lvls = data.levels.map((l, idx) => ({
            id: idx,
            name: l.height ? `${l.height}p` : `${Math.round(l.bitrate / 1000)}k`,
          }));
          setLevels(lvls);
        }

        video.play().then(() => setIsPlaying(true)).catch(() => {
          setIsPlaying(false);
        });
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        setCurrentLevel(data.level);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (!useProxy) {
                // If direct playback failed due to CORS/hotlink, auto-switch to proxy tunnel
                setError("CORS/Referer engeli tespit edildi. Yerel CORS tüneli otomatik olarak açılıyor...");
                setTimeout(() => {
                  setUseProxy(true);
                  setReloadKey((k) => k + 1);
                }, 1200);
              } else {
                setError("Ağ hatası: Kaynak sunucu akışı vermeyi durdurdu veya geçici olarak erişilemiyor.");
                hls?.startLoad();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setError("Medya formatı ayrıştırma hatası. Akış kurtarılmaya çalışılıyor...");
              hls?.recoverMediaError();
              break;
            default:
              setError(`Oynatma hatası: ${data.details || "Bilinmeyen hata"}`);
              hls?.destroy();
              break;
          }
        }
      });

      setHlsInstance(hls);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = targetUrl;
      video.addEventListener("loadedmetadata", () => {
        video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      });
      video.addEventListener("error", () => {
        if (!useProxy) {
          setUseProxy(true);
          setReloadKey((k) => k + 1);
        } else {
          setError("Yayın oynatılamıyor. Harici oynatıcıda deneyebilirsiniz.");
        }
      });
    } else {
      setError("Tarayıcınız HLS yayın formatını desteklemiyor.");
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
      setHlsInstance(null);
    };
  }, [stream, useProxy, reloadKey]);

  if (!stream) return null;

  const handleCopy = (urlToCopy = stream.stream_url) => {
    navigator.clipboard.writeText(urlToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLevelChange = (lvl: number) => {
    if (hlsInstance) {
      hlsInstance.currentLevel = lvl;
      setCurrentLevel(lvl);
    }
  };

  const fullProxiedUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/public/v1/stream/${stream.id}`
    : `/api/public/v1/stream/${stream.id}`;

  const isTr = stream.geo_country === "TR" || (stream.category && stream.category.includes("Ulusal"));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-4xl glass-panel rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#090D16]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-white/10 bg-slate-900/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <h3 className="font-bold text-sm truncate text-white flex items-center gap-1.5">
              {isTr && <span className="text-sm">🇹🇷</span>}
              <span className="truncate">{stream.title}</span>
            </h3>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono shrink-0">
              {stream.quality_tier || stream.resolution || "HLS"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* CORS Proxy Toggle */}
            <button
              onClick={() => {
                setUseProxy(!useProxy);
                setReloadKey((k) => k + 1);
              }}
              title={useProxy ? "CORS Tüneli Aktif: Yayın sunucu üzerinden filtrelenip oynatılıyor" : "Doğrudan CDN bağlantısı"}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all border ${
                useProxy
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-sm"
                  : "bg-slate-800 text-slate-400 border-white/5 hover:text-white"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{useProxy ? "CORS Tüneli: Aktif" : "CORS Tüneli: Kapalı"}</span>
            </button>

            {/* Quality Selector */}
            {levels.length > 0 && (
              <select
                className="bg-slate-800 text-slate-300 border border-white/10 rounded-lg text-xs px-2 py-1 outline-none font-mono"
                value={currentLevel}
                onChange={(e) => handleLevelChange(Number(e.target.value))}
              >
                <option value={-1}>Otomatik</option>
                {levels.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    {lvl.name}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Yeniden Yükle"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Player Container */}
        <div className="relative aspect-video bg-black flex items-center justify-center">
          <video
            ref={videoRef}
            controls
            playsInline
            autoPlay
            className="w-full h-full object-contain"
          />

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-6 text-center z-10">
              <AlertCircle className="w-12 h-12 text-amber-400 mb-3" />
              <p className="text-sm font-semibold text-slate-100 max-w-md">{error}</p>
              <p className="text-xs text-slate-400 mt-2 max-w-md leading-relaxed">
                Türk ulusal kanalları (Show TV, Star TV, ATV, Kanal D, TV8 vb.) ve birçok IPTV yayını doğrudan tarayıcı bağlantılarına CORS ve Referer koruması uygular.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
                <button
                  onClick={() => {
                    setUseProxy(true);
                    setError(null);
                    setReloadKey((k) => k + 1);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md shadow-emerald-500/20"
                >
                  <ShieldCheck className="w-4 h-4" /> CORS Tüneli ile Aç
                </button>
                <button
                  onClick={() => handleCopy(fullProxiedUrl)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Kopyalandı" : "Tünel M3U Linki"}
                </button>
                <a
                  href={stream.stream_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Doğrudan CDN Aç
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer info & Controls */}
        <div className="px-5 py-3 bg-slate-900/90 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2.5 truncate max-w-xl font-mono text-[11px]">
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold shrink-0">
              {useProxy ? "CORS Tüneli" : "Doğrudan"}
            </span>
            <span className="truncate text-slate-300">
              {useProxy ? fullProxiedUrl : stream.stream_url}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy(useProxy ? fullProxiedUrl : stream.stream_url)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Kopyalandı" : "Oynatma Linkini Kopyala"}</span>
            </button>
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
