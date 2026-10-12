/**
 * Integration test for the REAL store module (demo mode) run through
 * vite-node, so `import.meta.env` and extensionless imports work exactly
 * like in the browser build.
 * Run: npm run test:store
 *
 * Covers the survey acceptance path: session resolution, validation rules,
 * submit → realtime notification, rate limiting, newest-first ordering,
 * dashboard aggregation (distribution), CSV export shape, reset session.
 */
import { store, resolveSession, validateSurveySubmission } from "../src/lib/store";
import type { SurveySubmission } from "../src/lib/types";
import { distribution } from "../src/lib/stats";
import { SURVEY_QUESTIONS } from "../src/lib/questions";
import { surveysToCsv } from "../src/lib/csv";

// ---- Minimal localStorage shim so the demo store can persist in-process ----
const memory = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => (memory.has(k) ? memory.get(k) ?? null : null),
  setItem: (k: string, v: string) => void memory.set(k, String(v)),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
} as Storage;

let failures = 0;
const check = (name: string, cond: boolean, detail = "") => {
  if (!cond) {
    failures++;
    console.error("  FAIL:", name, detail);
  } else {
    console.log("  ok  :", name);
  }
};

const RATE_KEY = "aiyourseyes:demo:v1:lastSubmit";
const clearRateLimit = () => memory.delete(RATE_KEY);

/** A fully valid answer set. */
function validAnswers() {
  return {
    question_1_answer: "new_to_ai",
    question_2_answer: "almost_every_day",
    question_3_answer: ["answer_and_generate", "analyze_and_patterns"],
    question_4_answer: "usually_but_mistakes",
    question_5_answer: ["machine_learning", "generative_ai"],
  };
}

const run = async () => {
  console.log("— survey store integration tests —");

  // 1. Session resolution (demo mode).
  const info = await resolveSession();
  check("mode is demo", info.mode === "demo");
  check("session has id", Boolean(info.session.id));
  const sessionId = info.session.id;

  // 2. Validation rules.
  const v = validateSurveySubmission;
  check(
    "rejects missing q1",
    v({ answers: { ...validAnswers(), question_1_answer: "" }, nickname: "", ai_track_expectations: "wish" }).error === "missing_answer",
  );
  check(
    "rejects empty multi-select",
    v({ answers: { ...validAnswers(), question_3_answer: [] }, nickname: "", ai_track_expectations: "wish" }).error === "missing_answer",
  );
  check(
    "rejects bad option id",
    v({ answers: { ...validAnswers(), question_2_answer: "nope" }, nickname: "", ai_track_expectations: "wish" }).error === "bad_answer",
  );
  check(
    "rejects empty expectations",
    v({ answers: validAnswers(), nickname: "", ai_track_expectations: "  " }).error === "expectations_empty",
  );
  check(
    "rejects >500 expectations",
    v({ answers: validAnswers(), nickname: "", ai_track_expectations: "x".repeat(501) }).error === "expectations_long",
  );
  check(
    "rejects >50 nickname",
    v({ answers: validAnswers(), nickname: "A".repeat(51), ai_track_expectations: "wish" }).error === "nickname_long",
  );
  check(
    "accepts valid submission",
    v({ answers: validAnswers(), nickname: "Sara", ai_track_expectations: "I want to build agents" }).ok === true,
  );

  // 3. Realtime notification on submit.
  let received: SurveySubmission | null = null;
  const unsub = store.subscribe(sessionId, (p) => {
    if (p.eventType === "INSERT") received = p.submission;
  });
  const first = await store.submitSurvey({
    session_id: sessionId,
    nickname: "Sara",
    answers: validAnswers(),
    ai_track_expectations: "I want to build agents",
  });
  check("submit returns record", Boolean(first.id));
  check("realtime payload delivered", received?.id === first.id);
  check("multi-select answer preserved", (first.question_3_answer as string[]).join(",") === "answer_and_generate,analyze_and_patterns");
  check("expectations trimmed", first.ai_track_expectations === "I want to build agents");

  // 4. Rate limiter blocks a second immediate submit.
  let rateBlocked = false;
  try {
    await store.submitSurvey({ session_id: sessionId, nickname: "", answers: validAnswers(), ai_track_expectations: "again" });
  } catch (e) {
    rateBlocked = e instanceof Error && e.message === "RATE_LIMITED";
  }
  check("second submit rate-limited", rateBlocked);
  unsub();

  // 5. Newest-first ordering.
  clearRateLimit();
  const second = await store.submitSurvey({
    session_id: sessionId,
    nickname: "Omar",
    answers: { ...validAnswers(), question_1_answer: "built_project", question_5_answer: ["building_projects"] },
    ai_track_expectations: "نفسي أبني مشروع AI حقيقي",
  });
  const all = await store.listSurveys(sessionId);
  check("2 submissions stored", all.length === 2);
  check("newest first", all[0].id === second.id);
  check("arabic expectations preserved", (all[1].ai_track_expectations as string) === "I want to build agents");

  // 6. Dashboard aggregation (distribution).
  const q1 = distribution(all, SURVEY_QUESTIONS[0]);
  const q1New = q1.items.find((i) => i.id === "new_to_ai");
  check("q1 counts new_to_ai = 1", q1New?.count === 1);
  check("q1 base = 2", q1.baseCount === 2);
  const q3 = distribution(all, SURVEY_QUESTIONS[2]);
  check("q3 multi: total votes = 4", q3.items.reduce((s, i) => s + i.count, 0) === 4);
  check("q3 base stays 2", q3.baseCount === 2);

  // 7. CSV export shape.
  const csv = surveysToCsv(all, "en");
  check("csv starts with BOM", csv.charCodeAt(0) === 0xfeff);
  check("csv has header", csv.includes("question_1_answer"));
  check("csv contains free-text answer", csv.includes("I want to build agents"));

  // 8. resetSession opens a fresh session and keeps history archived.
  clearRateLimit();
  const fresh = await store.resetSession();
  check("reset produces new session id", fresh.id !== sessionId);
  const freshList = await store.listSurveys(fresh.id);
  check("fresh session is empty", freshList.length === 0);
  const oldList = await store.listSurveys(sessionId);
  check("old session archived (still readable)", oldList.length === 2);

  console.log(failures === 0 ? "\n✅ ALL SURVEY STORE TESTS PASSED" : `\n❌ ${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
};

run().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});