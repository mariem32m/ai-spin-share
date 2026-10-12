import type { SurveySubmission } from "./types";
import { SURVEY_QUESTIONS } from "./questions";
import type { SurveyQuestion, SurveyQuestionKey } from "./questions";

export interface DistributionItem {
  id: string;
  count: number;
  /** Fraction 0..1 of the relevant base. */
  ratio: number;
}

/**
 * Count answers to one question.
 * - Single-select questions: each submission contributes 1 vote to its option.
 * - Multi-select questions: each selected option gets a vote (a submission can
 *   appear in several options), and `baseCount` is the number of submissions.
 */
export function distribution(rows: SurveySubmission[], question: SurveyQuestion): {
  items: DistributionItem[];
  baseCount: number;
} {
  const baseCount = rows.length;
  const counts = new Map<string, number>();
  for (const o of question.options) counts.set(o.id, 0);

  for (const row of rows) {
    const value = row[question.key];
    if (Array.isArray(value)) {
      for (const id of value) if (counts.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
    } else if (typeof value === "string" && counts.has(value)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  const items: DistributionItem[] = [...counts.entries()].map(([id, count]) => ({
    id,
    count,
    ratio: baseCount === 0 ? 0 : count / baseCount,
  }));
  return { items, baseCount };
}

/** Top N most common free-text snippets is not useful — instead expose raw text. */
export function sortedByCount(items: DistributionItem[]): DistributionItem[] {
  return [...items].sort((a, b) => b.count - a.count);
}

export type { SurveyQuestionKey };
export { SURVEY_QUESTIONS };