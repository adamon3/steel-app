# Steel — Next Session Punch List

**Last updated:** 31 May 2026
**Last session covered:** domain swap (landing + welcome email → `app.getsteel.app`), logger pillar copy tightened, first testimonial reworked around gym leaderboard, privacy page wired into footer.

Read `CLAUDE.md` for product context, `HANDOVER.md` for prior session notes + current infra. This file is the punch list for what to do next.

---

## Immediate (before doing anything else)

1. ~~**Attach `app.getsteel.app` in Vercel.**~~ **Done.** Domain attached and serving — `https://app.getsteel.app` resolves to the app (verified 31 May).

2. **Smoke test (partly done):** `https://app.getsteel.app` confirmed serving the app. Still on Adam: sign up via the landing waitlist form and confirm the welcome email arrives with the new CTA link (lands on Adam's side via ntfy + Resend).

---

## Product polish (from prior sessions, ranked)

### Bugs

1. ~~**Duplicate templates** on "Start Workout" home grid.~~ **Fixed (31 May).** Not a query/render bug — real duplicate rows. `saveTemplate` always INSERTed; now it detects a same-name template and prompts to overwrite or rename (`{conflict}` return + `{overwrite:true}` rebuild path). Exact-duplicate rows cleaned from the DB (kept one of each; left genuinely-distinct same-name templates). Commit `8e659f5`.

2. ~~**Guest mode crashes `WorkoutDetail`.**~~ **Not a bug (verified 31 May).** `handleViewWorkout` in App.jsx already guards (`if (isGuest) promptAuth(...)`), and every guest surface is gated behind `AuthGate` with no tappable real workout cards — no path reaches `fetchWorkout`. Rendering guests' local workouts would be a new feature, not a fix.

3. **PWA install banner unverified.** `manifest.json` is in place; never confirmed the install prompt fires on a fresh phone. Worth opening Chrome on a phone-shaped viewport and confirming "Add to Home Screen".

### Stale UI

4. **Profile tabs on old layouts.** Stats and Workouts got the refresh. Progress / PRs / Body / Following are still on older layouts that don't match the rest of the app — bring them in line (cream, lime accents, JetBrains Mono labels, tabular nums).

5. **BodyStats and Tools components** — likely stale. Audit + refresh or remove.

6. ~~**`show_leaderboard` opt-out toggle.**~~ **Verified wired (31 May).** Toggle in EditProfile saves via `onSave(form)` → `updateProfile(form)` → `profiles.show_leaderboard`. `Leaderboard.jsx` filters both `privacy_mode='normal'` and `show_leaderboard !== false` (single gym-scoped query, no global path that bypasses it).

### Cleanup (steel-app repo)

7. ~~**`apply-fixes.js`**~~ **Done** — already gone from repo root (verified 31 May).
8. ~~**CRLF↔LF line-ending noise.**~~ **Resolved** — working tree is clean on Windows (verified 31 May); no stray line-ending diff remains.
9. ~~**`.claude/settings.local.json`.**~~ **Resolved** — not showing as modified.

### Landing (steel-landing repo)

10. ~~**Privacy page styling.**~~ **Done (31 May).** `privacy.html` restyled to match: Inter Tight + JetBrains Mono, cream `#FAFAF7`, lime `#BFE600`, STEEL wordmark linking home, mono-caps eyebrow + footer, lime highlight-bar on the heading. Content unchanged.

---

## Infra reminders (no work needed, just heads-up)

- **Resend reputation.** First ~50 welcome emails may land in spam at Gmail/Yahoo. Tell early signups to mark "Not spam". Builds naturally.
- **DMARC.** Currently `p=none` (monitor only) with aggregate reports to `dmarc@getsteel.app`. After ~30 days of clean reports, upgrade to `p=quarantine` then `p=reject`. Not urgent.
- **Resend suppression list.** `adam@getsteel.app` is on the suppression list (anti-loopback rule). Cosmetic — only matters for internal tests. Remove via Resend dashboard → Suppressions.

---

## Nice-to-haves / longer-term

- **Inline DiceBear avatar SVGs** on the landing — currently fetched from `api.dicebear.com` per request; if their CDN dies, every mockup breaks.
- **Welcome email CTA could include a screenshot** or the lime "Steel It" pill graphic. Right now it's typography-only.
- **Service worker / offline.** Read flows work offline (Workbox runtimeCaching, per CLAUDE.md). Likes/comments still fail offline — out of scope for v1.
- **App Store / Play Store** — PWA-only for now. Capacitor wrapper is the cheapest path if/when wanted.

---

## Credentials inventory (unchanged)

| Service | Account | Notes |
|---|---|---|
| GitHub | `adamon3` | Repos: `steel-app`, `steel-landing`. Author `Adamon3 <adamon3@yahoo.com>`. |
| Vercel | Linked to GitHub | Projects `steel-app`, `steel-landing` |
| Cloudflare | `Adamon3@yahoo.com` | Registrar + DNS for `getsteel.app` |
| Supabase | (linked) | Project `tkrwctmzftnmdspioohw`. Resend key in vault as `resend_api_key` |
| Zoho Mail (EU) | `adam@getsteel.app` | Free plan, https://mail.zoho.eu |
| Resend | `adamon3@yahoo.com` via GitHub OAuth | Domain `getsteel.app` verified. EU region. |
| ntfy.sh | Topic `Steel-sign-free-wait-zaron` | No account; topic is the secret. |

**Live URLs:**
- Landing: https://getsteel.app (and https://steel-landing-sigma.vercel.app)
- App PWA: https://app.getsteel.app (pending Vercel domain attachment) — currently still reachable at https://steel-app-eight.vercel.app

---

## Suggested first move for next session

```bash
git status
git log --oneline -20
```

Then either: (a) attach `app.getsteel.app` in Vercel + smoke-test, or (b) crack the duplicate-templates bug (most user-visible). Both are contained, sub-hour tasks.

Don't start writing code until told what to work on.
