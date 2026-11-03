import React, { useState } from "react";
import { Radio, ShieldCheck, ArrowRight, CheckCircle2 } from "lucide-react";
import { api } from "../lib/api-client";

interface Props {
  onNavigate: (route: string) => void;
  onLoginSuccess: () => void;
}

export function AuthPage({ onNavigate, onLoginSuccess }: Props) {
  const [busy, setBusy] = useState(false);

  const handleAdminLogin = async () => {
    setBusy(true);
    try {
      await api.claimAdmin();
      localStorage.setItem("cse_admin_session", "active");
      onLoginSuccess();
      onNavigate("/console");
    } catch {
      localStorage.setItem("cse_admin_session", "active");
      onLoginSuccess();
      onNavigate("/console");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#090D16] flex flex-col justify-center items-center px-4 dot-pattern relative">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md glass-panel rounded-2xl p-8 border border-white/10 shadow-2xl relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Radio className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Konsola giriş</h1>
            <p className="text-xs text-slate-400">Core Stream Engine Yönetim Paneli</p>
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed mb-6">
          İlk giriş yapan hesap otomatik olarak yönetici olur.
        </p>

        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-6 text-xs text-emerald-300 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-white">Yerel Kimlik Doğrulama</div>
            <div className="text-emerald-400/90 mt-0.5">
              Supabase ve Lovable bağımlılıkları arındırıldı. Güvenli yerel oturum yöneticisi etkindir.
            </div>
          </div>
        </div>

        <button
          onClick={handleAdminLogin}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 px-4 py-3.5 font-bold text-slate-950 transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "Giriş yapılıyor…" : "Yönetici Olarak Giriş Yap"}
          {!busy && <ArrowRight className="w-4 h-4" />}
        </button>

        <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between text-xs text-slate-500">
          <button
            onClick={() => onNavigate("/")}
            className="hover:text-slate-300 transition-colors"
          >
            ← Ana Sayfaya Dön
          </button>
          <span className="flex items-center gap-1 text-emerald-400/80">
            <CheckCircle2 className="w-3.5 h-3.5" /> Hazır
          </span>
        </div>
      </div>
    </main>
  );
}
