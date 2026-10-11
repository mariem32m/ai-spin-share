# 🎡 AI Spin & Share — GDGoC AAST Aswan

**Spin the Wheel. Share Your Ideas. Imagine the Future.**

A colorful, real-time multiplayer web game for the GDGoC AAST Aswan AI Track
Orientation. Students scan a QR code, spin a wheel, get one of three AI
challenges, share their name + idea, and their answer appears live on a shared
community wall projected for everyone to see.

---

## What's included

| Route   | Purpose                                                                 |
| ------- | ----------------------------------------------------------------------- |
| `/`     | Welcome screen (mascot, wheel preview, language switcher, How to Play)   |
| `/play` | The game: spin the wheel → challenge → name + answer → success → AI Track call-to-action |
| `/wall` | Shared live **AI Idea Wall** (filters, counters, real-time updates)      |
| `/host` | Host console: QR code, join link, live stats, fullscreen, highlight mode, moderation, session config |

Features that work right now:

- ✅ Cute animated AI robot mascot (one consistent mascot for every state)
- ✅ Colorful 3‑segment spinning wheel with geometric consistency (the winner is
  the segment that really stops under the pointer), bounce settle, confetti
- ✅ Full English 🇬🇧 + Arabic 🇪🇬 interface with automatic RTL
- ✅ Name/answer validation, live character counters, no false success on failure
- ✅ Host authentication (password → SHA‑256), moderation (hide/restore),
  highlight-for-projector, reset (with confirm) and **permanent delete**
  (with `DELETE` confirm)
- ✅ Two persistence modes — **Demo** (localStorage, clearly labeled) and
  **Live** (Supabase + realtime)
- ✅ Respects `prefers-reduced-motion`; no autoplay sound
- ✅ Fully responsive: phones, tablets, laptops, projectors

---

## Quick start (Demo Mode — no database needed)

```bash
npm install
npm run dev
```

Open `http://localhost:5173` (use `--host` to share on the LAN for phones).

> **Demo mode stores submissions in the browser of each device only.** Two
> phones will NOT see each other's answers. The app clearly labels this with a
> 🧪 demo notice. For the real multiplayer Orientation experience, connect
> Supabase (next section).

### Demo-mode multiplayer test (same device)

Open two browser tabs of `/play` and `/wall` on the same machine. Submissions
made in `/play` appear on `/wall` in real time (cross-tab localStorage sync).
This is a great way to review the experience before going live.

---

## Production setup (real multiplayer with Supabase)

### 1. Create the schema

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL editor, run `supabase/schema.sql`.
3. Enable realtime for the `submissions` table (the schema already adds it to the
   `supabase_realtime` publication — verify under **Database → Replication**).

### 2. Deploy the host Edge Function

**Security model:** students only ever get the anonymous key. They may read
visible submissions and insert one submission — nothing else. Every privileged
action (moderation, session reset, config, deletion) runs through the
`host-actions` Edge Function using the service-role key and a host bearer token.

```bash
npx supabase login
npx supabase init
npx supabase link --project-ref <your-project-ref>

# Hash a password you choose for the host console:
node scripts/sha256.mjs "choose-a-strong-host-password"

# Use the printed hex for BOTH the env var and the edge function secret:
npx supabase secrets set HOST_HASH=<the printed hex>

npx supabase functions deploy host-actions --no-verify-jwt
```

### 3. Configure the frontend (`ai-spin-share/.env`)

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>          # Project Settings → API
VITE_PUBLIC_BASE_URL=https://<your-deployed-domain>  # used for QR + join link
VITE_REGISTRATION_URL=https://gdg.community.dev/gdsc-aast-aswan/  # official link
VITE_HOST_HASH=<same hex as HOST_HASH>
VITE_MIN_SUBMIT_INTERVAL_MS=10000
```

`VITE_PUBLIC_BASE_URL` is optional — without it the host page builds the QR/join
link from `window.location.origin`, which is correct on the deployed domain.

> Never put `SUPABASE_SERVICE_ROLE_KEY` or any admin secret in the frontend.
> Only the anon key lives in `.env`; the service-role key exists solely inside
> the Edge Function's runtime on Supabase.

### 4. Deploy the frontend (any static host)

```bash
npm run build     # outputs dist/
```

Deploy `dist/` to Vercel, Netlify, Cloudflare Pages, GitHub Pages, or the
school's own host. The SPA needs `/`, `/play`, `/wall`, `/host`, and the 404
fallback to serve `index.html`:

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

1. **Host opens** `https://<your-url>/host` on the projector computer and logs in
   with the host password.
2. The host console shows the **QR code** pointing to `.../play` (generated from
   the real deployed URL) and a **copyable join link**. Students scan it with
   their phones.
3. Students spin, answer, and submit. The wall ticker counts submissions live.
4. The host can press **🖥️ Enter Fullscreen** and use **⭐ Show on screen** on
   any answer to highlight it as a big card on the projector.
5. Inappropriate answers can be **🙈 hidden** (and later **👀 restored**).
6. For the next round: **Reset session** archives the current session and opens a
   fresh one (history is kept). **Permanently delete** is a separate, explicitly
   confirmed action.

## AI Track registration link

Configure `VITE_REGISTRATION_URL` (or set it live from the host console under
**Session configuration**). Until a link is set, the recruitment screen shows a
friendly "ask an organizer" message instead of a registration button.

## Environment variables summary

| Variable                        | Frontend | Edge Function | Required | Purpose                                        |
| ------------------------------- | -------- | ------------- | -------- | ---------------------------------------------- |
| `VITE_SUPABASE_URL`             | ✅        | (auto)        | Live mode | Supabase project URL                            |
| `VITE_SUPABASE_ANON_KEY`        | ✅        | ❌             | Live mode | Public anon key (safe for clients)              |
| `VITE_PUBLIC_BASE_URL`          | ✅        | ❌             | no       | QR/join link origin override                    |
| `VITE_REGISTRATION_URL`         | ✅        | ❌             | no       | Official AI Track registration link             |
| `VITE_HOST_HASH`                | ✅        | ✅ `HOST_HASH` | for mod  | SHA-256 of host password                        |
| `VITE_MIN_SUBMIT_INTERVAL_MS`   | ✅        | ❌             | no       | Device-level anti-spam interval                 |
| `SUPABASE_SERVICE_ROLE_KEY`     | ❌        | ✅ (auto)      | edge fn  | Secret — never in frontend                      |

---

## Testing performed

- ✅ `tsc && vite build` passes with zero errors
- ✅ All four routes load without console/page errors
- ✅ Wheel math unit-tested (see `npm run test:wheel`): uniform selection,
  landing consistency for every segment, extra rotations, angle bounds
- ✅ Store integration-tested on the real module in demo mode
  (see `npm run test:store`): session resolution, validation rules, submit +
  realtime notification, rate limiting, newest-first ordering, moderation
  hide/restore, config save, session reset with archived history
- ✅ End-to-end tested (see `npm run test:e2e`) in desktop and touch contexts:
  the spin button is reliably clickable (fixed the idle bob), the wheel actually
  rotates, and the full journey (spin → answer → submit → success → wall)
  completes with zero console/page errors

### Configuration still required for production

- Supabase project + schema + Edge Function deployment
- Host password hash (`node scripts/sha256.mjs`)
- Frontend env vars + static deployment
- (Recommended) raise limits / add a rate-limit via the Edge Function if many
  students submit at once

## Tech stack

React 19 · TypeScript · Tailwind CSS v4 · Vite · Supabase (Postgres + Realtime +
Edge Function) · `canvas-confetti` · `qrcode.react` — no other frameworks.