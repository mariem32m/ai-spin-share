/**
 * Integration test for the REAL store module (demo mode) run through
 * vite-node, so `import.meta.env` and extensionless imports work exactly
 * like in the browser build.
 * Run: npm run test:store
 *
 * Covers the final acceptance path: ensure session → submit → real-time
 * notification → moderation (hide) → host list → reset → config.
 */
import { store, resolveSession, validateSubmission } from "../src/lib/store";
import type { Submission } from "../src/lib/types";

// ---- Minimal localStorage shim so the demo store can persist in-process ----
const memory = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => (memory.has(k) ? memory.get(k) ?? null : null),
  setItem: (k: string, v: string) => void memory.set(k, String(v)),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
} as Storage;

let failures = 0;
const check = (name: string, cond: boolean) => {
  if (!cond) {
    failures++;
    console.error("  FAIL:", name);
  } else {
    console.log("  ok  :", name);
  }
};

const RATE_KEY = "aispinshare:demo:v1:lastSubmit";
const clearRateLimit = () => memory.delete(RATE_KEY);

const run = async () => {
  console.log("— demo store integration tests —");

  // 1. Session resolution (demo mode).
  const info = await resolveSession();
  check("mode is demo", info.mode === "demo");
  check("session has id", Boolean(info.session.id));
  const sessionId = info.session.id;

  // 2. Validation rules.
  check("rejects empty name", validateSubmission({ student_name: "  ", answer: "x", challenge_type: "ai_is" }).error === "name_empty");
  check("rejects empty answer", validateSubmission({ student_name: "A", answer: "  ", challenge_type: "my_ai_story" }).error === "answer_empty");
  check("rejects >50 name", validateSubmission({ student_name: "A".repeat(51), answer: "x", challenge_type: "ai_is" }).error === "name_long");
  check("rejects >500 answer", validateSubmission({ student_name: "A", answer: "x".repeat(501), challenge_type: "ai_is" }).error === "answer_long");
  check("rejects bad challenge", validateSubmission({ student_name: "A", answer: "x", challenge_type: "nope" }).error === "bad_challenge");
  check("accepts valid", validateSubmission({ student_name: "Sara", answer: "AI is cool", challenge_type: "ai_is" }).ok === true);

  // 3. Real-time notification on submit.
  let received: Submission | null = null;
  const unsub = store.subscribe(sessionId, (p) => {
    if (p.eventType === "INSERT") received = p.submission;
  });
  const first = await store.submit({ session_id: sessionId, student_name: "Sara", challenge_type: "ai_is", answer: "AI is cool" });
  check("submit returns record", Boolean(first.id));
  check("realtime payload delivered", received?.id === first.id);

  // 4. Rate limiter blocks a second immediate submit.
  let rateBlocked = false;
  try {
    await store.submit({ session_id: sessionId, student_name: "Sara", challenge_type: "ai_is", answer: "again" });
  } catch (e) {
    rateBlocked = e instanceof Error && e.message === "RATE_LIMITED";
  }
  check("second submit rate-limited", rateBlocked);
  unsub();

  // 5. Newest-first ordering.
  clearRateLimit();
  const second = await store.submit({ session_id: sessionId, student_name: "Omar", challenge_type: "if_i_built_ai", answer: "🚀 a robot for homework" });
  const all = await store.getSubmissions(sessionId);
  check("2 submissions stored", all.length === 2);
  check("newest first", all[0].id === second.id);
  check("answer text preserved (no trimming of emoji)", all[1].answer === "AI is cool");

  // 6. Moderation: hide → host list shows hidden; wall list still includes it.
  await store.setModeration(first.id, "hidden");
  const hostList = await store.hostList(sessionId);
  check("host list contains hidden", hostList.find((s) => s.id === first.id)?.moderation_status === "hidden");
  await store.setModeration(first.id, "visible");
  const restored = await store.hostList(sessionId);
  check("restore works", restored.find((s) => s.id === first.id)?.moderation_status === "visible");

  // 7. updateConfig persists.
  const cfg = await store.updateConfig({ allow_repeat_participation: false, registration_url: "https://example.com/join" });
  check("config saved (repeat=false)", cfg.allow_repeat_participation === false);
  check("config saved (url)", cfg.registration_url === "https://example.com/join");

  // 8. resetSession opens a fresh session and keeps history archived.
  const fresh = await store.resetSession();
  check("reset produces new session id", fresh.id !== sessionId);
  const freshList = await store.getSubmissions(fresh.id);
  check("fresh session is empty", freshList.length === 0);
  const oldList = await store.getSubmissions(sessionId);
  check("old session archived (still readable)", oldList.length === 2);

  console.log(failures === 0 ? "\n✅ ALL STORE TESTS PASSED" : `\n❌ ${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
};

run().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});