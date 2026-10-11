import { challengeByType } from "../lib/challenges";
import type { Submission } from "../lib/types";
import { formatTimestamp } from "../lib/store";
import { useLang } from "../lib/i18n";

interface Props {
  submission: Submission;
  className?: string;
  /** Big presentation variant for the host projector. */
  large?: boolean;
}

/** A colorful community-wall answer card with a per-category accent. */
export function ChallengeCard({ submission, className, large = false }: Props) {
  const { lang, pick } = useLang();
  const challenge = challengeByType(submission.challenge_type);

  return (
    <article
      className={`card-pop rounded-3xl border-4 bg-white p-5 shadow-xl transition-transform hover:-translate-y-1 ${
        large ? "p-8 sm:p-10" : ""
      } ${className ?? ""}`}
      style={{ borderColor: challenge.color, boxShadow: `0 16px 40px -18px ${challenge.color}66` }}
    >
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-2xl text-2xl"
          style={{ backgroundColor: challenge.light }}
          aria-hidden="true"
        >
          {challenge.emoji}
        </span>
        <span
          className="rounded-full px-3 py-1 text-xs font-extrabold tracking-wide"
          style={{ backgroundColor: challenge.light, color: challenge.dark }}
        >
          {pick(challenge.title)}
        </span>
        {lang === "ar" && (
          <span className="text-xs font-bold text-violet-400" dir="rtl">
            {formatTimestamp(submission.created_at, lang)}
          </span>
        )}
      </header>

      <h3 className="mb-1 text-lg font-extrabold text-slate-800">
        {submission.student_name} <span className="em" aria-hidden="true">•</span>
        <span className="text-sm font-bold text-slate-400"> {formatTimestamp(submission.created_at, lang)}</span>
      </h3>

      <p
        className={`whitespace-pre-wrap text-slate-700 ${large ? "text-xl sm:text-2xl" : "text-[0.95rem] leading-relaxed"}`}
        dir={lang === "ar" ? "rtl" : "ltr"}
      >
        {submission.answer}
      </p>
    </article>
  );
}