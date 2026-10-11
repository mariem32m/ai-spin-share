import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useLang, type Lang } from "../lib/i18n";
import { store } from "../lib/store";
import { Robot } from "./Robot";
import { FloatingBackground } from "./FloatingBackground";

const FOOTER_YEAR = new Date().getFullYear();

/** Two-button EN / عربي language switcher. */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useLang();
  const options: { value: Lang; label: string }[] = [
    { value: "en", label: "EN" },
    { value: "ar", label: "عربي" },
  ];
  return (
    <div
      className="flex items-center gap-1 rounded-full border-2 border-violet-200 bg-white/80 p-1 shadow-sm"
      role="group"
      aria-label="Language / اللغة"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setLang(o.value)}
          aria-pressed={lang === o.value}
          className={`rounded-full px-3 py-1 text-sm font-bold transition-colors ${
            lang === o.value ? "bg-gradient-to-r from-pink-500 to-violet-500 text-white shadow" : "text-violet-700 hover:bg-violet-100"
          } ${compact ? "px-2 py-0.5 text-xs" : ""}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Small badge showing Demo vs Live persistence mode. */
export function ModeBadge() {
  const { t } = useLang();
  const live = store.mode === "supabase";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${
        live ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
      title={live ? t("live.banner") : t("demo.banner")}
    >
      <span className={`live-dot ${live ? "" : "!bg-amber-400"}`} />
      {live ? `☁️ ${t("mode.live")}` : `🧪 ${t("mode.demo")}`}
    </span>
  );
}

/** Visible demo-mode notice required by the demo contract. */
export function ModeNotice() {
  const { t } = useLang();
  if (store.mode === "supabase") {
    return (
      <p className="mx-auto mb-4 max-w-3xl text-center text-sm font-semibold text-emerald-600">
        ☁️ {t("live.banner")}
      </p>
    );
  }
  return (
    <p className="mx-auto mb-4 max-w-3xl rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/90 px-4 py-2 text-center text-sm font-semibold text-amber-700">
      🧪 {t("demo.banner")}
    </p>
  );
}

/** Top bar with brand + language switcher. */
export function TopBar({ showHome = true }: { showHome?: boolean }) {
  const { t } = useLang();
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <Link to="/" className="flex items-center gap-3 rounded-2xl px-2 py-1 transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-3 focus-visible:outline-amber-400">
        <Robot mood="idle" size={46} />
        <span>
          <span className="block text-xs font-bold tracking-wide text-violet-500">{t("community.name")}</span>
          <span className="block text-lg font-extrabold leading-tight text-gradient">{t("app.title.alt")}</span>
        </span>
      </Link>
      <div className="flex items-center gap-2">
        {showHome && (
          <Link to="/" className="text-sm font-bold text-violet-700 underline-offset-4 hover:underline">
            🏠 {t("back.home")}
          </Link>
        )}
        <ModeBadge />
        <LanguageSwitcher />
      </div>
    </header>
  );
}

/** Full page shell with the decorative background. */
export function Shell({ children, showHome = true }: { children: ReactNode; showHome?: boolean }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <FloatingBackground />
      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-14 pt-4 sm:px-6">
        <TopBar showHome={showHome} />
        {children}
        <footer className="mt-12 text-center text-sm font-semibold text-violet-400">
          {`${FOOTER_YEAR} · GDGoC AAST Aswan — AI Track Orientation 🚀`}
        </footer>
      </div>
    </div>
  );
}