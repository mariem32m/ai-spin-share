import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Shell, ModeNotice } from "../components/Layout";
import { Robot } from "../components/Robot";
import { useLang } from "../lib/i18n";
import { resolveSession, store, validateSurveySubmission } from "../lib/store";
import type { SurveyValidationError } from "../lib/store";
import {
  SURVEY_QUESTIONS,
  FINAL_QUESTION,
} from "../lib/questions";
import type { SurveyQuestion, SurveyQuestionKey } from "../lib/questions";
import { celebrateConfetti } from "../lib/confetti";

type SurveyStage = "questions" | "final" | "thanks" | "already";

interface Draft {
  stage: "questions" | "final";
  index: number;
  answers: Record<SurveyQuestionKey, string | string[]>;
  nickname: string;
  finalText: string;
}

const DRAFT_KEY = "aiyourseyes:draft:v1";

function emptyAnswers(): Record<SurveyQuestionKey, string | string[]> {
  return {
    question_1_answer: "",
    question_2_answer: "",
    question_3_answer: [],
    question_4_answer: "",
    question_5_answer: [],
  };
}

function loadDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Draft>;
    return {
      stage: parsed.stage === "final" ? "final" : "questions",
      index: typeof parsed.index === "number" ? parsed.index : 0,
      answers: { ...emptyAnswers(), ...(parsed.answers ?? {}) },
      nickname: parsed.nickname ?? "",
      finalText: parsed.finalText ?? "",
    };
  } catch {
    return null;
  }
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
  return `aiyourseyes:participated:${sessionId}`;
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

/* ------------------------------------------------------------------
 * Localized error hint for a validation failure.
 * ------------------------------------------------------------------ */
function errorMessage(t: (k: string) => string, err: SurveyValidationError): string {
  switch (err) {
    case "missing_answer":
      return t("survey.req.answer");
    case "expectations_empty":
      return t("survey.req.expectations");
    case "expectations_long":
      return t("survey.req.expectations.long");
    case "nickname_long":
      return t("survey.req.nickname.long");
    default:
      return t("survey.req.answer");
  }
}

