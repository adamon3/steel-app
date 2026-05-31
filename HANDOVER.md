# Steel — Handover

**Date:** 31 May 2026 (latest session)
**From:** Claude Opus 4.6/4.7 sessions
**For:** Next Claude session picking up this project

Read `CLAUDE.md` first — it has the full project context, design language, and product decisions. This doc covers what happened across sessions and what's left. Most recent session is at the bottom.

---

## Session 1 — App bug fixes (7 May 2026)

### Bug fixes — all committed and pushed to `main` (steel-app repo)

**Commit `a20e283` — Round 1 fixes:**
- `LogWorkout.jsx`: Completion screen 1RM section was showing blank exercise names. Fixed by adding `name: e.name` to the exercise mapping in `doSave()` (~line 1605).
- `LogWorkout.jsx`: Completion screen showed "1 EXERCISES" instead of "1 EXERCISE". Added ternary for pluralisation.
- `Profile.jsx`: Calendar day circles stretched absurdly wide on desktop viewports. Added `maxWidth: 420, margin: '0 auto'` to calendar grids.

**Commit `d334f5f` — Round 2 fixes:**
- `App.jsx`: Active workout was destroyed when user tapped away to another tab and back. Added `workoutActive` state + `onActiveChange` prop so LogWorkout stays mounted while a workout is in progress. BottomTabBar onChange logic updated to not reset the logger session when returning to an active workout.
- `App.jsx`: Minimised workout bar now shows when `workoutActive` is true (not just `workoutMinimized`).
- `Feed.jsx`: Feed could spin forever if `fetchFeed()` rejected. Added `.catch(() => setLoading(false))` to the useEffect.
- `LogWorkout.jsx`: Weight and reps inputs had no bounds — users could enter negative numbers or absurdly large values. Added `min`/`max` attributes and clamping in onChange handlers (weight: 0–9999, reps: 0–999).

---

## Session 2 — Landing page updates (23 May 2026)

### Landing page changes — committed and pushed to `main` (steel-landing repo)

**Commit `6a66c66` — landing: update copy, add profile pics, real map, built in london**

All changes in `steel-landing/index.html` (single-file landing page):

- **Eyebrow:** "BETA LIVE · IOS COMING" → "IOS & ANDROID COMING" (web app is now positioned as a demo, not the product)
- **Hero subhead:** "Free in beta." → "Free." (two instances — hero and CTA section)
- **CTA link:** "Or try the web beta now →" → "Or try the web demo now →"
- **Nav:** Added "Try the demo →" link alongside "Join the waitlist" so there's always a visible path to the web app from any scroll position
- **Sara O'Brien's card:** Removed `opacity: 0.6` — was reading as a broken/disabled card
- **Profile pictures:** Replaced all initial-only `<div class="mini-avatar">XX</div>` with DiceBear Notionists avatar `<img>` tags. Affected: Jamie Kelly (hero + leaderboard), Sara O'Brien (hero + leaderboard), Priya M. (Steel It section), Tom Chen, Maeve R., Dave H. (all leaderboard). "You" row keeps the "A" initial. Each uses `https://api.dicebear.com/9.x/notionists/svg?seed=Name&backgroundColor=hex`
- **Map:** Replaced CSS gradient fake map with a real OpenStreetMap iframe embed of the Bank/Shoreditch area of London. `filter: saturate(0.3) brightness(1.05)` keeps it muted to match the cream palette. `pointer-events: none` prevents interaction. Pins still overlay on top.
- **Footer:** "© 2026 · TRAIN TOGETHER" → "© 2026 · BUILT IN LONDON"

---

## Session 3 — Domain swap + landing polish (31 May 2026)

### Custom-domain rollout (`app.getsteel.app`)

DNS was already set up. This session swapped the demo URL away from `steel-app-eight.vercel.app` everywhere it was user-facing:

- **Landing** (`steel-landing/index.html`): nav "Try the demo →" and CTA "Or try the web demo now →" both point to `https://app.getsteel.app` now.
- **Welcome email** (Supabase `notify_waitlist_signup()` trigger function): both the `text` body and the HTML CTA button now link to `https://app.getsteel.app`. Applied as Supabase migration `update_waitlist_signup_url_to_app_getsteel`. Verified the old URL is gone from the function definition.
- **In-app code**: grep'd `steel-app/src/**` — no source references to the old URL, only doc files (`CLAUDE.md`, `HANDOVER.md`, `NEXT.md`). Docs left alone for now; not user-facing.

**Still needs Adam's hand:** confirm `app.getsteel.app` is actually attached as a custom domain in the Vercel `steel-app` project (Settings → Domains). DNS is configured, Vercel just needs to know the domain. Until that's done, the live demo link will 404 once Vercel finishes redeploying the landing.

### Landing copy/UX

All in `steel-landing/index.html`. Commits below.

