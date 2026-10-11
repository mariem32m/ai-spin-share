import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Shell, ModeNotice } from "../components/Layout";
import { Robot } from "../components/Robot";
import { Wheel } from "../components/Wheel";
import type { WheelHandle } from "../components/Wheel";
import { ChallengeCard } from "../components/ChallengeCard";
import { challengeByType } from "../lib/challenges";
import type { Challenge } from "../lib/challenges";
import type { ChallengeType } from "../lib/types";
import { useLang } from "../lib/i18n";
import { resolveSession, store, validateSubmission } from "../lib/store";
import type { Submission } from "../lib/types";
import { celebrateConfetti } from "../lib/confetti";

type Stage = "spin" | "challenge" | "form" | "success" | "finish" | "already";

interface Draft {
  type: ChallengeType | null;
  name: string;
  answer: string;
}

const DRAFT_KEY = "aispinshare:draft:v1";

function loadDraft(): Draft {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Draft>;
      return { type: parsed.type ?? null, name: parsed.name ?? "", answer: parsed.answer ?? "" };
    }
  } catch {
    /* ignore */
  }
  return { type: null, name: "", answer: "" };
}

function saveDraft(d: Draft): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

function clearDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

function participatedKey(sessionId: string): string {
  return `aispinshare:participated:${sessionId}`;
}

function hasParticipated(sessionId: string): boolean {
  try {
    return localStorage.getItem(participatedKey(sessionId)) === "1";
  } catch {
    return false;
  }
}

function markParticipated(sessionId: string): void {
  try {
    localStorage.setItem(participatedKey(sessionId), "1");
  } catch {
    /* ignore */
  }
}

