export interface OverviewResponse {
  streams: {
    total: number;
    active: number;
    dead: number;
    fhd: number;
    hd: number;
    sd: number;
  };
  engine: {
    queuedJobs: number;
    activeProxies: number;
    activeClients: number;
    totalQueries: number;
  };
  logs: Array<{
    id: number;
    level: string;
    phase: string;
    message: string;
    meta?: any;
    created_at: string;
  }>;
  metrics: Array<any>;
  lastChecked: string;
}

export interface StreamItem {
  id: string;
  title: string;
  type: string;
  category: string | null;
  stream_url: string;
  poster_image_url: string | null;
  resolution: string | null;
  quality_tier: string | null;
  bitrate_kbps: number | null;
  response_ms: number | null;
  status: string;
  failure_count: number;
  source: string | null;
  priority: number;
  geo_country?: string | null;
  channel_type?: string | null;
  last_checked_at: string | null;
  failover_group: string | null;
  custom_headers?: Record<string, string>;
}

export interface ResourcesResponse {
  proxies: Array<{
    id: string;
    label: string;
    template: string;
    country: string | null;
    success_count: number;
    fail_count: number;
    ban_count: number;
    active: number;
  }>;
  clients: Array<{
    id: string;
    name: string;
    key_prefix: string;
    ip_whitelist: string[];
    rate_limit_per_min: number;
    active: number;
    request_count: number;
    last_used_at: string | null;
    created_at: string;
  }>;
  webhooks: Array<{
    id: string;
    name: string;
    kind: string;
    url: string;
    telegram_chat_id: string | null;
    events: string[];
    active: number;
    last_status: number | null;
  }>;
  epg: Array<{
    id: string;
    url: string;
    active: number;
    last_synced_at: string | null;
    program_count: number;
  }>;
  queries: Array<{
    id: string;
    engine: string;
    query: string;
    active: number;
    hit_count: number;
    last_run_at: string | null;
  }>;
  captchaReady: boolean;
}

export const api = {
  async getOverview(): Promise<OverviewResponse> {
    const res = await fetch("/api/console/overview");
    if (!res.ok) throw new Error("Genel durum verisi alınamadı");
    return res.json();
  },

  async listStreams(params: {
    q?: string;
    status?: string;
    tier?: string;
    type?: string;
    onlyTurkish?: boolean;
    onlyUnknown?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<StreamItem[]> {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.status) sp.set("status", params.status);
    if (params.tier) sp.set("tier", params.tier);
    if (params.type) sp.set("type", params.type);
    if (params.onlyTurkish) sp.set("onlyTurkish", "1");
    if (params.onlyUnknown) sp.set("onlyUnknown", "1");
    if (params.limit) sp.set("limit", String(params.limit));
    if (params.offset) sp.set("offset", String(params.offset));

    const res = await fetch(`/api/console/streams?${sp.toString()}`);
    if (!res.ok) throw new Error("Akış listesi yüklenemedi");
    return res.json();
  },

  async updateStream(data: { id: string; priority?: number; status?: string; remove?: boolean }) {
    const res = await fetch("/api/console/streams/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Akış güncellenemedi");
    return res.json();
  },

  async aiResolveStream(id: string) {
    const res = await fetch("/api/console/ai/resolve-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "AI analizi tamamlanamadı" }));
      throw new Error(err.error || "AI analizi tamamlanamadı");
    }
    return res.json();
  },

  async aiResolveUnknowns(limit = 25) {
    const res = await fetch("/api/console/ai/resolve-unknowns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "AI toplu çözümleme başarısız" }));
      throw new Error(err.error || "AI toplu çözümleme başarısız");
    }
    return res.json();
  },

  async seedTurkishChannels() {
    const res = await fetch("/api/console/seed-turkish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Türk kanalları yüklenemedi" }));
      throw new Error(err.error || "Türk kanalları yüklenemedi");
    }
    return res.json();
  },

  async runEngine(task: "discover" | "worker" | "health" | "epg") {
    const res = await fetch("/api/console/run-engine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Motor görevi başlatılamadı" }));
      throw new Error(err.error || "Motor görevi başlatılamadı");
    }
    return res.json();
  },

  async getResources(): Promise<ResourcesResponse> {
    const res = await fetch("/api/console/resources");
    if (!res.ok) throw new Error("Kaynak verileri alınamadı");
    return res.json();
  },

  async addProxy(data: { label: string; template: string; country?: string }) {
    const res = await fetch("/api/console/proxy/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Proxy eklenemedi");
    return res.json();
  },

  async testProxy(data: { template?: string; id?: string; testUrl?: string; country?: string }) {
    const res = await fetch("/api/console/proxy/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Proxy testi gerçekleştirilemedi" }));
      throw new Error(err.error || "Proxy testi gerçekleştirilemedi");
    }
    return res.json();
  },

  async createApiClient(data: { name: string; ips: string; rate: number }) {
    const res = await fetch("/api/console/client/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("API istemcisi oluşturulamadı");
    return res.json();
  },

  async addWebhook(data: { name: string; kind: string; url: string; chatId?: string }) {
    const res = await fetch("/api/console/webhook/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Bildirim kanalı eklenemedi");
    return res.json();
  },

  async testWebhooks() {
    const res = await fetch("/api/console/webhook/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error("Webhook test bildirimi gönderilemedi");
    return res.json();
  },

  async addEpgSource(data: { url: string }) {
    const res = await fetch("/api/console/epg/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("EPG kaynağı eklenemedi");
    return res.json();
  },

  async addQuery(data: { engine: string; query: string }) {
    const res = await fetch("/api/console/query/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Keşif sorgusu eklenemedi");
    return res.json();
  },

  async toggleResource(data: { table: string; id: string; active?: boolean; remove?: boolean }) {
    const res = await fetch("/api/console/resource/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Kaynak durumu güncellenemedi");
    return res.json();
  },

  async claimAdmin() {
    const res = await fetch("/api/console/claim-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error("Yönetici yetkisi doğrulanamadı");
    return res.json();
  },

  async getBackupStatus() {
    const res = await fetch("/api/console/backup-status");
    if (!res.ok) throw new Error("Yedek durumu alınamadı");
    return res.json();
  },
};