- **Logger pillar bullets** — removed two that read like dev-changelog notes ("Bodyweight lifts track the weight you add (a 20kg pull-up reads +20)" and "Templates load with your real last numbers, not generic defaults"). Replaced the second with a warmer line: "Templates pick up where you left off, weights and all". Final list: 1RM/top-set trends + templates remember last weights + calendar streaks.
- **First testimonial (Tom · London)** — was about the feed. Now about gym leaderboard: *"Seeing where I rank in my gym is the thing. Two guys are above me on squats and I'm chipping at them every week."* Leans into the "people who push you" framing from CLAUDE.md.
- **Privacy page** — Adam dropped a `privacy.html` into `steel-landing/`. Added a footer link: `© 2026 · BUILT IN LONDON · PRIVACY`, with PRIVACY as a subtle `border-bottom` link inheriting the mono-caps footer style. Page itself was authored externally — not styled to match the rest of the landing yet (uses system fonts + a different lime). Audit for design consistency later if it matters.

### Commits pushed to `steel-landing` main this session

```
c5b354d  landing: add privacy page and footer link
c997b73  landing: warmer phrasing on template prefill bullet
b6ce28a  landing: re-add template prefill bullet, plainer wording
b53b76c  landing: tighten logger bullets, rework first testimonial around gym leaderboard
4197229  landing: point demo links to app.getsteel.app
```

No commits to `steel-app` this session.

### Supabase changes

- Migration `update_waitlist_signup_url_to_app_getsteel` applied to project `tkrwctmzftnmdspioohw`. Replaces both URL instances inside `public.notify_waitlist_signup()`. Trigger and function body otherwise unchanged. ntfy push still fires; Resend send still fires.

---

## Session 4 — duplicate templates + verification pass (31 May 2026)

**steel-app — commit `8e659f5`:**
- **Duplicate templates fixed.** Root cause was real duplicate rows (not a query/render bug — `key={t.id}` is unique). `saveTemplate(name, exercises, opts)` now checks for an existing same-name template and returns `{conflict, existingId, name}` instead of blindly INSERTing; with `{overwrite:true}` it wipes that template's `template_exercises` and rebuilds in place. All three save entry points prompt to overwrite/rename: completion screen, logging-phase "save as template" modal (`submitSaveTemplate`), and `handleSteelSave` in App.jsx. `saveGuestTemplate` now replaces by name too. Files: `store.js`, `localStorage.js`, `App.jsx`, `LogWorkout.jsx`.
- **DB cleanup (live):** deleted only exact-duplicate template rows (identical exercise fingerprint), keeping one of each — dropped one "Legs" and one 1-exercise "Workout (from Adam)". Left untouched the two genuinely-different "Workout" templates and the 6-exercise "Workout (from Adam)". 0 orphaned `template_exercises` after.
- ⚠️ **Not build-verified** — the Cowork bash sandbox truncates reads over the OneDrive mount, so esbuild/Vite couldn't compile the full files. Edits verified by re-reading. Worth a local `npm run build`.

**Verified already-handled (no change):**
- Guest `WorkoutDetail` "crash" — `handleViewWorkout` guards guest mode and all guest surfaces are gated; no path reaches `fetchWorkout`.
- `show_leaderboard` toggle — wired through EditProfile → `updateProfile` → `profiles`, and respected by the gym-scoped `Leaderboard.jsx` query.

**Confirmed resolved:** `apply-fixes.js` gone; working tree clean (no CRLF noise); `app.getsteel.app` attached and serving.

**steel-landing:** `privacy.html` restyled to match the landing (Inter Tight + JetBrains Mono, cream + lime, STEEL wordmark, mono-caps eyebrow/footer, highlight-bar heading). Content unchanged.

---

## Cleanup still needed (steel-app repo)

- **`apply-fixes.js`** exists in the repo root. Failed patch script. **Delete it.**
- **Line-ending noise:** `git diff HEAD` shows ~4200 lines changed across `store.js`, `Profile.jsx`, and `WorkoutDetail.jsx` — purely CRLF↔LF, zero code changes. Either `git checkout -- src/lib/store.js src/pages/Profile.jsx src/pages/WorkoutDetail.jsx` or add `.gitattributes` with `* text=auto`.
- **`.claude/settings.local.json`** modified in diff. Not meaningful — reset or gitignore.

---

## Current state

### steel-app (the PWA)
- **Latest commit on `main`:** `d334f5f fix: prevent workout loss on tab switch, feed spinner, input validation`
- **Live URL:** https://steel-app-eight.vercel.app
- **Git remote:** https://github.com/adamon3/steel-app.git

### steel-landing (the marketing page)
- **Latest commit on `main`:** `6a66c66 landing: update copy, add profile pics, real map, built in london`
- **Live URL:** https://steel-landing-sigma.vercel.app
- **Git remote:** https://github.com/adamon3/steel-landing.git
- **Local location:** `C:\Users\adamo\OneDrive\Desktop\steel-landing`

### Key file sizes (steel-app)

