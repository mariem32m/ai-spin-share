import type { SurveySubmission } from "../lib/types";
import { SURVEY_QUESTIONS, FINAL_QUESTION, optionById } from "../lib/questions";
import { formatTimestamp } from "../lib/store";
import { useLang } from "../lib/i18n";

interface Props {
  submission: SurveySubmission;
  /** Big presentation variant. */
  large?: boolean;
}

/** One individual survey response, as shown in the organizer dashboard. */
export function ResponseCard({ submission, large = false }: Props) {
  const { lang, pick } = useLang();

  return (
    <article
      className={`card-pop rounded-3xl border-4 border-violet-100 bg-white p-5 shadow-xl ${
        large ? "p-8 sm:p-10" : ""
      }`}
      style={{ boxShadow: `0 16px 40px -18px #8b5cf666` }}
    >
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-2xl" aria-hidden="true">
          👤
        </span>
        <div>
          <div className="text-base font-extrabold text-slate-800" dir="auto">
            {submission.nickname?.trim() || (lang === "ar" ? "بدون اسم" : "Anonymous")}
          </div>
          <div className="text-xs font-bold text-slate-400">
            {formatTimestamp(submission.created_at, lang)}
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-2.5">
        {SURVEY_QUESTIONS.map((q) => {
          const value = submission[q.key];
          const selected = Array.isArray(value) ? value : [value];
          return (
            <div key={q.key} className="flex items-start gap-2 rounded-2xl px-3 py-2" style={{ backgroundColor: q.light }}>
              <span className="mt-0.5 shrink-0 text-lg" aria-hidden="true">{q.emoji}</span>
              <span className="min-w-0 text-sm font-bold text-slate-700">
                {selected.map((id) => pick(optionById(q, id))).join(" · ")}
              </span>
            </div>
          );
        })}

        <div className="mt-1 rounded-2xl bg-teal-50 px-3 py-3 ring-1 ring-teal-100">
          <div className="mb-1 flex items-center gap-2 text-xs font-extrabold tracking-wide text-teal-600">
            <span>{FINAL_QUESTION.emoji}</span> {pick(FINAL_QUESTION.question)}
          </div>
          <p className="whitespace-pre-wrap text-slate-700" dir="auto">
            {submission.ai_track_expectations}
          </p>
        </div>
      </div>
    </article>
  );
}