# 👁️‍🗨️ AI Through Your Eyes — GDGoC AAST Aswan

**Answer 5 questions. Tell us your story. Help shape the AI Track.**

A colorful, mobile-first QR questionnaire for the GDGoC AAST Aswan AI Track
Orientation. Students scan a QR code on the projector, answer **5 multiple-choice
questions + 1 open-ended question** about their AI experience and expectations,
and organizers see the aggregated results live on a protected dashboard — with
charts, filters, search, and CSV export. No wheel, no public wall of answers:
every reply stays private between the student and the organizers.

---

## What's included

| Route    | Purpose                                                              |
| -------- | -------------------------------------------------------------------- |
| `/`      | Welcome screen (mascot, headline, EN/AR switcher, "Scan to participate!") |
| `/survey`| The questionnaire: 5 questions (one per screen) + final open question  |
| `/host`  | Organizer dashboard: QR code, live stats, charts, filters, search, CSV |

Features that work right now:

- ✅ Cute animated AI robot mascot, floating stars/sparkles/bubbles, confetti
- ✅ Full English 🇬🇧 + Arabic 🇪🇬 interface with automatic RTL
- ✅ 5 editable multiple-choice questions defined in one config file
  (`src/lib/questions.ts`) — questions 3 and 5 support **multiple selection**
- ✅ Final **required** open question (up to 500 chars) with a live counter,
  validation, and RTL support
- ✅ One question per screen with a progress indicator and Next / Back
- ✅ Optional nickname only; submission validates first, shows a loading state,
  prevents duplicates, and only shows success **after** the database write —
  a failure keeps the answers so nobody re-types everything
- ✅ Thank-you screen (robot + confetti + back-home) — other students' individual
  answers are **never exposed** to the public