| File | Lines |
|---|---|
| `src/pages/LogWorkout.jsx` | 2272 |
| `src/pages/WorkoutDetail.jsx` | 931 |
| `src/pages/Profile.jsx` | 785 |
| `src/App.jsx` | 478 |
| `src/lib/store.js` | 404 |

---

## Known issues — not yet fixed

### High priority

1. **Duplicate templates in the template grid.** The "Start Workout" home screen shows duplicate template names (e.g. two "Legs", two "Workout"). Likely a data issue — either duplicates in the `templates` table or the query isn't deduplicating. Hasn't been investigated yet.

2. **WorkoutDetail edit may break likes/comments.** `updateWorkoutFull()` in `store.js` wipes and rebuilds `workout_exercises` + `sets`. If likes or comments reference old `workout_exercise` IDs via foreign keys, they'll be orphaned. Needs a real-world test.

3. **Guest mode can't open WorkoutDetail.** Tapping a workout card in guest mode likely crashes or shows blank — `fetchWorkout()` hits Supabase and guest users have no auth.

### Medium priority

4. **Profile tabs are stale.** Only Stats and Workouts tabs got refreshed. Progress, PRs, Body, and Following tabs use older layouts.

5. **PWA install prompt.** `manifest.json` exists but no service worker (`sw.js`). Offline is localStorage-only.

6. **No "update available" banner.** Users with cached PWA may miss deploys.

### Low priority

7. **BodyStats and Tools components** — likely stale, haven't been tested.

8. **Leaderboard opt-out toggle** — `show_leaderboard` flag exists in schema but UI toggle unverified.

---

## Environment notes

- **Git push from Cowork sandbox doesn't work.** The sandbox mounts the user's folder read-only for the git index. Workaround: use Desktop Commander MCP to write a `.bat` file (e.g. `C:\Users\adamo\push.bat`) and execute it with `shell: "cmd"`.
- **CRLF vs LF.** Host is Windows. Files in the sandbox may get LF line endings while the repo has CRLF. Use Desktop Commander's `edit_block` tool with exact strings copied from the user's machine, or write complete files.
- **Landing page is a separate repo.** Single `index.html` file at `C:\Users\adamo\OneDrive\Desktop\steel-landing`. Not mounted by default — you'll need the user to connect it or use Desktop Commander to read/edit it.
- **Supabase project ID:** `tkrwctmzftnmdspioohw`. Auth + Postgres + Storage. All DB calls go through `src/lib/store.js`.
- **DiceBear avatars on landing page** use the Notionists style from `api.dicebear.com`. If the CDN goes down the avatars will break — could inline the SVGs as a hardening step later.

---

## Domain + email infrastructure

- **Custom domain:** `getsteel.app` (Cloudflare registrar + DNS, account under `Adamon3@yahoo.com`)
  - `getsteel.app` → Vercel `steel-landing` (A `76.76.21.21`)
  - `www.getsteel.app` → same, redirects to apex
  - `app.getsteel.app` → CNAME to Vercel; needs to be added as custom domain in the `steel-app` Vercel project before it serves
- **Mailbox** (`adam@getsteel.app`): Zoho Mail Free, EU data centre. Login at https://mail.zoho.eu. Admin at https://mailadmin.zoho.eu.
  - MX records: `mx.zoho.eu` 10, `mx2.zoho.eu` 20, `mx3.zoho.eu` 50
  - Apex SPF: `v=spf1 include:zoho.eu ~all`
- **Transactional email:** Resend (EU region, account on `adamon3@yahoo.com`)
  - Sends from `hello@getsteel.app` (verified domain, DKIM at `resend._domainkey`)
  - Bounce subdomain: `send.getsteel.app` with its own MX + SPF (`include:amazonses.com`)
  - API key stored in Supabase Vault as `resend_api_key` (id `da91dc4f-9450-42cf-94a9-4f2b7d6633dc`)
  - Resend dashboard: https://resend.com/domains/a87da291-9aeb-4d8a-aca0-7b637725603b
- **DMARC:** `v=DMARC1; p=none; rua=mailto:dmarc@getsteel.app; pct=100; adkim=r; aspf=r;` — relaxed alignment, monitor-only, aggregate reports to `dmarc@getsteel.app`
- **Waitlist signup notifications:** On every INSERT into `public.waitlist`, trigger `waitlist_to_ntfy` fires `public.notify_waitlist_signup()` which:
  1. Pushes a notification to phone via ntfy topic `Steel-sign-free-wait-zaron`
  2. Sends a styled welcome email via Resend (subject "You're in.", from "Steel <hello@getsteel.app>", with lime-highlighted headline + CTA to the web demo)
- **Brand-new-domain reputation:** First ~50 emails may land in spam at Gmail/Yahoo until reputation builds.

---

## What's likely next

The user has been alternating between bug-hunting and landing page polish. The landing page is in good shape now. They may pivot to fixing the known issues above (duplicate templates is the most visible one), continue testing edge cases, or start on new features. Don't start writing code until told what's next — that's in `CLAUDE.md` and they mean it.
