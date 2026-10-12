import type { SurveySubmission } from "./types";
import { SURVEY_QUESTIONS, optionById } from "./questions";
import type { SurveyQuestionKey } from "./questions";

/** Escape a single CSV cell. */
function csvCell(value: string | null | undefined): string {
  const v = value ?? "";
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function label(key: SurveyQuestionKey, id: string): string {
  const q = SURVEY_QUESTIONS.find((item) => item.key === key);
  const o = q ? optionById(q, id) : null;
  return o?.en ?? id;
}

/** Serialize the option id(s) of one question into a CSV-friendly string. */
function answerCell(key: SurveyQuestionKey, value: string | string[]): string {
  if (Array.isArray(value)) return value.map((id) => label(key, id)).join("; ");
  return label(key, value);
}

/**
 * Build the organizer CSV export (UTF-8 with BOM so Arabic opens
 * correctly in Excel / Google Sheets). Exports both the readable English
 * labels and the raw stored ids for reference.
 */
export function surveysToCsv(rows: SurveySubmission[], lang: "en" | "ar"): string {
  const header = [
    "created_at",
    "nickname",
    ...SURVEY_QUESTIONS.map((q) => q.key),
    "ai_track_expectations",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const row of rows) {
    const time = row.created_at
      ? new Date(row.created_at).toLocaleString(lang === "ar" ? "ar-EG" : "en-GB", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
    const cells = [
      time,
      row.nickname ?? "",
      answerCell("question_1_answer", row.question_1_answer),
      answerCell("question_2_answer", row.question_2_answer),
      answerCell("question_3_answer", row.question_3_answer),
      answerCell("question_4_answer", row.question_4_answer),
      answerCell("question_5_answer", row.question_5_answer),
      row.ai_track_expectations,
    ];
    lines.push(cells.map(csvCell).join(","));
  }
  return `\uFEFF${lines.join("\r\n")}`;
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}