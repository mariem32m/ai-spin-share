import { useMemo } from "react";
import type { SurveyQuestion } from "../lib/questions";
import type { SurveySubmission } from "../lib/types";
import { distribution, sortedByCount } from "../lib/stats";
import { optionById } from "../lib/questions";
import { useLang } from "../lib/i18n";

interface Props {
  question: SurveyQuestion;
  rows: SurveySubmission[];
}

/** Compact horizontal bar chart for one survey question. */
export function QuestionChart({ question, rows }: Props) {
  const { t, pick } = useLang();
  const { items, baseCount } = useMemo(() => distribution(rows, question), [rows, question]);
  const ordered = useMemo(() => sortedByCount(items), [items]);

  if (baseCount === 0) return null;

  return (
    <div className="rounded-3xl bg-white/80 p-5 ring-1 ring-violet-100">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-2xl" style={{ backgroundColor: question.light }} aria-hidden="true">
          {question.emoji}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-slate-700" dir="auto">
            {pick(question.question)}
          </div>
          <div className="text-xs font-bold text-slate-400" title={pick(question.purpose)}>
            {t("dash.purpose.tip")}: {pick(question.purpose)}
          </div>
        </div>
      </div>

      {question.multiSelect && (
        <p className="mt-3 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-500" style={{ backgroundColor: question.light }}>
          🧩 {t("dash.chart.many")}
        </p>
      )}

      <ul className="mt-4 flex flex-col gap-2.5">
        {ordered.map((item) => {
          const option = optionById(question, item.id);
          const pct = Math.round(item.ratio * 100);
          return (
            <li key={item.id}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-bold text-slate-600" dir="auto" title={pick(option)}>
                  {pick(option)}
                </span>
                <span className="shrink-0 font-extrabold text-slate-800">
                  {item.count}
                  <span className="text-xs font-bold text-slate-400"> · {pct}%</span>
                </span>
              </div>
              <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.max(item.ratio * 100, item.count > 0 ? 4 : 0)}%`, backgroundColor: question.color }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}