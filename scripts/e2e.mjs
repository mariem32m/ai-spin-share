/**
 * End-to-end tests for AI Spin & Share, driving the real system Chromium
 * (Chrome or Edge) via playwright-core — no browser download needed.
 *
 *   npm run test:e2e                 # against http://localhost:4173
 *   BASE_URL=... npm run test:e2e    # against any deployment
 *
 * Covers: the spin button is reliably clickable (regression guard for the
 * moving-button bug), the wheel actually rotates, and the full student
 * journey works on both desktop and touch: spin -> answer -> submit -> wall.
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

/** Full student journey in a fresh context; returns the answer text. */
async function journey({ touch }) {
  const ctx = await browser.newContext({
    hasTouch: !!touch,
    isMobile: !!touch,
    viewport: touch ? { width: 390, height: 844 } : { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();
  watch(page);

  await page.goto(`${BASE}/play`, { waitUntil: "networkidle" });
  await page.waitForSelector(".btn-spin");
  const answer = `E2E ${touch ? "touch" : "desktop"} ${Date.now()}`;

  // The spin button must be clickable by Playwright's strict actionability
  // (visible, enabled, STABLE) — this is the regression guard.
  try {
    await page.waitForSelector(".btn-spin", { state: "visible" });
    await page.locator(".btn-spin").click({ timeout: 8000 });
  } catch (e) {
    check(`[${touch ? "touch" : "desktop"}] spin button clickable`, false, String(e.message).split("\n")[0]);
    await ctx.close();
    return answer;
  }

  const transform = await page.$eval(".wheel-rotor", (el) => el.style.transform);
  check(`[${touch ? "touch" : "desktop"}] wheel rotates after click`, /rotate\(([1-9]\d{2,})/.test(transform), transform);

  await page.waitForSelector("div.fixed.inset-0 h2", { timeout: 12000 });
  await page.locator("div.fixed.inset-0 button").first().click();
  await page.waitForSelector("#student-name", { timeout: 5000 });

  await page.fill("#student-name", "Layla E2E");
  await page.fill("#student-answer", answer);
  await page.locator('form button[type="submit"]').click();
  await page.waitForSelector('a[href="/wall"]', { timeout: 8000 });
  check(`[${touch ? "touch" : "desktop"}] submit reaches success`, true);

  await page.goto(`${BASE}/wall`, { waitUntil: "networkidle" });
  const seen = await page
    .waitForFunction((txt) => document.body.innerText.includes(txt), answer, { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  check(`[${touch ? "touch" : "desktop"}] wall shows the answer`, seen);

  await ctx.close();
  return answer;
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