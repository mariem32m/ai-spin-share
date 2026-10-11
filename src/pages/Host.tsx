import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Shell, ModeNotice } from "../components/Layout";
import { Robot } from "../components/Robot";
import { ChallengeCard } from "../components/ChallengeCard";
import { useLang } from "../lib/i18n";
import { useSubmissions } from "../hooks/useSubmissions";
import { HOST_HASH, studentJoinUrl } from "../lib/supabase";
import { store } from "../lib/store";
import type { ModerationStatus, Submission } from "../lib/types";

const AUTH_KEY = "aispinshare:host:auth";

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function Host() {
  const { t } = useLang();
  const { submissions, loading, error, refresh, participantCount, session } = useSubmissions();

  const moderationConfigured = Boolean(HOST_HASH);
  const [authed, setAuthed] = useState(() => {
    try {
      return sessionStorage.getItem(AUTH_KEY) === "1";
    } catch {
      return false;
    }
  });
  const canModerate = moderationConfigured && authed;

  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<Submission | null>(null);
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [allowRepeat, setAllowRepeat] = useState(true);
  const [regUrl, setRegUrl] = useState("");
  const [configSaved, setConfigSaved] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  /** Host-only full submission list (includes hidden ones). */
  const [hostSubs, setHostSubs] = useState<Submission[]>([]);

  // Load session config when the session resolves.
  useEffect(() => {
    if (!session) return;
    setAllowRepeat(session.allow_repeat_participation);
    setRegUrl(session.registration_url ?? "");
  }, [session]);

  const joinUrl = studentJoinUrl();

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  // Moderation list (all statuses) through the privileged host action.
  useEffect(() => {
    if (!canModerate || !session) return;
    let cancelled = false;
    store
      .hostList(session.id)
      .then((list) => {
        if (!cancelled) setHostSubs(list);
      })
      .catch((e) => {
        if (!cancelled) showToast(e instanceof Error ? e.message : "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, [canModerate, session, showToast]);

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

  const handleLogout = useCallback(() => {
    try {
      sessionStorage.removeItem(AUTH_KEY);
    } catch {
      /* ignore */
    }
    setAuthed(false);
    setHighlighted(null);
  }, []);

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

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t("host.join.link"), joinUrl);
    }
  }, [joinUrl, t]);

  const setModeration = useCallback(
    async (sub: Submission, status: ModerationStatus) => {
      setBusyId(sub.id);
      try {
        await store.setModeration(sub.id, status);
        setHostSubs((prev) => prev.map((s) => (s.id === sub.id ? { ...s, moderation_status: status } : s)));
      } catch (e) {
        showToast(e instanceof Error ? e.message : t("error.submit"));
      } finally {
        setBusyId(null);
      }
    },
    [showToast, t],
  );

  const handleReset = useCallback(async () => {
    if (!window.confirm(t("host.reset.confirm"))) return;
    try {
      await store.resetSession();
      window.location.reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Reset failed");
    }
  }, [showToast, t]);

  const handleDelete = useCallback(async () => {
    const input = window.prompt(t("host.delete.confirm"));
    if (input !== "DELETE") return;
    try {
      await store.deleteSessionData(session?.id ?? "");
      window.location.reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Delete failed");
    }
  }, [session, showToast, t]);

  const handleSaveConfig = useCallback(async () => {
    setConfigError(null);
    try {
      await store.updateConfig({ allow_repeat_participation: allowRepeat, registration_url: regUrl.trim() || null });
      setConfigSaved(true);
      window.setTimeout(() => setConfigSaved(false), 2500);
      showToast(t("host.config.saved"));
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "Save failed");
    }
  }, [allowRepeat, regUrl, showToast, t]);

  /* ---------- login gate ---------- */
  if (moderationConfigured && !authed) {
    return (
      <Shell>
        <ModeNotice />
        <div className="mx-auto max-w-md pt-8">
          <div className="glass-card rounded-[2rem] p-8 text-center">
            <div className="flex justify-center">
              <Robot mood="idle" size={100} />
            </div>
            <h1 className="text-gradient mt-4 text-2xl font-extrabold">🔐 {t("host.login.title")}</h1>
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
            </form>
            <p className="mt-4 text-xs font-semibold text-slate-400">🔒 {t("host.login.hint")}</p>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <ModeNotice />

      {!moderationConfigured && (
        <p className="mx-auto mb-4 max-w-3xl rounded-2xl bg-sky-50 px-4 py-2 text-center text-sm font-bold text-sky-700 ring-2 ring-sky-200">
          ℹ️ {t("host.demo.note")}
        </p>
      )}

      {/* ---------- Presentation header + QR ---------- */}
      <section className="grid gap-6 lg:grid-cols-[1fr_auto]">
        <div className="glass-card rounded-[2rem] p-6">
          <div className="flex items-center gap-4">
            <Robot mood="happy" size={72} />
            <div>
              <div className="text-xs font-extrabold tracking-wide text-violet-500">{t("community.name")}</div>
              <h1 className="text-3xl font-extrabold text-gradient">{t("app.title.alt")}</h1>
              <p className="text-base font-bold text-slate-600">{t("tagline")}</p>
            </div>
          </div>

          {/* highlight an answer for the projector */}
          {highlighted && (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-extrabold tracking-wide text-slate-500">📺 {t("host.highlighting")}</h2>
                <button type="button" onClick={() => setHighlighted(null)} className="btn-base btn-ghost-soft !px-3 !py-1 text-xs">
                  ✕ {t("host.clear.screen")}
                </button>
              </div>
              <ChallengeCard submission={highlighted} large />
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="💡" value={String(submissions.filter((s) => s.moderation_status === "visible").length)} sub={t("host.subs.count")} />
            <Stat label="👥" value={String(participantCount)} sub={t("host.participant.count")} />
            <Stat label="🟢" value={submissions.filter((s) => s.moderation_status === "visible").length} sub={t("wall.ideas")} />
            <Stat label="📡" value={loading ? "…" : error ? "⚠️" : "ON"} sub={t("wall.live")} />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={() => window.open("/wall", "_blank")} className="btn-base btn-spin">
              🧩 {t("host.open.wall")}
            </button>
            <button type="button" onClick={toggleFullscreen} className="btn-base btn-secondary">
              {fullscreen ? "🚪 " : "🖥️ "} {fullscreen ? t("host.exit.present") : t("host.present")}
            </button>
            {!loading && error && (
              <button type="button" onClick={() => void refresh()} className="btn-base btn-ghost-soft">
                🔄 {t("wall.retry")}
              </button>
            )}
            {canModerate && (
              <button type="button" onClick={handleLogout} className="btn-base btn-ghost-soft">
                🔒 {t("host.logout")}
              </button>
            )}
          </div>
        </div>

        {/* QR join panel */}
        <aside className="glass-card flex flex-col items-center rounded-[2rem] p-6 text-center">
          <h2 className="text-sm font-extrabold tracking-wide text-slate-500">📱 {t("host.scan")}</h2>
          <div className="my-4 rounded-3xl bg-white p-4 shadow-inner ring-4 ring-violet-100">
            <QRCodeSVG value={joinUrl} size={190} level="M" marginSize={0} fgColor="#312e81" bgColor="#ffffff" />
          </div>
          <p className="text-xs font-bold text-violet-500">{t("host.join.note")}</p>
          <div className="mt-3 w-full">
            <label htmlFor="join-link" className="sr-only">
              {t("host.join.link")}
            </label>
            <input id="join-link" readOnly className="field text-center text-xs" value={joinUrl} />
            <button type="button" onClick={() => void copyLink()} className="btn-base btn-secondary mt-2 w-full">
              {copied ? `✅ ${t("host.copied")}` : `📋 ${t("host.copy")}`}
            </button>
          </div>
        </aside>
      </section>

      {/* ---------- Moderation ---------- */}
      {canModerate && (
        <section className="glass-card mt-8 rounded-[2rem] p-6">
          <h2 className="text-xl font-extrabold text-slate-800">
            🛡️ {t("host.moderate.title")}
          </h2>

          {toast && <p className="mt-3 rounded-xl bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700">{toast}</p>}

          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={handleReset} className="btn-base btn-secondary">
              🔄 {t("host.reset")}
            </button>
            <button type="button" onClick={() => void handleDelete()} className="btn-base !bg-rose-500">
              🗑️ {t("host.delete")}
            </button>
          </div>

          {busyId && <p className="mt-3 text-sm font-bold text-violet-500">⏳ …</p>}

          {hostSubs.length === 0 ? (
            <p className="mt-6 text-center font-bold text-slate-400">{t("host.no.subs")}</p>
          ) : (
            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {hostSubs.map((sub) => (
                <li key={sub.id} className={`rounded-3xl p-4 ring-2 ${sub.moderation_status === "hidden" ? "bg-slate-100 ring-slate-200 opacity-70" : "bg-white ring-violet-100"}`}>
                  <ChallengeCard submission={sub} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === sub.id}
                      onClick={() => setHighlighted(sub)}
                      className={`btn-base !px-3 !py-1.5 text-xs ${highlighted?.id === sub.id ? "!bg-violet-500" : "btn-secondary"}`}
                    >
                      ⭐ {t("host.highlight")}
                    </button>
                    {sub.moderation_status === "visible" ? (
                      <button
                        type="button"
                        disabled={busyId === sub.id}
                        onClick={() => void setModeration(sub, "hidden")}
                        className="btn-base !bg-amber-400 !px-3 !py-1.5 text-xs !text-amber-900"
                      >
                        🙈 {t("host.hide")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId === sub.id}
                        onClick={() => void setModeration(sub, "visible")}
                        className="btn-base btn-secondary !px-3 !py-1.5 text-xs"
                      >
                        👀 {t("host.restore")}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ---------- Session configuration ---------- */}
      {canModerate && (
        <section className="glass-card mt-8 rounded-[2rem] p-6">
          <h2 className="text-xl font-extrabold text-slate-800">⚙️ {t("host.config.title")}</h2>

          <div className="mt-5 flex flex-col gap-5">
            <label className="flex items-center gap-3 text-base font-bold text-slate-700">
              <input
                type="checkbox"
                checked={allowRepeat}
                onChange={(e) => setAllowRepeat(e.target.checked)}
                className="h-5 w-5 accent-violet-600"
              />
              {t("host.config.repeat")}
            </label>

            <div>
              <label htmlFor="reg-url" className="mb-1 block text-sm font-extrabold text-slate-600">
                🔗 {t("host.config.regurl")}
              </label>
              <input id="reg-url" type="url" className="field" value={regUrl} dir="ltr" onChange={(e) => setRegUrl(e.target.value)} placeholder="https://…" />
            </div>

            {configError && <p className="rounded-xl bg-rose-50 px-4 py-2 text-sm font-bold text-rose-600">{configError}</p>}

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => void handleSaveConfig()} className="btn-base btn-primary">
                💾 {t("host.config.save")}
              </button>
              {configSaved && <span className="font-bold text-emerald-600">✅ {t("host.config.saved")}</span>}
            </div>
          </div>
        </section>
      )}
    </Shell>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="rounded-2xl bg-white/70 p-3 text-center ring-1 ring-violet-100">
      <div className="text-xl" aria-hidden="true">
        {label}
      </div>
      <div className="text-2xl font-extrabold text-slate-800">{value}</div>
      <div className="text-[0.7rem] font-bold text-slate-400">{sub}</div>
    </div>
  );
}