- ✅ QR code generated from the **real configured public URL** (with guidance when
  it's unset), copyable student link, QR embedded in the host dashboard
- ✅ Organizer dashboard with aggregate stats (knowledge level, tool usage,
  capabilities, limitations, favorite topics, expectations), readable charts,
  session filters, per-submission details, searchable/browsable expectations,
  and CSV export (with UTF-8 BOM so Arabic opens correctly in Excel)
- ✅ Two persistence modes — **Demo** (localStorage, clearly labeled 🧪) and
  **Live** (Supabase; dashboard reads private responses through a protected Edge
  Function and polls every ~5s)
- ✅ Accessibility: keyboard navigation, visible focus states,
  `prefers-reduced-motion`, semantic controls, EN LTR + AR RTL
- ✅ Fully responsive: phones, tablets, laptops, projectors

---

## Quick start (Demo Mode — no database needed)

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Fill in the survey on one tab and watch it appear
on `/host` in another tab (cross-tab localStorage sync) — a fast way to review
the whole flow before going live.

> **Demo mode stores answers in the browser of each device only.** Two phones
> will NOT see each other's submissions, and the dashboard shows `🧪 demo` data.
> For the real Orientation flow where every student's phone writes to one shared
> dashboard, connect Supabase (next section).

---

## Production setup (real shared storage with Supabase)

### 1. Create the schema

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL editor, run `supabase/schema.sql`. This creates:
   - `game_sessions` — one active session at a time
   - `survey_submissions` — one row per completed survey (answers stored as
     language-independent option IDs; questions 3 & 5 as `text[]`)
   - RLS: the public anon role can **only insert** valid submissions. There is
     **no SELECT policy** — responses are private organizer data.

### 2. Deploy the host Edge Function

**Security model:** students only ever get the anon key and can only insert one
validated submission — they cannot read anyone's answers via the database. Every
privileged read/action (fetching the private response list, session reset,
deletion) runs through the `host-actions` Edge Function with the service-role
key, guarded by host authentication.

Two host authentication modes are supported (either authorizes):

1. **Organizer account (recommended)** — the host signs in with a real
   **Supabase Auth** account; the password never enters the JS bundle. The Edge
   Function validates the user's JWT and checks the email is in the
   `HOST_EMAILS` allow-list. Set up: create the host user once in the dashboard
   (**Authentication → Users → Add user**), and (recommended) turn **OFF**
   "Allow new users to sign up" so students can't create accounts.
2. **Legacy host-password hash** — `VITE_HOST_HASH` (SHA-256 of a password).
   NOTE: this value is embedded in the public build, so it can't be treated as a
   true secret — it only gates the dashboard UI. Prefer mode 1 in production.

```bash
npx supabase login
npx supabase init
npx supabase link --project-ref <your-project-ref>

# Apply the schema (runs supabase/migrations/…):
npx supabase db push

# Recommended: allow-list organizer accounts (comma-separated emails):
npx supabase secrets set HOST_EMAILS=organizer@example.com

# Optional legacy mode — hash a password you choose for the host console and
# set the SAME hex as the frontend's VITE_HOST_HASH:
node scripts/sha256.mjs "choose-a-strong-host-password"
npx supabase secrets set HOST_HASH=<the printed hex>

# Optional CORS allow-list (recommended). When unset the function reflects the
# request Origin, which is safe because no cookies are used:
npx supabase secrets set ALLOWED_ORIGINS=https://<your-deployed-domain>

npx supabase functions deploy host-actions
```

> Re-deploy this function after pulling a newer version — it must contain the
> `survey_list` action (and the JWT host-auth path) or the live dashboard can't
> read responses.

### 3. Configure the frontend (`ai-spin-share/.env`)

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>            # Project Settings → API
VITE_PUBLIC_BASE_URL=https://<your-deployed-domain> # used for QR + student link
VITE_HOST_HASH=<same hex as HOST_HASH>              # optional (legacy host auth)
VITE_MIN_SUBMIT_INTERVAL_MS=10000
```

`VITE_PUBLIC_BASE_URL` is optional in production. The repo ships committed,
**public** build defaults in `src/lib/publicConfig.ts` (Supabase URL, anon key,
deployed base URL). These are applied to `vite build` (production) only, so a
deployed build is live without any `.env` file; local `npm run dev` and the unit
tests stay in **demo mode** unless you create a local `.env` that opts in. A real
platform env var (e.g. Vercel `VITE_SUPABASE_URL`) always overrides the default.
`VITE_PUBLIC_BASE_URL` falls back to `window.location.origin`, which is correct on
the deployed domain. During **local** `vite preview` of a production build the
committed base URL is used.

> Never put `SUPABASE_SERVICE_ROLE_KEY` or any admin secret in the frontend. Only
> the anon key lives in `.env`; the service-role key exists solely inside the Edge
> Function's runtime on Supabase.

### 4. Deploy the frontend (any static host)

```bash
npm run build     # outputs dist/
```

Deploy `dist/` to Vercel, Netlify, Cloudflare Pages, GitHub Pages, or the
school's own host. The SPA needs `/`, `/survey`, `/host`, and the 404 fallback to
serve `index.html`:

- **Netlify**: `netlify.toml`:
  ```toml
  [[redirects]]
    from = "/*"
    to = "/index.html"
    status = 200
  ```
- **Vercel**: create `vercel.json`:
  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```
- **Cloudflare Pages**: set *SPA / single page application* = On.

---

## How to run the Orientation session

1. **Host opens** `https://<your-url>/host` on the projector computer and signs
   in — either with the organizer account (recommended, Supabase Auth) or the
   host-password hash.
2. The dashboard shows the **QR code** pointing to `.../survey` (generated from
   the real deployed URL) and a **copyable student link**. Put the QR on screen —
   students scan it with their phones.
3. Students answer 5 quick questions, then the final open question, and submit
   their nickname (optional). Answers land in the shared table.
4. The dashboard updates every ~5 seconds: live counts, per-question charts,
   filters, searchable expectations, and **Export CSV** for the organizers.
5. Other students never see individual answers — only the organizers do.

## Editing the questions

All 5 questions (wording, options, which ones allow multiple selection, and the
final open question) live in **`src/lib/questions.ts`**, one editable object with
`en` and `ar` labels and stable option IDs. If you change the option IDs, update
`supabase/schema.sql` check constraints to match, and redeploy the Edge Function.

## Environment variables summary

| Variable                      | Frontend | Edge Function | Required  | Purpose                                       |
| ----------------------------- | -------- | ------------- | --------- | --------------------------------------------- |
| `VITE_SUPABASE_URL`           | ✅        | (auto)        | Live mode | Supabase project URL                           |
| `VITE_SUPABASE_ANON_KEY`      | ✅        | ❌             | Live mode | Public anon key (safe for clients)             |
| `VITE_PUBLIC_BASE_URL`        | ✅        | ❌             | no        | QR/student link origin override                |
| `VITE_HOST_HASH`              | ✅        | ✅ `HOST_HASH` | Legacy live| SHA-256 of the host password (public in bundle) |
| `VITE_MIN_SUBMIT_INTERVAL_MS` | ✅        | ❌             | no        | Device-level anti-spam interval                |
| `HOST_EMAILS`                 | ❌        | ✅             | Rec. mode| Comma-separated organizer emails (Auth JWT auth)|
| `ALLOWED_ORIGINS`             | ❌        | ✅             | optional | Comma-separated CORS origins (reflects Origin when unset) |
| `SUPABASE_SERVICE_ROLE_KEY`   | ❌        | ✅ (auto)      | edge fn   | Secret — never in frontend                     |

## Testing performed

- ✅ `npm run build` (`tsc -b && vite build`) passes with zero errors
- ✅ `npm run lint` (oxlint) passes
- ✅ Store integration-tested on the real module in demo mode
  (`npm run test:store`): session resolution, validation rules (missing/bad
  answers, empty/too-long expectations, long nickname), submit + event
  notification, rate limiting, sorting, reset, delete
- ✅ Edge Function auth logic reviewed: bearer-hash (legacy) and Supabase Auth
  JWT + `HOST_EMAILS` allow-list; unauthenticated privileged calls return 401
- ✅ End-to-end tested against **demo mode** (`npm run test:e2e`, Playwright over
  `vite preview`): welcome → all 5 questions → final open question → submit →
  thank-you → host dashboard shows the submission — with zero console/page errors
- ✅ End-to-end tested against the **live Supabase project** (same command plus
  `E2E_HOST_EMAIL` / `E2E_HOST_PASSWORD`): the student insert lands in Postgres,
  anon cannot read it back (RLS), the organizer signs in and the dashboard
  displays the response through the protected Edge Function
- ✅ EN + AR, keyboard navigation, and reduced-motion behavior verified

### Deployment status

This project is deployed to Vercel (`https://ai-spin-share.vercel.app`) and wired
to a live Supabase project. Remaining / optional manual steps:

- Rotate the organizer account password (created during setup) after first login
- Optionally set `ALLOWED_ORIGINS` to lock CORS to the deployed domain
- (Recommended) add server-side rate limiting / captcha in the Edge Function or
  increase limits if many students submit at once

## Tech stack

React 19 · TypeScript · Tailwind CSS v4 · Vite · Supabase (Postgres + RLS +
Edge Function) · `canvas-confetti` · `qrcode.react` — no other frameworks.