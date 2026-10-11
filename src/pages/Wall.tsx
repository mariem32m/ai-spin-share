import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Shell, ModeNotice, ModeBadge } from "../components/Layout";
import { ChallengeCard } from "../components/ChallengeCard";
import { Robot } from "../components/Robot";
import { CHALLENGES } from "../lib/challenges";
import type { ChallengeType } from "../lib/types";
import { useLang } from "../lib/i18n";
import { useSubmissions } from "../hooks/useSubmissions";

type Filter = "all" | ChallengeType;

export function Wall() {
  const { t, pick } = useLang();
  const { submissions, loading, error, refresh, participantCount } = useSubmissions();
  const [filter, setFilter] = useState<Filter>("all");

  const filters: { value: Filter; label: string; emoji?: string }[] = [
    { value: "all", label: t("wall.filter.all") },
    ...CHALLENGES.map((c) => ({ value: c.type, label: pick(c.title), emoji: c.emoji })),
  ];

  const visible = useMemo(() => submissions.filter((s) => s.moderation_status === "visible"), [submissions]);
  const shown = useMemo(() => (filter === "all" ? visible : visible.filter((s) => s.challenge_type === filter)), [visible, filter]);

  return (
    <Shell>
      <ModeNotice />

      <header className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 text-sm font-extrabold text-emerald-600">
          <span className="live-dot" /> {t("wall.live")}
        </div>
        <h1 className="text-gradient mt-2 text-4xl font-extrabold sm:text-5xl">🧩 {t("wall.title")}</h1>
        <p className="text-gradient-warm mt-2 text-xl font-extrabold">{t("wall.subtitle")}</p>
        <p className="mt-2 text-base font-semibold text-slate-600">{t("wall.discover")}</p>
      </header>

      {/* Stats */}
      <div className="mx-auto mt-6 flex max-w-lg flex-wrap items-center justify-center gap-3">
        <span className="rounded-full bg-white/80 px-5 py-2 text-sm font-extrabold text-violet-700 shadow-sm ring-1 ring-violet-200">
          💡 {visible.length} {t("wall.ideas")}
        </span>
        <span className="rounded-full bg-white/80 px-5 py-2 text-sm font-extrabold text-sky-700 shadow-sm ring-1 ring-sky-200">
          👥 {participantCount} {t("wall.participants")}
        </span>
        <ModeBadge />
      </div>

      {/* Filters */}
      <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-2" role="group" aria-label="Filter ideas">
        {filters.map((f) => {
          const active = filter === f.value;
          const accent = f.value === "all" ? {} : { backgroundColor: CHALLENGES.find((c) => c.type === f.value)?.light };
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              aria-pressed={active}
              className={`rounded-full px-4 py-2 text-sm font-extrabold transition-all focus-visible:outline focus-visible:outline-3 focus-visible:outline-amber-400 ${
                active ? "shadow-lg ring-2 ring-violet-400" : "bg-white/70 text-slate-600 hover:bg-white"
              }`}
              style={active ? accent : undefined}
            >
              {f.emoji ? `${f.emoji} ` : ""}
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="mx-auto mt-8 max-w-6xl">
        {loading && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="animate-spin h-10 w-10 rounded-full border-4 border-violet-300 border-t-violet-600" />
            <p className="font-bold text-violet-500">{t("wall.loading")}</p>
          </div>
        )}

        {!loading && error && (
          <div className="mx-auto max-w-md rounded-3xl bg-rose-50 p-8 text-center ring-2 ring-rose-200">
            <p className="text-4xl">😵</p>
            <p className="mt-3 font-bold text-rose-600">{t("wall.error")}</p>
            <p className="mt-1 text-xs text-rose-400">{error}</p>
            <button type="button" onClick={() => void refresh()} className="btn-base btn-secondary mt-4">
              🔄 {t("wall.retry")}
            </button>
          </div>
        )}

        {!loading && !error && shown.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-14 text-center">
            <Robot mood="wave" size={110} />
            <p className="max-w-md text-lg font-bold text-violet-600">{t("wall.empty")}</p>
            <Link to="/play" className="btn-base btn-spin">
              🎡 {t("start.playing")}
            </Link>
          </div>
        )}

        {!loading && !error && shown.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((submission) => (
              <ChallengeCard key={submission.id} submission={submission} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-12 text-center">
        <Link to="/play" className="btn-base btn-secondary">
          🎡 {t("wall.back")}
        </Link>
      </div>
    </Shell>
  );
}