export function Survey() {
  const { t, pick, dir } = useLang();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [stage, setStage] = useState<SurveyStage>("questions");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<SurveyQuestionKey, string | string[]>>(emptyAnswers);
  const [nickname, setNickname] = useState("");
  const [finalText, setFinalText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const questionRef = useRef<HTMLDivElement | null>(null);

  const currentQuestion = SURVEY_QUESTIONS[Math.min(index, SURVEY_QUESTIONS.length - 1)];

  // Resolve session + restore any in-progress draft.
  useEffect(() => {
    let cancelled = false;
    resolveSession()
      .then((info) => {
        if (cancelled) return;
        setSessionId(info.session.id);
        if (hasParticipated(info.session.id)) {
          setStage("already");
          return;
        }
        const draft = loadDraft();
        if (draft) {
          setStage(draft.stage);
          setIndex(draft.index);
          setAnswers(draft.answers);
          setNickname(draft.nickname);
          setFinalText(draft.finalText);
        }
      })
      .catch(() => {
        /* session unavailable — the survey still renders, submission will show an error */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(
    (next: {
      index?: number;
      answers?: Record<SurveyQuestionKey, string | string[]>;
      nickname?: string;
      finalText?: string;
      stage?: SurveyStage;
    }) => {
      const targetStage = next.stage ?? stage;
      saveDraft({
        stage: targetStage === "final" ? "final" : "questions",
        index: next.index ?? index,
        answers: next.answers ?? answers,
        nickname: next.nickname ?? nickname,
        finalText: next.finalText ?? finalText,
      });
    },
    [stage, index, answers, nickname, finalText],
  );

  // Keep focus + scroll near the top of the card when the question changes.
  useEffect(() => {
    if (stage === "questions") {
      questionRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [index, stage]);

  const selectedCount = (key: SurveyQuestionKey) => {
    const v = answers[key];
    return Array.isArray(v) ? v.length : v ? 1 : 0;
  };

  const questionAnswered = (key: SurveyQuestionKey): boolean => selectedCount(key) > 0;

  const toggleOption = useCallback(
    (q: SurveyQuestion, optionId: string) => {
      setAnswers((prev) => {
        const next = { ...prev } as Record<SurveyQuestionKey, string | string[]>;
        if (q.multiSelect) {
          const arr = Array.isArray(prev[q.key]) ? (prev[q.key] as string[]) : [];
          next[q.key] = arr.includes(optionId) ? arr.filter((id) => id !== optionId) : [...arr, optionId];
        } else {
          next[q.key] = prev[q.key] === optionId ? "" : optionId;
        }
        return next;
      });
      setFormError(null);
    },
    [],
  );

  const goNext = useCallback(() => {
    const q = SURVEY_QUESTIONS[index];
    const currentValue = answers[q.key];
    const answered = Array.isArray(currentValue) ? currentValue.length > 0 : Boolean(currentValue);
    if (!answered) {
      setFormError(t("survey.req.answer"));
      return;
    }
    setFormError(null);
    if (index < SURVEY_QUESTIONS.length - 1) {
      const nextIndex = index + 1;
      setIndex(nextIndex);
      persist({ index: nextIndex, answers });
    } else {
      setStage("final");
      persist({ index, answers, stage: "final" });
    }
  }, [index, answers, persist, t]);

  const goBack = useCallback(() => {
    setFormError(null);
    if (index === 0) {
      // First question — Back returns to the welcome screen.
      window.history.back();
      return;
    }
    const prevIndex = index - 1;
    setIndex(prevIndex);
    persist({ index: prevIndex, answers });
  }, [index, answers, persist]);

  const handleSubmit = useCallback(async () => {
    if (!sessionId || submitting) return;
    const validation = validateSurveySubmission({ answers, nickname, ai_track_expectations: finalText });
    if (!validation.ok) {
      setFormError(errorMessage(t, validation.error));
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await store.submitSurvey({
        session_id: sessionId,
        nickname,
        answers,
        ai_track_expectations: finalText,
      });
      markParticipated(sessionId);
      clearDraft();
      celebrateConfetti();
      setStage("thanks");
    } catch (e) {
      setFormError(t("survey.error.submit"));
      void e;
    } finally {
      setSubmitting(false);
    }
  }, [sessionId, submitting, answers, nickname, finalText, t]);

  const total = SURVEY_QUESTIONS.length;

  /* ---------- Already participated ---------- */
  if (stage === "already") {
    return (
      <Shell>
        <ModeNotice />
        <section className="animate-fade-up mx-auto max-w-xl py-8 text-center">
          <div className="flex justify-center">
            <Robot mood="happy" size={130} />
          </div>
          <h2 className="text-gradient mt-4 text-3xl font-extrabold sm:text-4xl">🙏 {t("survey.already.title")}</h2>
          <p className="mx-auto mt-3 max-w-md text-lg font-semibold text-slate-600">{t("survey.already.body")}</p>
          <div className="mt-8 flex justify-center">
            <Link to="/" className="btn-base btn-secondary">
              🏠 {t("survey.home")}
            </Link>
          </div>
        </section>
      </Shell>
    );
  }

  /* ---------- Thank you ---------- */
  if (stage === "thanks") {
    return (
      <Shell>
        <ModeNotice />
        <section className="animate-fade-up mx-auto max-w-2xl py-8 text-center">
          <div className="flex justify-center">
            <Robot mood="happy" size={150} />
          </div>
          <h2 className="text-gradient mt-5 text-3xl font-extrabold leading-tight sm:text-4xl">🎉 {t("survey.thank.title")}</h2>
          <p className="mx-auto mt-4 max-w-lg text-lg font-semibold leading-relaxed text-slate-600">{t("survey.thank.body")}</p>
          <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 ring-2 ring-emerald-200">
            {t("survey.thank.confirmed")}
          </p>
          <div className="mt-4 flex justify-center gap-3 text-2xl">
            <span className="animate-twinkle">✨</span>
            <span className="animate-twinkle" style={{ animationDelay: "0.4s" }}>⭐</span>
            <span className="animate-twinkle" style={{ animationDelay: "0.8s" }}>🌟</span>
            <span className="animate-twinkle" style={{ animationDelay: "1.2s" }}>💫</span>
          </div>
          <div className="mt-9 flex justify-center">
            <Link to="/" className="btn-base btn-spin">
              🏠 {t("survey.home")}
            </Link>
          </div>
        </section>
      </Shell>
    );
  }

  /* ---------- Final question ---------- */
  if (stage === "final") {
    return (
      <Shell>
        <ModeNotice />
        <section className="animate-fade-up mx-auto max-w-xl py-6">
          <div className="mb-6 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-4 py-1.5 text-sm font-extrabold text-teal-700 ring-2 ring-teal-200">
              {FINAL_QUESTION.emoji} {t("survey.final.step")}
            </span>
            <h2
              className="text-gradient mt-4 text-3xl font-extrabold leading-tight sm:text-4xl"
              style={{ backgroundImage: `linear-gradient(120deg, #0d9488, #0ea5e9 60%, #8b5cf6)` }}
            >
              {pick(FINAL_QUESTION.title)}
            </h2>
          </div>

          <div
            className="glass-card rounded-[2rem] p-6 sm:p-8"
            style={{ border: `4px solid ${FINAL_QUESTION.color}` }}
          >
            <div className="text-center">
              <div className="flex justify-center">
                <Robot mood="excited" size={100} />
              </div>
              <h3 className="mt-3 text-xl font-extrabold text-slate-800">{pick(FINAL_QUESTION.question)}</h3>
              <p className="mt-2 text-base font-medium text-slate-600" dir="auto">
                {pick(FINAL_QUESTION.supportingText)}
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSubmit();
              }}
              className="mt-6 flex flex-col gap-5"
              noValidate
            >
              {/* Optional nickname */}
              <div>
                <label htmlFor="survey-nickname" className="mb-1 block text-sm font-extrabold text-slate-600">
                  👤 {t("survey.nickname.label")}
                </label>
                <input
                  id="survey-nickname"
                  type="text"
                  className="field"
                  placeholder={t("survey.nickname.placeholder")}
                  value={nickname}
                  maxLength={50}
                  autoComplete="nickname"
                  onChange={(e) => {
                    setNickname(e.target.value);
                    persist({ nickname: e.target.value });
                  }}
                  dir="auto"
                />
              </div>

              {/* Expectations */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label htmlFor="survey-expectations" className="block text-sm font-extrabold text-slate-600">
                    💬 {t("survey.expectations.label")}
                  </label>
                  <span className={`text-xs font-bold ${finalText.length > FINAL_QUESTION.maxLength ? "text-rose-500" : "text-slate-400"}`}>
                    {finalText.length}/{FINAL_QUESTION.maxLength}
                  </span>
                </div>
                <textarea
                  id="survey-expectations"
                  className="field min-h-40 resize-y"
                  placeholder={pick(FINAL_QUESTION.placeholder)}
                  value={finalText}
                  maxLength={FINAL_QUESTION.maxLength}
                  rows={5}
                  onChange={(e) => {
                    setFinalText(e.target.value);
                    persist({ finalText: e.target.value });
                  }}
                  dir="auto"
                />
                <p className="mt-2 text-xs font-semibold text-slate-400">🔒 {t("survey.privacy.note")}</p>
              </div>

              {formError && (
                <p role="alert" className="toast-invalid rounded-xl bg-rose-50 px-4 py-2 text-center text-sm font-bold text-rose-600">
                  ⚠️ {formError}
                </p>
              )}

              <button type="submit" data-testid="submit" disabled={submitting || finalText.trim().length === 0} className="btn-base btn-spin w-full !text-lg">
                {submitting ? `⏳ ${t("survey.submitting")}` : `🚀 ${t("survey.submit")}`}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStage("questions");
                  persist({ index: SURVEY_QUESTIONS.length - 1, answers, stage: "questions" });
                }}
                className="btn-base btn-ghost-soft"
              >
                ← {t("survey.back")}
              </button>
            </form>
          </div>
        </section>
      </Shell>
    );
  }

  /* ---------- Multiple-choice questions ---------- */
  const q = currentQuestion;
  const max = total;
  const current = index + 1;
  const answered = questionAnswered(q.key);

  return (
    <Shell>
      <ModeNotice />
      <section className="mx-auto max-w-2xl py-4" dir={dir}>
        {/* Progress header */}
        <div className="mb-4 text-center">
          <div className="flex items-center justify-between text-sm font-extrabold">
            <span className="rounded-full bg-violet-50 px-4 py-1.5 text-violet-700 ring-2 ring-violet-200">
              {t("survey.progress.question")} {current} {t("survey.progress.of")} {max}
            </span>
            <span className="rounded-full bg-white/80 px-4 py-1.5 font-bold text-slate-500">{Math.round((current / max) * 100)}%</span>
          </div>
          <div
            className="mx-auto mt-3 h-3 w-full overflow-hidden rounded-full bg-white/80 shadow-inner ring-1 ring-violet-100"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={max}
            aria-valuenow={current}
            aria-label={`${t("survey.progress.question")} ${current} ${t("survey.progress.of")} ${max}`}
          >
            <div
              className="progress-fill h-full rounded-full transition-all duration-500"
              style={{ width: `${(current / max) * 100}%` }}
            />
          </div>
        </div>

        <div
          ref={questionRef}
          key={q.key}
          className="glass-card card-pop rounded-[2rem] p-6 sm:p-8"
          style={{ border: `4px solid ${q.light}` }}
        >
          <div className="flex items-start gap-3" dir="auto">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl" style={{ backgroundColor: q.light }} aria-hidden="true">
              {q.emoji}
            </span>
            <div>
              <div className="text-xs font-extrabold tracking-wide text-slate-400">
                {q.multiSelect ? t("survey.select.many") : t("survey.select.one")}
              </div>
              <h1 className="mt-1 text-xl font-extrabold leading-snug text-slate-800 sm:text-2xl" dir="auto">
                {pick(q.question)}
              </h1>
            </div>
          </div>

          <div role={q.multiSelect ? "group" : "radiogroup"} aria-label={pick(q.question)} className="mt-6 flex flex-col gap-3">
            {q.options.map((option) => {
              const sel = Array.isArray(answers[q.key])
                ? (answers[q.key] as string[]).includes(option.id)
                : answers[q.key] === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role={q.multiSelect ? "checkbox" : "radio"}
                  aria-checked={sel}
                  data-option-id={option.id}
                  onClick={() => toggleOption(q, option.id)}
                  className={`quiz-option ${sel ? "quiz-option--selected" : ""}`}
                  style={sel ? { backgroundColor: q.light, borderColor: q.color, boxShadow: `0 10px 24px -12px ${q.color}88` } : undefined}
                >
                  <span className="quiz-option-check" style={sel ? { backgroundColor: q.color, borderColor: q.color } : undefined} aria-hidden="true">
                    {sel ? (q.multiSelect ? "✓" : "✓") : ""}
                  </span>
                  <span className="text-start font-bold text-slate-700" dir="auto">
                    {pick(option)}
                  </span>
                </button>
              );
            })}
          </div>

          {formError && (
            <p role="alert" className="toast-invalid mt-5 rounded-xl bg-rose-50 px-4 py-2 text-center text-sm font-bold text-rose-600">
              ⚠️ {formError}
            </p>
          )}

          <div className="mt-7 flex items-center justify-between gap-3">
            {index === 0 ? (
              <Link to="/" className="btn-base btn-ghost-soft" data-testid="back">
                ← {t("survey.back")}
              </Link>
            ) : (
              <button type="button" onClick={goBack} data-testid="back" className="btn-base btn-ghost-soft">
                ← {t("survey.back")}
              </button>
            )}
            <span className="text-xs font-bold text-slate-400" aria-live="polite">
              {answered ? `✅ ${selectedCount(q.key)}` : ""}
            </span>
            <button type="button" onClick={goNext} data-testid="next" className="btn-base btn-spin !px-8">
              {t("survey.next")} →
            </button>
          </div>
        </div>
      </section>
    </Shell>
  );
}