export function Play() {
  const { t, pick } = useLang();
  const wheelRef = useRef<WheelHandle>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [allowRepeat, setAllowRepeat] = useState(true);
  const [stage, setStage] = useState<Stage>("spin");
  const [spinning, setSpinning] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [name, setName] = useState("");
  const [answer, setAnswer] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<Submission | null>(null);

  // Resolve the active session once.
  useEffect(() => {
    let cancelled = false;
    resolveSession()
      .then((info) => {
        if (cancelled) return;
        setSessionId(info.session.id);
        setAllowRepeat(info.session.allow_repeat_participation);
      })
      .catch(() => {
        if (!cancelled) setSessionId(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Restore a draft after a refresh mid-game (don't lose student work).
  useEffect(() => {
    const draft = loadDraft();
    if (draft.type) {
      const picked = challengeByType(draft.type);
      setChallenge(picked);
      setName(draft.name);
      setAnswer(draft.answer);
      setStage("form");
    }
  }, []);

  const persistDraft = useCallback((next: Draft) => saveDraft(next), []);

  const startSpin = useCallback(async () => {
    const handle = wheelRef.current;
    if (!handle || handle.isSpinning() || spinning) return;
    setSpinning(true);
    try {
      const type = await handle.spin();
      const picked = challengeByType(type);
      setChallenge(picked);
      setFormError(null);
      setName("");
      setAnswer("");
      persistDraft({ type, name: "", answer: "" });
      setStage("challenge");
    } finally {
      setSpinning(false);
    }
  }, [spinning, persistDraft]);

  const handleSubmit = useCallback(async () => {
    if (!challenge || !sessionId || submitting) return;
    const validation = validateSubmission({ student_name: name, answer, challenge_type: challenge.type });
    if (!validation.ok) {
      const msg =
        validation.error === "name_empty"
          ? t("req.name")
          : validation.error === "name_long"
            ? t("len.name")
            : validation.error === "answer_empty"
              ? t("req.answer")
              : validation.error === "answer_long"
                ? t("len.answer")
                : t("req.answer");
      setFormError(msg);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const record = await store.submit({
        session_id: sessionId,
        student_name: name,
        challenge_type: challenge.type,
        answer,
      });
      setSubmitted(record);
      markParticipated(sessionId);
      clearDraft();
      celebrateConfetti();
      setStage("success");
    } catch (e) {
      // Keep the student's text so they can retry — never fake success.
      setFormError(t("error.submit"));
      void e;
    } finally {
      setSubmitting(false);
    }
  }, [challenge, sessionId, name, answer, submitting, t]);

  const playAgain = useCallback(() => {
    if (sessionId && !allowRepeat && hasParticipated(sessionId)) {
      setStage("already");
      return;
    }
    clearDraft();
    setChallenge(null);
    setName("");
    setAnswer("");
    setSubmitted(null);
    setFormError(null);
    setStage("spin");
  }, [sessionId, allowRepeat]);

  const registrationUrl = useMemo(() => {
    const env = (import.meta.env.VITE_REGISTRATION_URL as string | undefined) ?? "";
    return env;
  }, []);

  return (
    <Shell>
      <ModeNotice />

      {/* ---------- SPIN STAGE ---------- */}
      {stage === "spin" && (
        <section className="animate-fade-up mx-auto flex max-w-2xl flex-col items-center gap-4">
          <div className="text-center">
            <h1 className="text-3xl font-extrabold sm:text-4xl">
              <span className="text-gradient">{t("headline")}</span>
            </h1>
            <p className="mt-2 text-lg font-semibold text-slate-600">{t("tagline")}</p>
          </div>

          <div className="relative mt-2 w-full max-w-md">
            <Wheel ref={wheelRef} />
          </div>

          <div className="flex flex-col items-center gap-2">
            <button type="button" onClick={() => void startSpin()} disabled={spinning} className="btn-base btn-spin">
              {spinning ? "🎲 …" : `🎡 ${t("spin.button")}`}
            </button>
            <p className="text-sm font-bold text-violet-500">{t("spin.hint")}</p>
            <Robot mood="wave" size={86} />
          </div>
        </section>
      )}

      {/* ---------- CHALLENGE MODAL ---------- */}
      {stage === "challenge" && challenge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm">
          <div className="card-pop max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[2rem] border-8 bg-white p-8 text-center shadow-2xl" style={{ borderColor: challenge.color }}>
            <div className="mx-auto flex justify-center">
              <Robot mood="excited" size={110} />
            </div>
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl text-5xl" style={{ backgroundColor: challenge.light }}>
              {challenge.emoji}
            </div>
            <h2 className="mt-4 text-3xl font-extrabold" style={{ color: challenge.dark }}>
              {pick(challenge.title)}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-lg font-semibold leading-relaxed text-slate-700" dir="auto">
              {pick(challenge.question)}
            </p>
            <p className="mt-3 text-base font-bold text-violet-500">✨ {pick(challenge.encouragement)}</p>
            <button type="button" className="btn-base mt-7 w-full max-w-xs" style={{ background: challenge.color, color: challenge.dark }} onClick={() => setStage("form")}>
              {t("continue.button")} →
            </button>
          </div>
        </div>
      )}

      {/* ---------- FORM STAGE ---------- */}
      {stage === "form" && challenge && (
        <section className="animate-fade-up mx-auto max-w-xl">
          <div className="glass-card rounded-[2rem] p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl" style={{ backgroundColor: challenge.light }}>
                {challenge.emoji}
              </span>
              <div>
                <div className="text-xs font-extrabold tracking-wide text-slate-400">{t("form.challenge")}</div>
                <div className="text-lg font-extrabold" style={{ color: challenge.dark }}>
                  {pick(challenge.title)}
                </div>
              </div>
            </div>

            <p className="mt-4 rounded-2xl p-3 text-base font-semibold text-slate-700" style={{ backgroundColor: challenge.light }}>
              {pick(challenge.question)}
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSubmit();
              }}
              className="mt-6 flex flex-col gap-5"
              noValidate
            >
              <div>
                <label htmlFor="student-name" className="mb-1 block text-sm font-extrabold text-slate-600">
                  👤 {t("form.name.label")}
                </label>
                <input
                  id="student-name"
                  type="text"
                  className={`field ${formError === t("req.name") || formError === t("len.name") ? "is-invalid" : ""}`}
                  placeholder={t("form.name.placeholder")}
                  value={name}
                  maxLength={50}
                  autoComplete="off"
                  onChange={(e) => {
                    setName(e.target.value);
                    persistDraft({ type: challenge.type, name: e.target.value, answer });
                  }}
                  dir="auto"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label htmlFor="student-answer" className="block text-sm font-extrabold text-slate-600">
                    💬 {t("form.answer.label")}
                  </label>
                  <span className="text-xs font-bold text-slate-400">
                    {answer.length}/500 {t("form.characters")}
                  </span>
                </div>
                <textarea
                  id="student-answer"
                  className={`field min-h-32 resize-y ${formError === t("req.answer") || formError === t("len.answer") ? "is-invalid" : ""}`}
                  placeholder={t("form.answer.placeholder")}
                  value={answer}
                  maxLength={500}
                  rows={4}
                  onChange={(e) => {
                    setAnswer(e.target.value);
                    persistDraft({ type: challenge.type, name, answer: e.target.value });
                  }}
                  dir="auto"
                />
              </div>

              {formError && (
                <p role="alert" className="toast-invalid rounded-xl bg-rose-50 px-4 py-2 text-center text-sm font-bold text-rose-600">
                  ⚠️ {formError}
                </p>
              )}

              <button type="submit" disabled={submitting} className="btn-base btn-spin w-full !text-lg">
                {submitting ? `⏳ ${t("form.loading")}` : `🚀 ${t("form.submit")}`}
              </button>

              <p className="text-center text-xs font-semibold text-slate-400">ℹ️ {t("wall.discover")}</p>
            </form>
          </div>
        </section>
      )}

      {/* ---------- SUCCESS STAGE ---------- */}
      {stage === "success" && submitted && challenge && (
        <section className="animate-fade-up mx-auto max-w-xl">
          <div className="text-center">
            <div className="flex justify-center">
              <Robot mood="happy" size={130} />
            </div>
            <h2 className="text-gradient mt-4 text-3xl font-extrabold sm:text-4xl">🎉 {t("success.title")}</h2>
            <p className="mt-2 text-lg font-bold text-slate-600">
              {t("success.thanks")} <span className="text-violet-600">{submitted.student_name}</span>!
            </p>
          </div>

          <div className="mt-6">
            <h3 className="mb-2 text-center text-sm font-extrabold tracking-wide text-slate-500">{t("success.confirmation")}</h3>
            <ChallengeCard submission={submitted} />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link to="/wall" className="btn-base btn-spin">
              🧩 {t("success.wall")}
            </Link>
            <button type="button" onClick={playAgain} className="btn-base btn-secondary">
              🔄 {t("success.again")}
            </button>
            <button type="button" onClick={() => setStage("finish")} className="btn-base btn-ghost-soft">
              🏁 {t("success.finish")}
            </button>
          </div>
        </section>
      )}

      {/* ---------- ALREADY PARTICIPATED ---------- */}
      {stage === "already" && (
        <section className="animate-fade-up mx-auto max-w-xl text-center">
          <div className="flex justify-center">
            <Robot mood="sad" size={120} />
          </div>
          <h2 className="mt-4 text-2xl font-extrabold text-slate-800">🙅 {t("already.participated")}</h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/wall" className="btn-base btn-spin">
              🧩 {t("view.wall")}
            </Link>
            <Link to="/" className="btn-base btn-secondary">
              🏠 {t("back.home")}
            </Link>
          </div>
        </section>
      )}

      {/* ---------- FINISH / RECRUITMENT ---------- */}
      {stage === "finish" && <Recruitment registrationUrl={registrationUrl} onPlayAgain={playAgain} />}
    </Shell>
  );
}

/* =====================================================================
 * Recruitment (AI Track) screen — shown after finishing a game.
 * ===================================================================== */

interface RecruitmentProps {
  registrationUrl: string;
  onPlayAgain: () => void;
}

function Recruitment({ registrationUrl, onPlayAgain }: RecruitmentProps) {
  const { t } = useLang();

  return (
    <section className="animate-fade-up mx-auto max-w-3xl text-center">
      <div className="flex justify-center">
        <Robot mood="happy" size={140} />
      </div>
      <h2 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">
        <span className="text-gradient">🚀 {t("recruit.title")}</span>
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-lg font-medium leading-relaxed text-slate-600">{t("recruit.body")}</p>

      <div className="mt-4 flex justify-center gap-3 text-2xl">
        <span className="animate-twinkle">✨</span>
        <span className="animate-twinkle" style={{ animationDelay: "0.4s" }}>⭐</span>
        <span className="animate-twinkle" style={{ animationDelay: "0.8s" }}>🌟</span>
        <span className="animate-twinkle" style={{ animationDelay: "1.2s" }}>💫</span>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        {registrationUrl ? (
          <a href={registrationUrl} target="_blank" rel="noreferrer" className="btn-base btn-spin">
            🎓 {t("recruit.explore")}
          </a>
        ) : (
          <p className="rounded-2xl bg-amber-50 px-5 py-3 text-sm font-bold text-amber-700 ring-2 ring-amber-200">
            ⚠️ {t("recruit.no.link")}
          </p>
        )}
        <Link to="/wall" className="btn-base btn-secondary">
          🧩 {t("recruit.ideas")}
        </Link>
        <button type="button" onClick={onPlayAgain} className="btn-base btn-ghost-soft">
          🎡 {t("recruit.play")}
        </button>
      </div>
    </section>
  );
}