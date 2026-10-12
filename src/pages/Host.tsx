import { useCallback, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Shell, ModeNotice } from "../components/Layout";
import { Robot } from "../components/Robot";
import { QuestionChart } from "../components/QuestionChart";
import { ResponseCard } from "../components/ResponseCard";
import { useLang } from "../lib/i18n";
import { useSurveyResponses } from "../hooks/useSurveyResponses";
import {
  HOST_HASH,
  isSupabaseConfigured,
  signInOrganizer,
  signOutOrganizer,
  organizerEmail,
  publicBaseUrl,
  studentJoinUrl,
} from "../lib/supabase";
import { store } from "../lib/store";
import { SURVEY_QUESTIONS, FINAL_QUESTION } from "../lib/questions";
import type { SurveyQuestionKey } from "../lib/questions";
import { surveysToCsv, downloadCsv } from "../lib/csv";
import type { SurveySubmission } from "../lib/types";

const AUTH_KEY = "aiyourseyes:host:auth";

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isLocalUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1";
  } catch {
    return true;
  }
}

type ViewMode = "full" | "expectations";

export function Host() {
  const { t, lang, pick } = useLang();
  const { responses, loading, error, refresh, mode, session } = useSurveyResponses(5000);

  const liveMode = mode === "supabase";
  // Host auth is configured when a host hash is set OR when Supabase Auth
  // is available for organizer-account sign-in.
  const moderationConfigured = Boolean(HOST_HASH || isSupabaseConfigured);
  const needsConfig = liveMode && !moderationConfigured;
  const [authed, setAuthed] = useState(() => {
    try {
      return sessionStorage.getItem(AUTH_KEY) === "1";
    } catch {
      return false;
    }
  });

  const [password, setPassword] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
  const [orgPassword, setOrgPassword] = useState("");
  const [authMode, setAuthMode] = useState<"password" | "account">(
    isSupabaseConfigured ? "account" : "password",
  );
  const [authError, setAuthError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterValue, setFilterValue] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("full");
  const [fullscreen, setFullscreen] = useState(false);

  const joinUrl = studentJoinUrl();
  const origin = publicBaseUrl();
  const localWarning = isLocalUrl(origin);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  /* ---------- authentication (live mode) ---------- */
  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        const hash = await sha256Hex(password);
        if (hash === HOST_HASH) {
          try {
            sessionStorage.setItem(AUTH_KEY, "1");
          } catch {
            /* ignore */
          }
          setAuthed(true);
          setAuthError(null);
          setPassword("");
        } else {
          setAuthError(t("host.auth.bad"));
        }
      } catch {
        setAuthError(t("host.auth.bad"));
      }
    },
    [password, t],
  );

  /* Organizer account sign-in (Supabase Auth — recommended in live mode). */
  const handleOrgLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        await signInOrganizer(orgEmail.trim(), orgPassword);
        try {
          sessionStorage.setItem(AUTH_KEY, "1");
        } catch {
          /* ignore */
        }
        setAuthed(true);
        setAuthError(null);
        setOrgEmail("");
        setOrgPassword("");
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : t("host.auth.bad"));
      }
    },
    [orgEmail, orgPassword, t],
  );

  const handleLogout = useCallback(() => {
    try {
      sessionStorage.removeItem(AUTH_KEY);
    } catch {
      /* ignore */
    }
    setAuthed(false);
    void signOutOrganizer();
  }, []);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t("dash.join.link"), joinUrl);
    }
  }, [joinUrl, t]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      setFullscreen(false);
    } else {
      void document.documentElement.requestFullscreen().then(
        () => setFullscreen(true),
        () => setFullscreen(false),
      );
    }
  }, []);

  const handleReset = useCallback(async () => {
    if (!window.confirm(t("dash.reset.confirm"))) return;
    try {
      await store.resetSession();
      window.location.reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Reset failed");
    }
  }, [showToast, t]);

  const handleDelete = useCallback(async () => {
    const input = window.prompt(t("dash.delete.confirm"));
    if (input !== "DELETE") return;
    try {
      await store.deleteSessionData(session?.id ?? "");
      window.location.reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Delete failed");
    }
  }, [session, showToast, t]);

  /* ---------- filtering + search ---------- */
  const totalCount = responses.length;
  const namedCount = responses.filter((r) => r.nickname && r.nickname.trim()).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list: SurveySubmission[] = responses;
    if (filterValue !== "all") {
      const [key, id] = filterValue.split("::") as [SurveyQuestionKey, string];
      list = list.filter((row) => {
        const v = row[key];
        return Array.isArray(v) ? v.includes(id) : v === id;
      });
    }
    if (q) {
      list = list.filter((row) => {
        const text = `${row.nickname ?? ""} ${row.ai_track_expectations}`.toLowerCase();
        return text.includes(q);
      });
    }
    return list.slice(0, 200);
  }, [responses, search, filterValue]);

  /* Filter options: one per question option (grouped). */
  const filterOptions = useMemo(
    () =>
      SURVEY_QUESTIONS.flatMap((q) =>
        q.options.map((o) => ({ value: `${q.key}::${o.id}`, label: `${q.number}. ${pick(o)}` })),
      ),
    [pick],
  );

  const handleExport = useCallback(() => {
    if (filtered.length === 0) return;
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`ai-track-responses-${date}.csv`, surveysToCsv(filtered, lang));
    showToast(t("dash.exported"));
  }, [filtered, lang, showToast, t]);

  /* ---------- login gate (live mode with host auth) ---------- */
  if (liveMode && moderationConfigured && !authed) {
    const accountEnabled = isSupabaseConfigured;
    const showPasswordTab = accountEnabled ? authMode === "password" : true;
    return (
      <Shell>
        <ModeNotice />
        <div className="mx-auto max-w-md pt-8">
          <div className="glass-card rounded-[2rem] p-8 text-center">
            <div className="flex justify-center">
              <Robot mood="idle" size={100} />
            </div>
            <h1 className="text-gradient mt-4 text-2xl font-extrabold">🔐 {t("host.login.title")}</h1>

            {accountEnabled && (
              <div className="mt-5 flex rounded-full bg-slate-100 p-1" role="tablist" aria-label={t("host.login.title")}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === "account"}
                  onClick={() => {
                    setAuthMode("account");
                    setAuthError(null);
                  }}
                  className={`flex-1 rounded-full px-3 py-2 text-xs font-extrabold transition ${
                    authMode === "account" ? "bg-white text-violet-600 shadow" : "text-slate-500"
                  }`}
                >
                  {t("host.auth.account.tab")}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === "password"}
                  onClick={() => {
                    setAuthMode("password");
                    setAuthError(null);
                  }}
                  className={`flex-1 rounded-full px-3 py-2 text-xs font-extrabold transition ${
                    authMode === "password" ? "bg-white text-violet-600 shadow" : "text-slate-500"
                  }`}
                >
                  {t("host.auth.password.tab")}
                </button>
              </div>
            )}

            {showPasswordTab ? (
              <form onSubmit={(e) => void handleLogin(e)} className="mt-6 flex flex-col gap-4">
                <label htmlFor="host-pass" className="text-left text-sm font-extrabold text-slate-600">
                  {t("host.password.label")}
                </label>
                <input
                  id="host-pass"
                  type="password"
                  className="field"
                  placeholder={t("host.password.placeholder")}
                  value={password}
                  autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)}
                />
                {authError && <p className="text-sm font-bold text-rose-600">⚠️ {authError}</p>}
                <button type="submit" className="btn-base btn-spin" disabled={!password}>
                  🔓 {t("host.login.btn")}
                </button>
                {!accountEnabled && (
                  <p className="mt-2 text-xs font-semibold text-slate-400">🔒 {t("host.login.hint")}</p>
                )}
              </form>
            ) : (
              <form onSubmit={(e) => void handleOrgLogin(e)} className="mt-6 flex flex-col gap-4">
                <label htmlFor="host-email" className="text-left text-sm font-extrabold text-slate-600">
                  {t("host.auth.email.label")}
                </label>
                <input
                  id="host-email"
                  type="email"
                  className="field"
                  placeholder={t("host.auth.email.placeholder")}
                  value={orgEmail}
                  autoComplete="email"
                  dir="ltr"
                  onChange={(e) => setOrgEmail(e.target.value)}
                />
                <label htmlFor="host-org-pass" className="text-left text-sm font-extrabold text-slate-600">
                  {t("host.password.label")}
                </label>
                <input
                  id="host-org-pass"
                  type="password"
                  className="field"
                  placeholder={t("host.password.placeholder")}
                  value={orgPassword}
                  autoComplete="current-password"
                  onChange={(e) => setOrgPassword(e.target.value)}
                />
                {authError && <p className="text-sm font-bold text-rose-600">⚠️ {authError}</p>}
                <button type="submit" className="btn-base btn-spin" disabled={!orgEmail || !orgPassword}>
                  🔓 {t("host.auth.signin.btn")}
                </button>
                <p className="mt-2 text-xs font-semibold text-slate-400">🔒 {t("host.auth.account.hint")}</p>
              </form>
            )}
          </div>
        </div>
      </Shell>
    );
  }

  /* ---------- shared presentation header (QR + stats) ---------- */
  const header = (
    <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="glass-card rounded-[2rem] p-6">
        <div className="flex flex-wrap items-center gap-4">
          <Robot mood="happy" size={72} />
          <div>
            <div className="text-xs font-extrabold tracking-wide text-violet-500">GDGoC AAST Aswan</div>
            <h1 className="text-gradient text-3xl font-extrabold">📊 {t("host.title")}</h1>
            <p className="text-base font-bold text-slate-600">{t("dash.tagline")}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="📨" value={String(totalCount)} sub={t("dash.stats.total")} />
          <Stat label="👤" value={String(namedCount)} sub={t("dash.stats.named")} />
          <Stat label="🆔" value={liveMode ? "☁️" : "🧪"} sub={t("dash.stats.session")} />
          <Stat label="📡" value={loading ? "…" : error ? "⚠️" : totalsLive(totalCount)} sub={t("wall.live")} />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {liveMode && moderationConfigured && (
            <button type="button" onClick={handleLogout} className="btn-base btn-ghost-soft">
              🔒 {t("host.logout")}
              {organizerEmail() ? ` · ${organizerEmail()}` : ""}
            </button>
          )}
          <button type="button" onClick={toggleFullscreen} className="btn-base btn-secondary">
            {fullscreen ? "🚪 " : "🖥️ "} {fullscreen ? t("host.exit.present") : t("host.present")}
          </button>
          {!loading && error && (
            <button type="button" onClick={() => void refresh()} className="btn-base btn-ghost-soft">
              🔄 {t("wall.retry")}
            </button>
          )}
          <button type="button" onClick={handleReset} className="btn-base btn-secondary">
            🔄 {t("dash.reset")}
          </button>
          <button type="button" onClick={() => void handleDelete()} className="btn-base !bg-rose-500">
            🗑️ {t("dash.delete")}
          </button>
        </div>

        {toast && <p className="mt-4 rounded-xl bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700">{toast}</p>}
      </div>

      {/* QR panel */}
      <aside className="glass-card flex flex-col items-center rounded-[2rem] p-6 text-center">
        <h2 className="text-sm font-extrabold tracking-wide text-violet-500">📱 {t("dash.scan.title")}</h2>
        <div className="my-4 rounded-3xl bg-white p-4 shadow-inner ring-4 ring-violet-100">
          <QRCodeSVG value={joinUrl} size={190} level="M" marginSize={0} fgColor="#312e81" bgColor="#ffffff" />
        </div>
        <p className="text-xs font-bold text-violet-500">{t("dash.share.note")}</p>

        {localWarning && (
          <p className="mt-3 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
            ⚠️ {t("dash.qr.local.warning")}
          </p>
        )}

        <div className="mt-3 w-full">
          <label htmlFor="join-link" className="sr-only">
            {t("dash.join.link")}
          </label>
          <input id="join-link" readOnly className="field text-center text-xs" value={joinUrl} />
          <button type="button" onClick={() => void copyLink()} className="btn-base btn-secondary mt-2 w-full">
            {copied ? `✅ ${t("host.copied")}` : `📋 ${t("host.copy")}`}
          </button>
        </div>
      </aside>
    </section>
  );

  /* ---------- config-needed gate (live mode without host hash) ---------- */
  if (needsConfig) {
    return (
      <Shell>
        <ModeNotice />
        {header}
        <div className="mx-auto mt-8 max-w-2xl rounded-[2rem] border-2 border-dashed border-amber-300 bg-amber-50/80 p-8 text-center">
          <div className="flex justify-center">
            <Robot mood="sad" size={110} />
          </div>
          <h2 className="mt-4 text-2xl font-extrabold text-amber-800">🔐 {t("dash.auth.need")}</h2>
          <ol className="mx-auto mt-4 max-w-lg space-y-2 text-left text-sm font-semibold text-amber-800">
            <li>1️⃣ <span dir="ltr">node scripts/sha256.mjs "your-host-password"</span></li>
            <li>2️⃣ Set <span dir="ltr">VITE_HOST_HASH</span> to the printed hex in <span dir="ltr">.env</span></li>
            <li>3️⃣ Deploy: <span dir="ltr">supabase functions deploy host-actions --no-verify-jwt</span></li>
            <li>4️⃣ Set the same hash as the <span dir="ltr">HOST_HASH</span> secret, then reload.</li>
          </ol>
        </div>
      </Shell>
    );
  }

  /* ---------- full dashboard ---------- */
  const expectationsCount = totalCount;
  const avgLen = expectationsCount === 0 ? 0 : Math.round(responses.reduce((s, r) => s + r.ai_track_expectations.length, 0) / expectationsCount);

  return (
    <Shell>
      <ModeNotice />
      <p className="mx-auto mb-0 max-w-3xl text-center text-xs font-semibold text-emerald-600">
        🟢 {t("dash.live.note")}
      </p>
      <div className={fullscreen ? "" : "mt-0"}>
        {header}

        {/* Overview cards */}
        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <OverviewCard
            emoji="✍️"
            title={pick(FINAL_QUESTION.question)}
            value={`${expectationsCount}`}
            sub={t("dash.stats.total")}
          />
          <OverviewCard
            emoji="📏"
            title={lang === "ar" ? "متوسط طول الإجابات" : "Average answer length"}
            value={`${avgLen}`}
            sub={lang === "ar" ? "حرف" : "characters"}
          />
          <OverviewCard
            emoji="💬"
            title={lang === "ar" ? "آخر مشاركة" : "Most recent response"}
            value={responses.length ? lastTime(responses, lang) : "—"}
            sub={lang === "ar" ? "منذ" : "ago"}
          />
        </section>
      </div>

      {/* Charts */}
      <section className="mt-8">
        <h2 className="text-2xl font-extrabold text-slate-800">
          {lang === "ar" ? "📊 النتائج المجمعة" : "📊 Aggregate results"}
        </h2>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {SURVEY_QUESTIONS.map((q) => (
            <QuestionChart key={q.key} question={q} rows={responses} />
          ))}
        </div>
      </section>

      {/* Individual responses + expectations */}
      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800">🧾 {t("dash.responses.title")}</h2>
            <p className="text-sm font-semibold text-slate-500">
              {filtered.length} / {totalCount} — {t("dash.responses.search")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(["full", "expectations"] as ViewMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setViewMode(m)}
                aria-pressed={viewMode === m}
                className={`rounded-full px-4 py-2 text-sm font-extrabold transition-all ${
                  viewMode === m
                    ? "bg-gradient-to-r from-pink-500 to-violet-500 text-white shadow"
                    : "bg-white/80 text-slate-600 hover:bg-white"
                }`}
              >
                {m === "full"
                  ? lang === "ar"
                    ? "كل التفاصيل"
                    : "Full answers"
                  : lang === "ar"
                    ? "التوقعات فقط"
                    : "Expectations only"}
              </button>
            ))}
            <button
              type="button"
              onClick={handleExport}
              disabled={filtered.length === 0}
              className="btn-base btn-primary !rounded-full !px-4 !py-2 !text-sm"
            >
              📥 {t("dash.export")}
            </button>
          </div>
        </div>

        {/* controls */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">{t("dash.responses.search")}</span>
            <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-slate-400">🔍</span>
            <input
              type="search"
              className="field pe-4 ps-10"
              placeholder={t("dash.responses.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="sm:w-72">
            <span className="sr-only">{t("dash.responses.filter")}</span>
            <select
              className="field"
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
            >
              <option value="all">{t("dash.responses.all")}</option>
              {filterOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* body */}
        <div className="mt-6">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="animate-spin h-10 w-10 rounded-full border-4 border-violet-300 border-t-violet-600" />
              <p className="font-bold text-violet-500">{t("dash.loading")}</p>
            </div>
          )}

          {!loading && error && mode === "supabase" && (
            <div className="mx-auto max-w-md rounded-3xl bg-rose-50 p-8 text-center ring-2 ring-rose-200">
              <p className="text-4xl">😵</p>
              <p className="mt-3 font-bold text-rose-600">{t("dash.error")}</p>
              <p className="mt-1 text-xs text-rose-400">{error}</p>
              <button type="button" onClick={() => void refresh()} className="btn-base btn-secondary mt-4">
                🔄 {t("wall.retry")}
              </button>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-14 text-center">
              <Robot mood="wave" size={110} />
              <p className="max-w-md text-lg font-bold text-violet-600">{t("dash.empty")}</p>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && viewMode === "full" && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((row) => (
                <ResponseCard key={row.id} submission={row} />
              ))}
            </div>
          )}

          {!loading && !error && filtered.length > 0 && viewMode === "expectations" && (
            <ul className="flex flex-col gap-3">
              {filtered.map((row) => (
                <li key={row.id} className="glass-card rounded-3xl p-5">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-extrabold text-slate-400">
                    <span className="rounded-full bg-teal-50 px-2.5 py-1 text-teal-700 ring-1 ring-teal-200">
                      {row.nickname?.trim() || (lang === "ar" ? "بدون اسم" : "Anonymous")}
                    </span>
                    <span>{formatTimestampShort(row.created_at, lang)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-slate-700" dir="auto">
                    {row.ai_track_expectations}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */

function Stat({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="rounded-2xl bg-white/70 p-3 text-center ring-1 ring-violet-100">
      <div className="text-xl" aria-hidden="true">{label}</div>
      <div className="text-2xl font-extrabold text-slate-800">{value}</div>
      <div className="text-[0.7rem] font-bold text-slate-400">{sub}</div>
    </div>
  );
}

function OverviewCard({ emoji, title, value, sub }: { emoji: string; title: string; value: string | number; sub: string }) {
  return (
    <div className="glass-card flex items-center gap-4 rounded-3xl p-5">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-100 to-violet-100 text-3xl" aria-hidden="true">
        {emoji}
      </span>
      <div className="min-w-0">
        <div className="truncate text-sm font-extrabold text-slate-600">{title}</div>
        <div className="text-2xl font-extrabold text-slate-800">{value}</div>
        <div className="text-xs font-bold text-slate-400">{sub}</div>
      </div>
    </div>
  );
}

function totalsLive(n: number): string {
  return n > 0 ? "ON" : "·";
}

function lastTime(rows: SurveySubmission[], lang: "en" | "ar"): string {
  const latest = rows.reduce((a, b) => (a.created_at > b.created_at ? a : b));
  const d = new Date(latest.created_at);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.max(1, Math.round(diffMs / 60000));
  if (mins < 60) return lang === "ar" ? `${mins} د` : `${mins}m`;
  const hours = Math.round(mins / 60);
  return lang === "ar" ? `${hours} س` : `${hours}h`;
}

function formatTimestampShort(iso: string, lang: "en" | "ar"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(lang === "ar" ? "ar-EG" : "en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}