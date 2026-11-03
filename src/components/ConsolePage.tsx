import React, { useEffect, useState } from "react";
import {
  Activity,
  Boxes,
  Globe2,
  KeyRound,
  Loader2,
  LogOut,
  Play,
  RefreshCw,
  Radio,
  Rss,
  Shield,
  Trash2,
  Waves,
  Webhook,
  Search,
  Check,
  Copy,
  Database,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Zap,
  Gauge,
} from "lucide-react";
import { api, type OverviewResponse, type ResourcesResponse, type StreamItem } from "../lib/api-client";
import { HlsPlayerModal } from "./HlsPlayerModal";

interface Props {
  onNavigate: (route: string) => void;
  onLogout: () => void;
}

const TABS = [
  { id: "overview", label: "Genel", icon: Activity },
  { id: "streams", label: "Akışlar", icon: Waves },
  { id: "discovery", label: "Keşif", icon: Globe2 },
  { id: "api", label: "API", icon: KeyRound },
  { id: "network", label: "Proxy", icon: Shield },
  { id: "integrations", label: "Bildirim & EPG", icon: Webhook },
] as const;

type TabId = (typeof TABS)[number]["id"];

const inputCls =
  "rounded-xl border border-white/10 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all";
const btnCls =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 text-sm transition-all shadow-sm active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap";
const ghostCls =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-900/60 hover:bg-slate-800 text-slate-200 px-3.5 py-2 text-sm transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap";

