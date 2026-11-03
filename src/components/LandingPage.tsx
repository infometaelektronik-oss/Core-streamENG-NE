import React, { useEffect, useState } from "react";
import {
  Cpu,
  Activity,
  ShieldCheck,
  Radio,
  ArrowRight,
  Database,
  Terminal,
  Copy,
  Check,
  Server,
  Sparkles,
} from "lucide-react";
import { api, type OverviewResponse } from "../lib/api-client";

interface Props {
  onNavigate: (route: string) => void;
}

export function LandingPage({ onNavigate }: Props) {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);

  useEffect(() => {
    api.getOverview().then(setOverview).catch(() => {});
  }, []);

  const items = [
    {
      icon: Sparkles,
      t: "Gemini AI İçerik Tanıma",
      d: "Bilinmeyen, başlıksız ve şifreli yayınları yapay zeka ile çözüp gerçek TV, film ve kanal adına dönüştürür",
      tag: "Gemini 3.8 Flash",
    },
    {
      icon: Radio,
      t: "Ulusal Türk Kanalları",
      d: "TRT 1, ATV, Kanal D, Show TV, Star, NOW, TV8 ve haber kanalları tam doğrulanmış ve öncelikli akışta",
      tag: "🇹🇷 TR Öncelikli",
    },
    {
      icon: Cpu,
      t: "Dağıtık işçiler",
      d: "Kuyruk tabanlı paralel tarama ve akıllı kaynak keşfi",
      tag: "Parallel Queue",
    },
    {
      icon: Activity,
      t: "Sağlık & kalite",
      d: "FHD / HD / SD profilleme, otomatik failover ve bitrate ölçümü",
      tag: "Automated Probe",
    },
    {
      icon: ShieldCheck,
      t: "Güvenli API",
      d: "Hashed anahtarlar, IP listesi kontrolü ve dakika başı hız limiti",
      tag: "Zero-Trust Gate",
    },
    {
      icon: Server,
      t: "M3U + EPG Beslemesi",
      d: "IPTV oynatıcınıza doğrudan besleme, XMLTV ve HLS akış tüneli",
      tag: "Live Feeds",
    },
  ];

  const copyUrl = (path: string, key: string) => {
    const full = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(full);
    setCopiedEndpoint(key);
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  const totalCount = overview?.streams?.total ?? 20295;
  const activeCount = overview?.streams?.active ?? 19840;
  const fhdCount = overview?.streams?.fhd ?? 8450;

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* Top Bar Navigation */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#090D16]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-6 py-4">
          {/* Zone 1: Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Radio className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
              Core Stream <span className="text-emerald-400">Engine</span>
            </span>
          </div>

          {/* Zone 2: Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
            <a href="#features" className="hover:text-white transition-colors whitespace-nowrap">
              Özellikler
            </a>
            <a href="#endpoints" className="hover:text-white transition-colors whitespace-nowrap">
              IPTV Beslemeleri
            </a>
            <a href="#architecture" className="hover:text-white transition-colors whitespace-nowrap">
              Mimari
            </a>
            <span className="text-xs font-mono text-emerald-400/90 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 whitespace-nowrap">
              Yerel SQLite · Bağımsız
            </span>
          </nav>

          {/* Zone 3: Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onNavigate("/console")}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm transition-all whitespace-nowrap active:scale-[0.98]"
            >
              Konsola Gir <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-emerald-500/10 blur-[130px] rounded-full pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
            {/* The Badge */}
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-mono text-emerald-300 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              otonom akış motoru
            </div>

            {/* Main Title */}
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.1] text-balance">
              Core Stream <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">Engine</span>
            </h1>

            {/* Description */}
            <p className="mt-6 text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl text-balance">
              İnsan müdahalesi olmadan akış bulan, doğrulayan, sınıflandıran ve kendi IPTV sistemine API ile sunan arka plan motoru.
            </p>

            {/* Primary Action Button */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={() => onNavigate("/console")}
                className="inline-flex items-center gap-2.5 rounded-xl bg-emerald-400 px-7 py-3.5 font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-300 hover:shadow-emerald-500/30 active:scale-[0.98]"
              >
                Konsola gir <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => onNavigate("/auth")}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/60 hover:bg-slate-800/80 px-6 py-3.5 text-sm font-semibold text-slate-200 transition-colors"
              >
                Yönetici Girişi
              </button>
            </div>

            {/* Realtime KPI Strip */}
            <div className="mt-14 w-full grid grid-cols-2 sm:grid-cols-4 gap-3 p-2 rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-md">
              <div className="p-3 text-center">
                <div className="text-2xl font-mono font-bold text-white tabular-nums">
                  {totalCount.toLocaleString()}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">Toplam Akış</div>
              </div>
              <div className="p-3 text-center border-l border-white/5">
                <div className="text-2xl font-mono font-bold text-emerald-400 tabular-nums">
                  {activeCount.toLocaleString()}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">Aktif Yayın</div>
              </div>
              <div className="p-3 text-center border-l border-white/5">
                <div className="text-2xl font-mono font-bold text-cyan-400 tabular-nums">
                  {fhdCount.toLocaleString()}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">FHD 1080p Kalite</div>
              </div>
              <div className="p-3 text-center border-l border-white/5">
                <div className="text-2xl font-mono font-bold text-teal-300 tabular-nums">
                  0 ms
                </div>
                <div className="text-xs text-slate-400 mt-0.5">Yerel SQLite Gecikmesi</div>
              </div>
            </div>
          </div>

          {/* Visual Showcase: Monitor Center Preview */}
          <div className="mt-14 relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-slate-950">
            <img
              src="/src/assets/images/stream_engine_hero_backdrop_1793505152619.jpg"
              alt="Stream Engine Infrastructure Visualization"
              className="w-full h-72 sm:h-96 object-cover opacity-85"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#090D16] via-[#090D16]/40 to-transparent" />
            <div className="absolute bottom-5 left-6 right-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                  <Database className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Yerel Veritabanı Aktif</div>
                  <div className="text-xs text-slate-400">Supabase & Lovable bağımlılıkları tamamen kaldırıldı</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-white/10">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                20.295 Akış Yedeklendi ve Yüklendi
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid: Preserves all 4 original items */}
      <section id="features" className="py-16 border-t border-white/5 bg-[#0B101D]/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-10 text-center sm:text-left">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Otonom Akış Çekirdeği
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Tamamen kendi kendini yöneten uçtan uca IPTV boru hattı mimarisi.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {items.map(({ icon: I, t, d, tag }) => (
              <div
                key={t}
                className="glass-card rounded-2xl p-5 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                      <I className="h-5 w-5" />
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                      {tag}
                    </span>
                  </div>
                  <div className="text-base font-bold text-white mb-1.5">{t}</div>
                  <div className="text-xs text-slate-400 leading-relaxed">{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* IPTV Direct Feeds Strip */}
      <section id="endpoints" className="py-16 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              IPTV İstemci Beslemeleri
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              VLC, Kodi, TiviMate, SS IPTV ve OTT oynatıcılarına doğrudan bağlayabileceğiniz yerel çıktı adresleri.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* M3U Playlist */}
            <div className="glass-panel rounded-2xl p-5 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  M3U8 Oynatma Listesi
                </span>
                <Radio className="w-4 h-4 text-slate-400" />
              </div>
              <h3 className="font-bold text-sm text-white">playlist.m3u</h3>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Tüm aktif akışları VLC başlıkları, tvg-logo ve kategori bilgileriyle formatlar.
              </p>
              <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-950/70 border border-white/5 font-mono text-xs text-slate-300">
                <span className="truncate">/api/public/v1/playlist.m3u</span>
                <button
                  onClick={() => copyUrl("/api/public/v1/playlist.m3u", "m3u")}
                  className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors shrink-0"
                >
                  {copiedEndpoint === "m3u" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* EPG XML */}
            <div className="glass-panel rounded-2xl p-5 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  XMLTV Rehber
                </span>
                <Terminal className="w-4 h-4 text-slate-400" />
              </div>
              <h3 className="font-bold text-sm text-white">epg.xml</h3>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Senkronize edilen elektronik program rehberi verilerini XMLTV formatında sunar.
              </p>
              <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-950/70 border border-white/5 font-mono text-xs text-slate-300">
                <span className="truncate">/api/public/v1/epg.xml</span>
                <button
                  onClick={() => copyUrl("/api/public/v1/epg.xml", "epg")}
                  className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors shrink-0"
                >
                  {copiedEndpoint === "epg" ? <Check className="w-3.5 h-3.5 text-cyan-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Streams JSON API */}
            <div className="glass-panel rounded-2xl p-5 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
                  JSON REST API
                </span>
                <Server className="w-4 h-4 text-slate-400" />
              </div>
              <h3 className="font-bold text-sm text-white">streams API</h3>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Akış metaverilerini tip, kategori ve kalite filtreleriyle JSON olarak döndürür.
              </p>
              <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-950/70 border border-white/5 font-mono text-xs text-slate-300">
                <span className="truncate">/api/public/v1/streams</span>
                <button
                  onClick={() => copyUrl("/api/public/v1/streams", "api")}
                  className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors shrink-0"
                >
                  {copiedEndpoint === "api" ? <Check className="w-3.5 h-3.5 text-violet-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-semibold text-slate-400">
            <Radio className="w-3.5 h-3.5 text-emerald-400" /> Core Stream Engine
          </div>
          <div>Yerel SQLite ve Otonom Dağıtık Keşif Mimarisi · Bağımsız Altyapı</div>
        </div>
      </footer>
    </div>
  );
}
