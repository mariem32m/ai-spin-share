/**
 * End-to-end tests for AI Through Your Eyes, driving the real system
 * Chromium (Chrome or Edge) via playwright-core — no browser download.
 *
 *   npm run test:e2e                 # against http://localhost:4173
 *   BASE_URL=... npm run test:e2e    # against any deployment
 *
 * Covers the full student journey on both desktop and touch: answer the
 * five questions, type the final expectation, submit, see the thank-you
 * screen, then verify the organizer dashboard shows the response and the
 * QR panel points at the real /survey link.
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:4173";

function findBrowser() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ];
  return candidates.find((p) => existsSync(p));
}

const chrome = findBrowser();
if (!chrome) {
  console.error("No Chrome/Edge found. Set CHROMIUM_PATH to a Chromium executable.");
  process.exit(2);
}

let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-first-run", "--disable-gpu"],
});

const errors = [];
const watch = (page) => {
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
};

/** Full student journey in a fresh context; returns the expectation text. */
async function journey({ touch }) {
  const ctx = await browser.newContext({
    hasTouch: !!touch,
    isMobile: !!touch,
    viewport: touch ? { width: 390, height: 844 } : { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();
  watch(page);

  await page.goto(`${BASE}/survey`, { waitUntil: "networkidle" });
  await page.waitForSelector(".quiz-option", { timeout: 15000 });
  check(`[${touch ? "touch" : "desktop"}] survey loads with question`, true);

  const expectation = `E2E ${touch ? "touch" : "desktop"} ${Date.now()} — want to build an AI agent`;

  // Ask all five questions.
  for (let i = 0; i < 5; i++) {
    const count = await page.locator(".quiz-option").count();
    if (count === 0) {
      check(`[${touch ? "touch" : "desktop"}] question ${i + 1} shows options`, false);
      break;
    }
    await page.locator(".quiz-option").nth(0).click();
    // Multi-select questions have 5+ options (q3, q5): pick a second one too.
    if (count >= 5) {
      await page.locator(".quiz-option").nth(1).click();
    }
    await page.locator('[data-testid="next"]').click();
    if (i < 4) {
      await page.waitForSelector(".quiz-option", { timeout: 8000 });
    }
  }
  check(`[${touch ? "touch" : "desktop"}] all 5 questions answered`, true);

  // Final open question.
  await page.waitForSelector("#survey-expectations", { timeout: 8000 });
  check(`[${touch ? "touch" : "desktop"}] final question reached`, true);
  await page.fill("#survey-nickname", touch ? "Layla" : "Omar");
  await page.fill("#survey-expectations", expectation);

  const counter = await page.locator("text=/\\d+\\/500/").count();
  check(`[${touch ? "touch" : "desktop"}] character counter visible`, counter > 0);

  await page.locator('[data-testid="submit"]').click();
  await page
    .waitForFunction(
      (txt) => document.body.innerText.includes("Thank You") || document.body.innerText.includes(txt),
      expectation,
      { timeout: 10000 },
    )
    .then(() => check(`[${touch ? "touch" : "desktop"}] thank-you screen shown`, true))
    .catch(() => check(`[${touch ? "touch" : "desktop"}] thank-you screen shown`, false, "timeout"));

  // Organizer dashboard (same browser context ⇒ same demo storage).
  await page.goto(`${BASE}/host`, { waitUntil: "networkidle" });
  await page
    .waitForFunction((txt) => document.body.innerText.includes(txt), expectation, { timeout: 15000 })
    .then(() => check(`[${touch ? "touch" : "desktop"}] dashboard shows the response`, true))
    .catch(() => check(`[${touch ? "touch" : "desktop"}] dashboard shows the response`, false, "timeout"));

  // QR panel points at the real survey URL.
  const joinLink = await page.inputValue("#join-link").catch(() => "");
  check(
    `[${touch ? "touch" : "desktop"}] join link points to /survey`,
    Boolean(joinLink) && joinLink.endsWith("/survey"),
    joinLink,
  );

  await ctx.close();
  return expectation;
}

try {
  await journey({ touch: false });
  await journey({ touch: true });
  check("no console/page errors", errors.length === 0, JSON.stringify(errors.slice(0, 5)));
} catch (e) {
  check("journey completed", false, String(e?.message ?? e));
} finally {
  await browser.close();
}

console.log(failures === 0 ? "\n✅ ALL E2E TESTS PASSED" : `\n❌ ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);