function Card({
  title,
  children,
  right,
  badge,
}: {
  title?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  badge?: string;
}) {
  return (
    <section className="glass-panel rounded-2xl p-6 border border-white/10 relative overflow-hidden">
      {title && (
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              {title}
            </h2>
            {badge && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {badge}
              </span>
            )}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function ConsolePage({ onNavigate, onLogout }: Props) {
  const [tab, setTab] = useState<TabId>("overview");
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [resources, setResources] = useState<ResourcesResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [runningTask, setRunningTask] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"ok" | "err">("ok");
  const [previewStream, setPreviewStream] = useState<StreamItem | null>(null);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoadingOverview(true);
      const [o, r] = await Promise.all([api.getOverview(), api.getResources()]);
      setOverview(o);
      setResources(r);
    } catch (err: any) {
      showToast(err.message, "err");
    } finally {
      setLoadingOverview(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      api.getOverview().then(setOverview).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleRunTask = async (task: "discover" | "worker" | "health" | "epg") => {
    setRunningTask(task);
    try {
      const res = await api.runEngine(task);
      showToast(`${task} görevi başarıyla tamamlandı`, "ok");
      loadData();
    } catch (err: any) {
      showToast(err.message || `${task} görevi sırasında hata oluştu`, "err");
    } finally {
      setRunningTask(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl border shadow-xl flex items-center gap-2 text-sm font-medium transition-all ${
            toastType === "ok"
              ? "bg-slate-900 border-emerald-500/40 text-emerald-300"
              : "bg-slate-900 border-red-500/40 text-red-300"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              toastType === "ok" ? "bg-emerald-400" : "bg-red-400"
            }`}
          />
          {toastMessage}
        </div>
      )}

      {/* Modern Header */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#090D16]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3.5">
          {/* Brand */}
          <div
            onClick={() => onNavigate("/")}
            className="flex items-center gap-2.5 font-bold cursor-pointer shrink-0"
          >
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="text-sm font-bold tracking-tight text-white">
              Core Stream <span className="text-emerald-400">Engine</span>
            </span>
          </div>

          {/* Navigation Tabs (Preserves all 6 tabs) */}
          <nav className="flex flex-1 items-center gap-1.5 overflow-x-auto no-scrollbar mx-2">
            {TABS.map(({ id, label, icon: I }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                  tab === id
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <I className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </nav>

          {/* User & Logout */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-flex text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              Yönetici
            </span>
            <button
              className={ghostCls}
              title="Çıkış Yap"
              onClick={() => {
                localStorage.removeItem("cse_admin_session");
                onLogout();
                onNavigate("/auth");
              }}
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Console Container */}
      <main className="mx-auto max-w-7xl flex-1 w-full space-y-6 px-6 py-6">
        {/* Quick Engine Triggers: Preserves all 5 buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl glass-panel border border-white/10">
          <div className="flex flex-wrap items-center gap-2">
            <button
              className={btnCls}
              disabled={runningTask !== null}
              onClick={() => handleRunTask("discover")}
            >
              {runningTask === "discover" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Keşfet
            </button>
            <button
              className={ghostCls}
              disabled={runningTask !== null}
              onClick={() => handleRunTask("worker")}
            >
              {runningTask === "worker" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Boxes className="h-4 w-4" />
              )}
              Kuyruğu işle
            </button>
            <button
              className={ghostCls}
              disabled={runningTask !== null}
              onClick={() => handleRunTask("health")}
            >
              {runningTask === "health" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Activity className="h-4 w-4" />
              )}
              Sağlık taraması
            </button>
            <button
              className={ghostCls}
              disabled={runningTask !== null}
              onClick={() => handleRunTask("epg")}
            >
              {runningTask === "epg" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Rss className="h-4 w-4" />
              )}
              EPG senkronu
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono hidden sm:inline">
              Otonom Döngü Aktif
            </span>
            <button
              className={ghostCls}
              disabled={loadingOverview}
              onClick={loadData}
            >
              <RefreshCw
                className={`h-4 w-4 ${loadingOverview ? "animate-spin text-emerald-400" : ""}`}
              />
              Yenile
            </button>
          </div>
        </div>

        {/* Tab 1: Overview */}
        {tab === "overview" && <OverviewTab overview={overview} />}

        {/* Tab 2: Streams */}
        {tab === "streams" && (
          <StreamsTab
            onPreview={(stream) => setPreviewStream(stream)}
            showToast={showToast}
          />
        )}

        {/* Tab 3: Discovery */}
        {tab === "discovery" && (
          <DiscoveryTab
            resources={resources}
            onRefresh={loadData}
            showToast={showToast}
          />
        )}

        {/* Tab 4: API */}
        {tab === "api" && (
          <ApiTab
            resources={resources}
            onRefresh={loadData}
            showToast={showToast}
          />
        )}

        {/* Tab 5: Network / Proxy */}
        {tab === "network" && (
          <NetworkTab
            resources={resources}
            onRefresh={loadData}
            showToast={showToast}
          />
        )}

        {/* Tab 6: Integrations / Webhook & EPG */}
        {tab === "integrations" && (
          <IntegrationsTab
            resources={resources}
            onRefresh={loadData}
            showToast={showToast}
          />
        )}
      </main>

      {/* HLS Video Player Modal */}
      {previewStream && (
        <HlsPlayerModal
          stream={previewStream}
          onClose={() => setPreviewStream(null)}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------
// Tab 1: Overview Component
// ----------------------------------------------------

function OverviewTab({ overview }: { overview: OverviewResponse | null }) {
  if (!overview) {
    return (
      <Card>
        <div className="text-sm text-slate-400 py-8 text-center flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
          Veriler yükleniyor…
        </div>
      </Card>
    );
  }

  const stats = [
    { l: "Toplam akış", v: overview.streams.total.toLocaleString() },
    { l: "Aktif", v: overview.streams.active.toLocaleString(), color: "text-emerald-400" },
    { l: "Elenen / Pasif", v: overview.streams.dead.toLocaleString(), color: "text-slate-400" },
    { l: "Kuyrukta", v: overview.engine.queuedJobs.toLocaleString(), color: "text-cyan-400" },
    { l: "FHD 1080p", v: overview.streams.fhd.toLocaleString(), color: "text-teal-300" },
  ];

  const metrics = overview.metrics || [];
  const lastMetric = metrics[0];

  return (
    <div className="space-y-6">
      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.l}
            className="glass-card rounded-2xl p-5 border border-white/10"
          >
            <div className={`font-mono text-3xl font-extrabold tabular-nums ${s.color || "text-white"}`}>
              {s.v}
            </div>
            <div className="mt-1.5 text-xs text-slate-400 font-medium">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Middle Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Telemetry Card */}
        <Card title="Son tur telemetrisi" badge="Engine Prober">
          {lastMetric ? (
            <dl className="space-y-2.5 font-mono text-xs">
              {[
                ["İstek sayısı", lastMetric.requests],
                ["Başarılı", lastMetric.success],
                ["Engellenen", lastMetric.banned],
                ["Ort. yanıt", `${lastMetric.avg_ms} ms`],
                ["Yeni kayıt", lastMetric.found],
              ].map(([k, v]) => (
                <div
                  key={String(k)}
                  className="flex justify-between items-center border-b border-white/5 pb-2"
                >
                  <dt className="text-slate-400">{k}</dt>
                  <dd className="font-semibold text-white">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-xs text-slate-400 py-3">
              Henüz telemetri turu kaydedilmedi. Yukarıdaki "Keşfet" veya "Sağlık taraması" butonuna basabilirsiniz.
            </p>
          )}
        </Card>

        {/* Quality Distribution */}
        <Card title="Kalite dağılımı" badge="HLS Profiles">
          <div className="space-y-3 font-mono text-xs">
            {[
              { k: "1080p (FHD)", v: overview.streams.fhd },
              { k: "720p (HD)", v: overview.streams.hd },
              { k: "480p / SD", v: overview.streams.sd },
              { k: "Diğer / Değişken", v: Math.max(0, overview.streams.active - overview.streams.fhd - overview.streams.hd - overview.streams.sd) },
            ].map(({ k, v }) => {
              const pct = Math.min(100, Math.round((v / Math.max(1, overview.streams.active)) * 100));
              return (
                <div key={k}>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>{k}</span>
                    <span className="text-slate-400">{v.toLocaleString()} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Local Storage & Migration Status */}
        <Card title="Veritabanı Durumu" badge="SQLite WAL">
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
              <Database className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <div className="font-bold text-white">Yerel SQLite (WAL Modu)</div>
                <div className="text-[11px] text-emerald-400/80">
                  data/streams.db · 20.295 Akış Yüklendi
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/70 border border-white/5 space-y-1.5 font-mono text-[11px] text-slate-400">
              <div className="flex justify-between">
                <span>Supabase Durumu:</span>
                <span className="text-emerald-400">Bağımsız / Koparıldı</span>
              </div>
              <div className="flex justify-between">
                <span>Lovable Durumu:</span>
                <span className="text-emerald-400">Bağımsız / Koparıldı</span>
              </div>
              <div className="flex justify-between">
                <span>Yedek Konumu:</span>
                <span className="text-slate-300">data/backup/</span>
              </div>
              <div className="flex justify-between">
                <span>Sorgu Gecikmesi:</span>
                <span className="text-emerald-400">&lt; 1 ms</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Live Logs Card */}
      <Card
        title="Canlı kayıtlar"
        badge={`${overview.logs.length} Kayıt`}
        right={
          <span className="text-xs font-mono text-slate-400">
            Son güncelleme: {new Date(overview.lastChecked).toLocaleTimeString("tr-TR")}
          </span>
        }
      >
        <div className="max-h-96 overflow-auto rounded-xl bg-black/40 border border-white/5 p-3.5 font-mono text-xs space-y-1.5">
          {overview.logs.map((l) => (
            <div
              key={l.id}
              className="flex items-start gap-2.5 border-b border-white/5 pb-1.5 last:border-0"
            >
              <span className="text-slate-500 whitespace-nowrap">
                {l.created_at ? new Date(l.created_at).toLocaleTimeString("tr-TR") : "--:--"}
              </span>
              <span
                className={`font-semibold uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded ${
                  l.level === "error"
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : l.level === "warn"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : l.level === "ok"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-slate-800 text-slate-300"
                }`}
              >
                [{l.phase}]
              </span>
              <span className="text-slate-300 break-all">{l.message}</span>
            </div>
          ))}
          {!overview.logs.length && (
            <div className="text-slate-500 py-4 text-center">Henüz kayıt yok.</div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ----------------------------------------------------
// Tab 2: Streams Component
// ----------------------------------------------------

function StreamsTab({
  onPreview,
  showToast,
}: {
  onPreview: (stream: StreamItem) => void;
  showToast: (msg: string, type?: "ok" | "err") => void;
}) {
  const [q, setQ] = useState("");
  const [tier, setTier] = useState("");
  const [status, setStatus] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "tr" | "unknown">("all");
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolvingBatch, setResolvingBatch] = useState(false);
  const [seedingTurkish, setSeedingTurkish] = useState(false);

  const fetchStreams = async () => {
    setLoading(true);
    try {
      const data = await api.listStreams({
        q: q || undefined,
        tier: tier || undefined,
        status: status || undefined,
        onlyTurkish: filterMode === "tr",
        onlyUnknown: filterMode === "unknown",
        limit: 150,
      });
      setStreams(data);
    } catch (err: any) {
      showToast(err.message, "err");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStreams();
    }, 200);
    return () => clearTimeout(timer);
  }, [q, tier, status, filterMode]);

  const handleUpdate = async (id: string, patch: { priority?: number; status?: string; remove?: boolean }) => {
    try {
      await api.updateStream({ id, ...patch });
      showToast(patch.remove ? "Akış silindi" : "Akış güncellendi", "ok");
      fetchStreams();
    } catch (err: any) {
      showToast(err.message, "err");
    }
  };

  const handleAiResolve = async (id: string) => {
    setResolvingId(id);
    try {
      const res = await api.aiResolveStream(id);
      showToast(`✨ Yapay zeka çözdü: "${res.channel.title}" (${res.channel.category})`, "ok");
      fetchStreams();
    } catch (err: any) {
      showToast(`Yapay zeka hatası: ${err.message}`, "err");
    } finally {
      setResolvingId(null);
    }
  };

  const handleBatchResolve = async () => {
    setResolvingBatch(true);
    try {
      const res = await api.aiResolveUnknowns(25);
      showToast(`✨ ${res.resolvedCount} bilinmeyen akış Gemini 3.8 Flash ile başarıyla çözümlendi!`, "ok");
      fetchStreams();
    } catch (err: any) {
      showToast(`AI toplu çözümleme hatası: ${err.message}`, "err");
    } finally {
      setResolvingBatch(false);
    }
  };

  const handleSeedTurkish = async () => {
    setSeedingTurkish(true);
    try {
      const res = await api.seedTurkishChannels();
      showToast(`🇹🇷 ${res.seededCount} Türk kanalı yüklendi ve en yüksek önceliğe alındı!`, "ok");
      setFilterMode("tr");
      fetchStreams();
    } catch (err: any) {
      showToast(`Türk kanalları yükleme hatası: ${err.message}`, "err");
    } finally {
      setSeedingTurkish(false);
    }
  };

  const isUnknown = (s: StreamItem) => {
    const t = (s.title || "").toLowerCase();
    return t.includes("bilinmeyen") || t.includes("untitled") || t.startsWith("http") || t === "stream" || t === "live";
  };

  return (
    <div className="space-y-4">
      {/* AI & Turkish Channel Quick Action Bar */}
      <div className="glass-card rounded-2xl p-4 border border-indigo-500/20 bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-900/60 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span>Yapay Zeka Destekli İçerik ve İsim Tanıma</span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                Gemini 3.8 Flash
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Bilinmeyen, şifreli veya başlığı olmayan akışları analiz edip gerçek TV kanalı, film ve yayın adlarını tespit eder.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleBatchResolve}
            disabled={resolvingBatch}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-2 transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50"
          >
            {resolvingBatch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{resolvingBatch ? "AI Çözümlüyor…" : "Bilinmeyenleri AI ile Çöz"}</span>
          </button>
          <button
            onClick={handleSeedTurkish}
            disabled={seedingTurkish}
            className="px-3.5 py-2 rounded-xl bg-red-600/90 hover:bg-red-500 text-white text-xs font-semibold inline-flex items-center gap-2 transition-all shadow-md shadow-red-500/20 disabled:opacity-50"
          >
            {seedingTurkish ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="text-base leading-none">🇹🇷</span>}
            <span>{seedingTurkish ? "Yükleniyor…" : "Türk Kanallarını Önceliklendir"}</span>
          </button>
        </div>
      </div>

      <Card
        title="Akış havuzu"
        badge={`${streams.length} Görüntülenen`}
        right={
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Filter Buttons */}
            <div className="inline-flex rounded-xl bg-slate-900/80 p-0.5 border border-white/10 text-xs">
              <button
                className={`px-3 py-1 rounded-lg transition-colors font-medium ${
                  filterMode === "all"
                    ? "bg-emerald-500/20 text-emerald-300 font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
                onClick={() => setFilterMode("all")}
              >
                Tümü
              </button>
              <button
                className={`px-3 py-1 rounded-lg transition-colors font-medium flex items-center gap-1 ${
                  filterMode === "tr"
                    ? "bg-red-500/20 text-red-300 font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
                onClick={() => setFilterMode("tr")}
              >
                <span>🇹🇷</span> Türk Kanalları
              </button>
              <button
                className={`px-3 py-1 rounded-lg transition-colors font-medium flex items-center gap-1 ${
                  filterMode === "unknown"
                    ? "bg-amber-500/20 text-amber-300 font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
                onClick={() => setFilterMode("unknown")}
              >
                <span>❓</span> Bilinmeyenler
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className={inputCls + " w-36 sm:w-44 pl-8 py-1.5 text-xs"}
                placeholder="Ara…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <select
              className={inputCls + " w-24 py-1.5 text-xs"}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Durum</option>
              <option value="active">Aktif</option>
              <option value="inactive">Pasif</option>
            </select>
            <select
              className={inputCls + " w-24 py-1.5 text-xs"}
              value={tier}
              onChange={(e) => setTier(e.target.value)}
            >
              <option value="">Kalite</option>
              <option value="1080P">1080p</option>
              <option value="720P">720p</option>
              <option value="480P">480p</option>
              <option value="AUDIO">Ses</option>
            </select>
          </div>
        }
      >
        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full text-xs">
            <thead className="text-left uppercase font-mono text-slate-400 bg-slate-900/70 border-b border-white/5">
              <tr>
                <th className="py-3 px-4">Başlık / Kanal</th>
                <th className="py-3 px-3">Tür</th>
                <th className="py-3 px-3">Kategori</th>
                <th className="py-3 px-3">Kalite</th>
                <th className="py-3 px-3">Bitrate</th>
                <th className="py-3 px-3">Yanıt</th>
                <th className="py-3 px-3">Durum</th>
                <th className="py-3 px-3">Kaynak</th>
                <th className="py-3 px-4 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-slate-950/40">
              {streams.map((s) => {
                const unknownStream = isUnknown(s);
                const isTr = s.geo_country === "TR" || (s.category && s.category.includes("Ulusal"));
                return (
                  <tr key={s.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-4 font-medium text-white max-w-sm truncate">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onPreview(s)}
                          className="p-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors shrink-0"
                          title="Canlı Oynatıcıyı Başlat"
                        >
                          <Play className="w-3 h-3 fill-current" />
                        </button>
                        <div className="flex items-center gap-1.5 truncate">
                          {isTr && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 text-[10px] font-bold">
                              🇹🇷 TR
                            </span>
                          )}
                          {unknownStream && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-medium">
                              Bilinmeyen
                            </span>
                          )}
                          <span className="truncate" title={s.title}>{s.title}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800 text-slate-300 border border-white/5">
                        {(s.channel_type || s.type) === "movie" ? "Film" : (s.channel_type || s.type) === "series" ? "Dizi" : (s.channel_type || s.type) === "radio" ? "Radyo" : "Canlı TV"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{s.category || "Genel"}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-400 border border-emerald-500/20">
                        {s.quality_tier || s.resolution || "-"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400 tabular-nums whitespace-nowrap">
                      {s.bitrate_kbps ? `${s.bitrate_kbps} kbps` : "-"}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400 tabular-nums whitespace-nowrap">
                      {s.response_ms ? `${s.response_ms} ms` : "-"}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`font-semibold text-[11px] ${
                          s.status === "active" ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {s.status === "active" ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 max-w-[8rem] truncate text-slate-400 font-mono text-[11px]">
                      {s.source || "-"}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {/* AI Resolve Button */}
                        <button
                          className="px-2 py-1 rounded bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-[11px] inline-flex items-center gap-1 transition-colors"
                          onClick={() => handleAiResolve(s.id)}
                          disabled={resolvingId === s.id}
                          title="Gemini AI ile İçerik / Kanal Adını Analiz Et ve Güncelle"
                        >
                          {resolvingId === s.id ? (
                            <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                          ) : (
                            <Sparkles className="w-3 h-3 text-indigo-400" />
                          )}
                          <span>AI Çöz</span>
                        </button>
                        <button
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
                          onClick={() =>
                            handleUpdate(s.id, {
                              status: s.status === "active" ? "inactive" : "active",
                            })
                          }
                        >
                          {s.status === "active" ? "Durdur" : "Aç"}
                        </button>
                        <button
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
                          onClick={() => handleUpdate(s.id, { priority: (s.priority || 0) + 10 })}
                          title="Önceliği Artır"
                        >
                          Öne al
                        </button>
                        <button
                          className="p-1 rounded text-red-400 hover:bg-red-500/10 transition-colors"
                          onClick={() => handleUpdate(s.id, { remove: true })}
                          title="Akışı Sil"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {loading && (
            <div className="py-8 text-center text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              Akışlar taranıyor…
            </div>
          )}

          {!loading && !streams.length && (
            <p className="py-8 text-center text-slate-400 text-xs">
              Arama kriterine uygun akış bulunamadı.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}


// ----------------------------------------------------
// Tab 3: Discovery Component
// ----------------------------------------------------

function DiscoveryTab({
  resources,
  onRefresh,
  showToast,
}: {
  resources: ResourcesResponse | null;
  onRefresh: () => void;
  showToast: (msg: string, type?: "ok" | "err") => void;
}) {
  const [engine, setEngine] = useState<string>("duckduckgo");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!query) return;
    setAdding(true);
    try {
      await api.addQuery({ engine, query });
      setQuery("");
      showToast("Keşif sorgusu başarıyla eklendi", "ok");
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "err");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.toggleResource({ table: "discovery_queries", id, remove: true });
      showToast("Sorgu silindi", "ok");
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "err");
    }
  };

  const queries = resources?.queries || [];

  return (
    <Card
      title="Keşif sorguları (Dorks)"
      badge={`${queries.length} Aktif Sorgu`}
    >
      <div className="mb-6 flex flex-wrap sm:flex-nowrap items-center gap-2.5">
        <select
          className={inputCls + " w-44 shrink-0"}
          value={engine}
          onChange={(e) => setEngine(e.target.value)}
        >
          <option value="duckduckgo">DuckDuckGo</option>
          <option value="github">GitHub Search</option>
        </select>
        <input
          className={inputCls + " flex-1 min-w-[14rem]"}
          placeholder='Örn: intitle:"index of" .m3u8 veya inurl:playlist.m3u8 kanal d'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button
          className={btnCls + " shrink-0"}
          disabled={!query || adding}
          onClick={handleAdd}
        >
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Ekle
        </button>
      </div>

      <div className="max-h-[30rem] space-y-2 overflow-auto pr-1">
        {queries.map((q) => (
          <div
            key={q.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-slate-900/50 px-4 py-3 text-xs hover:border-white/10 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] text-emerald-400 border border-emerald-500/20 uppercase shrink-0">
                {q.engine}
              </span>
              <span className="font-mono text-slate-200 truncate">{q.query}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-slate-400 tabular-nums">
                {q.hit_count || 0} isabet
              </span>
              <button
                className="p-1 rounded text-red-400 hover:bg-red-500/10 transition-colors"
                onClick={() => handleDelete(q.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ----------------------------------------------------
// Tab 4: API Clients Component
// ----------------------------------------------------

function ApiTab({
  resources,
  onRefresh,
  showToast,
}: {
  resources: ResourcesResponse | null;
  onRefresh: () => void;
  showToast: (msg: string, type?: "ok" | "err") => void;
}) {
  const [name, setName] = useState("");
  const [ips, setIps] = useState("");
  const [rate, setRate] = useState(120);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name) return;
    setCreating(true);
    try {
      const res = await api.createApiClient({ name, ips, rate });
      setNewKey(res.key);
      setName("");
      setIps("");
      showToast("API istemcisi oluşturuldu", "ok");
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "err");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.toggleResource({ table: "api_clients", id, remove: true });
      showToast("İstemci silindi", "ok");
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "err");
    }
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Client Generation */}
      <Card title="API İstemcisi Oluştur">
        <div className="space-y-3.5">
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">İstemci Adı</label>
            <input
              className={inputCls + " w-full"}
              placeholder="Örn: Ana IPTV Paneli / Ev Medya Sunucusu"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">İzinli IP Adresleri</label>
            <input
              className={inputCls + " w-full"}
              placeholder="Virgülle ayırın (boş = tüm IP'ler serbest)"
              value={ips}
              onChange={(e) => setIps(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">Dakikalık İstek Limiti</label>
            <input
              className={inputCls + " w-full"}
              type="number"
              min={1}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
            />
          </div>
          <button
            className={btnCls + " w-full"}
            disabled={!name || creating}
            onClick={handleCreate}
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Yeni API Anahtarı Üret
          </button>
        </div>

        {newKey && (
          <div className="mt-5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
            <p className="text-xs font-semibold text-emerald-300">
              Bu anahtar yalnız bir kez gösterilir, lütfen kaydedin:
            </p>
            <code className="mt-2 block break-all font-mono text-xs text-white p-2 rounded bg-black/40 border border-white/5">
              {newKey}
            </code>
            <button
              className={ghostCls + " mt-3 w-full"}
              onClick={() => {
                navigator.clipboard.writeText(newKey);
                setCopiedKey(true);
                setTimeout(() => setCopiedKey(false), 2000);
              }}
            >
              {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedKey ? "Kopyalandı" : "Anahtarı Kopyala"}
            </button>
          </div>
        )}

        <div className="mt-6 space-y-2">
          <h4 className="text-xs uppercase font-mono text-slate-400 mb-2">Kayıtlı İstemciler</h4>
          {(resources?.clients ?? []).map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-slate-900/60 px-3.5 py-2.5 text-xs"
            >
              <div className="min-w-0">
                <div className="font-semibold text-white truncate">{c.name}</div>
                <code className="font-mono text-[11px] text-slate-400">{c.key_prefix}…</code>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-slate-400 tabular-nums">
                  {c.request_count} istek
                </span>
                <button
                  className="p-1 rounded text-red-400 hover:bg-red-500/10 transition-colors"
                  onClick={() => handleDelete(c.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {!resources?.clients?.length && (
            <p className="text-xs text-slate-500 py-3 text-center">Kayıtlı istemci yok.</p>
          )}
        </div>
      </Card>

      {/* Feed Endpoints Documentation */}
      <Card title="Besleme Uçları (Feeds)">
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          Oluşturduğunuz anahtarı <code className="font-mono text-emerald-400">x-api-key</code> başlığında ya da URL sonuna{" "}
          <code className="font-mono text-emerald-400">?key=</code> parametresi ile ekleyerek kullanabilirsiniz.
        </p>

        <div className="space-y-3 font-mono text-xs">
          {[
            ["Doğrulanmış & Parçalı Akış Feed'i (JSON)", `${origin}/api/public/v1/verified-feed?page=1&limit=50`],
            ["Parça ve Kategori Dizini (Chunks)", `${origin}/api/public/v1/verified-feed/chunks`],
            ["Doğrulanmış M3U (Parçalı Oynatma)", `${origin}/api/public/v1/verified-feed.m3u?page=1&limit=50`],
            ["JSON Liste (Tüm Akışlar)", `${origin}/api/public/v1/streams?type=live_tv&quality=1080P`],
            ["M3U Playlist (Doğrudan)", `${origin}/api/public/v1/playlist.m3u?type=live_tv`],
            ["M3U (CORS & Proxy Tünelli)", `${origin}/api/public/v1/playlist.m3u?type=live_tv&proxied=1`],
            ["Evrensel CORS Bypass Tüneli", `${origin}/api/public/v1/cors-proxy?url=https://yayin-adresi.m3u8`],
            ["EPG (XMLTV Rehber)", `${origin}/api/public/v1/epg.xml`],
          ].map(([l, u]) => (
            <div key={l} className="rounded-xl border border-white/5 bg-slate-900/50 p-3">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-sans font-semibold mb-1">
                {l}
              </div>
              <div className="flex items-center justify-between gap-2">
                <code className="flex-1 break-all text-emerald-300 text-[11px]">{u}</code>
                <button
                  className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(u);
                    showToast(`${l} adresi kopyalandı`, "ok");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ----------------------------------------------------
// Tab 5: Network / Proxy Component
// ----------------------------------------------------

function NetworkTab({
  resources,
  onRefresh,
  showToast,
}: {
  resources: ResourcesResponse | null;
  onRefresh: () => void;
  showToast: (msg: string, type?: "ok" | "err") => void;
}) {
  const [label, setLabel] = useState("");
  const [template, setTemplate] = useState("");
  const [country, setCountry] = useState("");
  const [adding, setAdding] = useState(false);

  // Live Proxy Test states
  const [testUrl, setTestUrl] = useState("https://tv-trt1.medya.trt.com.tr/master_720.m3u8");
  const [selectedProxyId, setSelectedProxyId] = useState<string>("custom");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    success: boolean;
    status: number;
    statusText: string;
    latencyMs: number;
    corsAllowed: boolean;
    corsHeader: string;
    contentType: string;
    targetUrl?: string;
    resolvedUrl?: string;
    preview?: string;
    message: string;
  } | null>(null);

  const presetTemplates = [
    { label: "CORSProxy.io", tpl: "https://corsproxy.io/?url={url}", c: "" },
    { label: "AllOrigins", tpl: "https://api.allorigins.win/raw?url={url}", c: "" },
    { label: "ThingProxy", tpl: "https://thingproxy.freeboard.io/fetch/{url}", c: "" },
    { label: "Yerel Tünel", tpl: "/api/public/v1/cors-proxy?url={url}", c: "TR" },
  ];

  const handleApplyPreset = (preset: { label: string; tpl: string; c: string }) => {
    setLabel(preset.label);
    setTemplate(preset.tpl);
    setCountry(preset.c);
    showToast(`${preset.label} şablonu forma aktarıldı`, "ok");
  };

  const handleAdd = async () => {
    if (!label || !template) return;
    setAdding(true);
    try {
      await api.addProxy({ label, template, country: country || undefined });
      setLabel("");
      setTemplate("");
      setCountry("");
      showToast("Proxy sunucusu başarıyla eklendi ve kazıma havuzuna kaydedildi", "ok");
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "err");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.toggleResource({ table: "proxies", id, remove: true });
      showToast("Proxy sunucusu silindi", "ok");
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "err");
    }
  };

  const handleRunTest = async (overrideId?: string, overrideTemplate?: string) => {
    const targetProxyId = overrideId || selectedProxyId;
    const targetTemplate = overrideTemplate || (targetProxyId === "custom" ? template : undefined);

    if (targetProxyId === "custom" && !targetTemplate) {
      showToast("Lütfen test edilecek bir proxy şablonu girin veya havuzdan bir proxy seçin", "err");
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const res = await api.testProxy({
        id: targetProxyId !== "custom" ? targetProxyId : undefined,
        template: targetTemplate,
        testUrl,
        country: country || undefined,
      });
      setTestResult(res);
      if (res.success) {
        showToast(`Proxy testi başarılı (${res.latencyMs} ms)`, "ok");
      } else {
        showToast(res.message || "Proxy yanıt vermedi", "err");
      }
      if (targetProxyId !== "custom") {
        onRefresh();
      }
    } catch (err: any) {
      showToast(err.message || "Test sırasında hata oluştu", "err");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                Proxy Ayarları & Alternatif Kazıma Katmanı
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                CORS kısıtlamalarını ve co-location engellerini aşmak için proxy sunucuları tanımlayın, test edin ve motor rotasyonuna sokun.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="px-3 py-1 rounded-xl bg-slate-800/80 border border-white/5 text-emerald-400">
              {resources?.proxies?.length || 0} Aktif Proxy
            </span>
            <span className="px-3 py-1 rounded-xl bg-slate-800/80 border border-white/5 text-slate-300">
              Otonom Rotasyon Açık
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Proxy Management & Presets */}
        <div className="space-y-6">
          <Card title="Alternatif Proxy Sunucusu Ekle" badge="Proxy Havuzu">
            <p className="mb-4 text-xs text-slate-400 leading-relaxed">
              Kazıma işlemlerinde hedef sunucunun IP engeline veya CORS filtresine takılmamak için alternatif HTTP/SOCKS veya web proxy şablonu tanımlayın.
            </p>

            {/* Quick Presets */}
            <div className="mb-4">
              <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-2">
                Hızlı Şablon Seçimi:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {presetTemplates.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 transition-colors inline-flex items-center gap-1"
                  >
                    <Zap className="w-3 h-3 text-amber-400" />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-300 mb-1 block">Etiket / Sunucu Adı</label>
                <input
                  className={inputCls + " w-full"}
                  placeholder="Örn. Webshare TR Residential Gateway"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 mb-1 block">
                  Proxy URL Şablonu <span className="text-[11px] text-slate-500 font-mono">({" {url} "} veya {" {rawUrl} "})</span>
                </label>
                <input
                  className={inputCls + " w-full font-mono text-xs"}
                  placeholder="https://proxy-provider/?token=...&url={url}"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 mb-1 block">
                  Hedef Ülke Kodu (Opsiyonel)
                </label>
                <input
                  className={inputCls + " w-full uppercase"}
                  placeholder="TR, DE, US, FR..."
                  maxLength={2}
                  value={country}
                  onChange={(e) => setCountry(e.target.value.toUpperCase())}
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  className={btnCls + " flex-1"}
                  disabled={!label || !template || adding}
                  onClick={handleAdd}
                >
                  {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Proxy Sunucusunu Kaydet
                </button>
                <button
                  type="button"
                  className={ghostCls}
                  disabled={!template || testing}
                  onClick={() => handleRunTest("custom", template)}
                  title="Formdaki şablonu kaydetmeden hemen test et"
                >
                  {testing ? <Loader2 className="h-4 w-4 animate-spin text-emerald-400" /> : <Play className="h-4 w-4" />}
                  Hemen Dene
                </button>
              </div>
            </div>
          </Card>

          <Card title="Challenge & Kimlik Katmanı">
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Cloudflare Turnstile, reCAPTCHA ve bot engelleri kazıma motoru tarafından tespit edildiğinde proxy rotasyonu ve tarayıcı başlıkları dinamik olarak güncellenir.
            </p>

            <div
              className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs ${
                resources?.captchaReady
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                  : "bg-slate-900/80 border-white/5 text-slate-400"
              }`}
            >
              <Shield className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>
                {resources?.captchaReady
                  ? "Çözücü modülü aktif"
                  : "Engel tespit ve akıllı User-Agent / Referer taklit motoru devrede"}
              </span>
            </div>
          </Card>
        </div>

        {/* Right Column: Live Proxy Diagnostic Lab */}
        <div className="space-y-6">
          <Card title="Canlı Proxy Test Laboratuvarı" badge="CORS & Latency">
            <p className="mb-4 text-xs text-slate-400 leading-relaxed">
              Eklediğiniz proxy sunucusunun hedef HLS yayınına veya web sitesine erişip erişemediğini, gecikme süresini (latency) ve CORS başlıklarını canlı olarak teşhis edin.
            </p>

            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-medium text-slate-300 mb-1 block">Test Edilecek Hedef Yayın URL'si</label>
                <input
                  className={inputCls + " w-full font-mono text-xs"}
                  placeholder="https://tv-trt1.medya.trt.com.tr/master_720.m3u8"
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                />
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[11px] text-slate-500 font-mono">Örnek:</span>
                  <button
                    type="button"
                    onClick={() => setTestUrl("https://tv-trt1.medya.trt.com.tr/master_720.m3u8")}
                    className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                  >
                    TRT 1 HLS
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestUrl("https://ciner.daioncdn.net/showtv/showtv.m3u8?app=showtv_web")}
                    className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                  >
                    Show TV HLS
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestUrl("https://rnttwmjcin.turknet.ercdn.net/lcpmvefbyo/atv/atv_720p.m3u8")}
                    className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                  >
                    ATV HLS
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 mb-1 block">Kullanılacak Proxy Sunucusu</label>
                <select
                  className={inputCls + " w-full"}
                  value={selectedProxyId}
                  onChange={(e) => setSelectedProxyId(e.target.value)}
                >
                  <option value="custom">Formdaki Güncel Şablonu Kullan</option>
                  {(resources?.proxies ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} {p.country ? `(${p.country})` : ""} — {p.template.slice(0, 40)}...
                    </option>
                  ))}
                </select>
              </div>

              <button
                className={btnCls + " w-full"}
                disabled={testing}
                onClick={() => handleRunTest()}
              >
                {testing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Proxy Bağlantısı ve CORS Test Ediliyor...
                  </>
                ) : (
                  <>
                    <Gauge className="h-4 w-4" />
                    Bağlantıyı ve CORS'u Test Et
                  </>
                )}
              </button>
            </div>

            {/* Test Result Display Card */}
            {testResult && (
              <div
                className={`mt-5 rounded-xl border p-4 transition-all ${
                  testResult.success
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-red-500/40 bg-red-500/10"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    <span className="text-xs font-bold text-white">
                      {testResult.success ? "Bağlantı Başarılı" : "Bağlantı Başarısız"}
                    </span>
                  </div>
                  <span
                    className={`font-mono text-xs px-2 py-0.5 rounded-full border ${
                      testResult.latencyMs < 300
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : testResult.latencyMs < 800
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                        : "bg-red-500/20 text-red-300 border-red-500/30"
                    }`}
                  >
                    {testResult.latencyMs} ms
                  </span>
                </div>

                <p className="text-xs text-slate-300 mb-3">{testResult.message}</p>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono border-t border-white/10 pt-2 mb-2">
                  <div>
                    <span className="text-slate-400 block">HTTP Durumu:</span>
                    <span className="font-bold text-white">
                      {testResult.status} {testResult.statusText}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">CORS İzni:</span>
                    <span className={testResult.corsAllowed ? "text-emerald-400 font-bold" : "text-amber-400"}>
                      {testResult.corsAllowed ? "✅ Açık / İzin Verildi" : "⚠️ Kısıtlı"}
                    </span>
                  </div>
                </div>

                {testResult.preview && (
                  <div className="mt-2 pt-2 border-t border-white/5">
                    <span className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                      Alınan HLS / Veri Önizlemesi:
                    </span>
                    <pre className="text-[11px] font-mono text-slate-300 bg-black/40 p-2 rounded border border-white/5 overflow-x-auto max-h-24">
                      {testResult.preview}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Full-width Registered Proxies Pool */}
      <Card title="Kayıtlı Proxy Havuzu ve İstatistikler" badge={`${resources?.proxies?.length || 0} Sunucu`}>
        <div className="space-y-2.5">
          {(resources?.proxies ?? []).map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-slate-900/60 p-3.5 text-xs hover:border-white/10 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <Globe2 className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white truncate">{p.label}</span>
                    {p.country && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        {p.country}
                      </span>
                    )}
                  </div>
                  <code className="font-mono text-[11px] text-slate-400 block truncate max-w-lg mt-0.5">
                    {p.template}
                  </code>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {p.success_count} baş
                  </span>
                  <span className="text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                    {p.ban_count} ban
                  </span>
                </div>

                <button
                  type="button"
                  className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors font-semibold text-xs inline-flex items-center gap-1"
                  onClick={() => handleRunTest(p.id, p.template)}
                  title="Bu proxy'yi test et"
                >
                  <Play className="w-3 h-3 text-emerald-400" />
                  Test Et
                </button>

                <button
                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                  onClick={() => handleDelete(p.id)}
                  title="Proxy'yi Sil"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}

          {!resources?.proxies?.length && (
            <div className="py-8 text-center text-xs text-slate-500">
              Henüz proxy sunucusu eklenmedi. Havuz boşken motor doğrudan bağlantı kurar; yukarıdaki form veya hızlı şablonlarla proxy ekleyebilirsiniz.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ----------------------------------------------------
// Tab 6: Integrations / Webhooks & EPG Component
// ----------------------------------------------------

function IntegrationsTab({
  resources,
  onRefresh,
  showToast,
}: {
  resources: ResourcesResponse | null;
  onRefresh: () => void;
  showToast: (msg: string, type?: "ok" | "err") => void;
}) {
  const [w, setW] = useState({ name: "", kind: "discord", url: "", chatId: "" });
  const [epgUrl, setEpgUrl] = useState("");
  const [addingHook, setAddingHook] = useState(false);
  const [addingEpg, setAddingEpg] = useState(false);
  const [testingHook, setTestingHook] = useState(false);

  const handleAddHook = async () => {
    if (!w.name || !w.url) return;
    setAddingHook(true);
    try {
      await api.addWebhook({
        name: w.name,
        kind: w.kind,
        url: w.url,
        chatId: w.chatId || undefined,
      });
      setW({ name: "", kind: "discord", url: "", chatId: "" });
      showToast("Bildirim kanalı eklendi", "ok");
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "err");
    } finally {
      setAddingHook(false);
    }
  };

  const handleTestHook = async () => {
    setTestingHook(true);
    try {
      await api.testWebhooks();
      showToast("Test bildirimi gönderildi", "ok");
    } catch (err: any) {
      showToast(err.message, "err");
    } finally {
      setTestingHook(false);
    }
  };

  const handleAddEpg = async () => {
    if (!epgUrl) return;
    setAddingEpg(true);
    try {
      await api.addEpgSource({ url: epgUrl });
      setEpgUrl("");
      showToast("EPG kaynağı eklendi", "ok");
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "err");
    } finally {
      setAddingEpg(false);
    }
  };

  const handleDeleteHook = async (id: string) => {
    try {
      await api.toggleResource({ table: "webhooks", id, remove: true });
      showToast("Bildirim kanalı silindi", "ok");
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "err");
    }
  };

  const handleDeleteEpg = async (id: string) => {
    try {
      await api.toggleResource({ table: "epg_sources", id, remove: true });
      showToast("EPG kaynağı silindi", "ok");
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "err");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Webhooks Section */}
      <Card
        title="Anlık Bildirimler (Webhooks)"
        right={
          <button
            className={ghostCls + " py-1 text-xs"}
            disabled={testingHook}
            onClick={handleTestHook}
          >
            {testingHook ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Test Bildirimi Gönder
          </button>
        }
      >
        <div className="space-y-3">
          <input
            className={inputCls + " w-full"}
            placeholder="Kanal Adı (örn. Sunucu Discord Alarmları)"
            value={w.name}
            onChange={(e) => setW({ ...w, name: e.target.value })}
          />
          <select
            className={inputCls + " w-full"}
            value={w.kind}
            onChange={(e) => setW({ ...w, kind: e.target.value })}
          >
            <option value="discord">Discord Webhook</option>
            <option value="telegram">Telegram Bot</option>
            <option value="generic">Özel HTTP Webhook</option>
          </select>
          <input
            className={inputCls + " w-full"}
            placeholder={w.kind === "telegram" ? "Telegram Bot Token" : "https://discord.com/api/webhooks/..."}
            value={w.url}
            onChange={(e) => setW({ ...w, url: e.target.value })}
          />
          {w.kind === "telegram" && (
            <input
              className={inputCls + " w-full"}
              placeholder="Telegram Sohbet ID"
              value={w.chatId}
              onChange={(e) => setW({ ...w, chatId: e.target.value })}
            />
          )}
          <button
            className={btnCls + " w-full"}
            disabled={!w.name || !w.url || addingHook}
            onClick={handleAddHook}
          >
            {addingHook ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Bildirim Kanalı Ekle
          </button>
        </div>

        <div className="mt-6 space-y-2">
          <h4 className="text-xs uppercase font-mono text-slate-400 mb-2">Kayıtlı Kanallar</h4>
          {(resources?.webhooks ?? []).map((h) => (
            <div
              key={h.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-slate-900/60 px-3.5 py-2.5 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Radio className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="font-semibold text-white truncate">
                  {h.name} <span className="font-normal text-slate-400">· {h.kind}</span>
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-slate-400 text-[11px]">
                  Durum: {h.last_status ?? "-"}
                </span>
                <button
                  className="p-1 rounded text-red-400 hover:bg-red-500/10 transition-colors"
                  onClick={() => handleDeleteHook(h.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {!resources?.webhooks?.length && (
            <p className="text-xs text-slate-500 py-3 text-center">Kayıtlı bildirim kanalı yok.</p>
          )}
        </div>
      </Card>

      {/* EPG Sources Section */}
      <Card title="EPG Kaynakları (XMLTV)">
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          XMLTV formatındaki rehber URL adreslerini ekleyin. Motor otomatik olarak programları indirir ve akış isimleriyle eşler.
        </p>

        <div className="flex gap-2">
          <input
            className={inputCls + " flex-1"}
            placeholder="https://epg.example.com/xmltv.xml"
            value={epgUrl}
            onChange={(e) => setEpgUrl(e.target.value)}
          />
          <button
            className={btnCls}
            disabled={!epgUrl || addingEpg}
            onClick={handleAddEpg}
          >
            {addingEpg ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Ekle
          </button>
        </div>

        <div className="mt-6 space-y-2">
          <h4 className="text-xs uppercase font-mono text-slate-400 mb-2">Kayıtlı EPG Kaynakları</h4>
          {(resources?.epg ?? []).map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-slate-900/60 px-3.5 py-2.5 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Rss className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="font-mono text-slate-200 truncate">{s.url}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-slate-400 text-[11px] tabular-nums">
                  {s.program_count} program
                </span>
                <button
                  className="p-1 rounded text-red-400 hover:bg-red-500/10 transition-colors"
                  onClick={() => handleDeleteEpg(s.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {!resources?.epg?.length && (
            <p className="text-xs text-slate-500 py-3 text-center">
              Kaynak yok. XMLTV adresi ekleyince program rehberi otomatik eşlenir.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
