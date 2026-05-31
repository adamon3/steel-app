# Steel — Next Session Punch List

**Last updated:** 31 May 2026
**Last session covered:** domain swap (landing + welcome email → `app.getsteel.app`), logger pillar copy tightened, first testimonial reworked around gym leaderboard, privacy page wired into footer.

Read `CLAUDE.md` for product context, `HANDOVER.md` for prior session notes + current infra. This file is the punch list for what to do next.

---

## Immediate (before doing anything else)

1. **Attach `app.getsteel.app` in Vercel** — `steel-app` project → Settings → Domains → Add Domain → `app.getsteel.app`. DNS is configured (CNAME → `cname.vercel-dns.com`); Vercel issues SSL in ~60 sec. Until this is done, the demo link on the live landing will 404. The landing's already pointing at the new URL.

2. **Smoke test once Vercel is wired:** visit `https://app.getsteel.app`, sign up via the landing waitlist form, confirm the welcome email arrives with the new CTA link.

---

## Product polish (from prior sessions, ranked)

### Bugs

1. **Duplicate templates** on "Start Workout" home grid. Two "Legs", two "Workout" — either a `templates` table dedup issue or the query is missing a `DISTINCT`. Most visible bug. Hasn't been investigated.

2. **Guest mode crashes `WorkoutDetail`.** `fetchWorkout()` in `store.js` hits Supabase; guest users have no auth so the request fails / page blank-screens. Fix: skip detail-fetch in guest mode and surface a "Sign in to view" CTA, or render the locally cached version.

3. **PWA install banner unverified.** `manifest.json` is in place; never confirmed the install prompt fires on a fresh phone. Worth opening Chrome on a phone-shaped viewport and confirming "Add to Home Screen".

### Stale UI

4. **Profile tabs on old layouts.** Stats and Workouts got the refresh. Progress / PRs / Body / Following are still on older layouts that don't match the rest of the app — bring them in line (cream, lime accents, JetBrains Mono labels, tabular nums).

5. **BodyStats and Tools components** — likely stale. Audit + refresh or remove.

6. **`show_leaderboard` opt-out toggle** — flag exists in `profiles`; UI toggle is unverified. Confirm it's wired into EditProfile and respected by `Leaderboard.jsx`.

### Cleanup (steel-app repo)

7. **`apply-fixes.js`** at repo root is a failed patch script. **Delete it.**
8. **CRLF↔LF line-ending noise** across `store.js`, `Profile.jsx`, `WorkoutDetail.jsx` shows ~4200-line diff with zero code changes. Either `git checkout --` those files or add `.gitattributes` with `* text=auto`.
9. **`.claude/settings.local.json`** — reset or gitignore.

### Landing (steel-landing repo)

10. **Privacy page styling** — `privacy.html` uses system fonts and a different lime token. Doesn't match the rest of the landing. Re-style with Inter Tight + JetBrains Mono + `#BFE600` + cream background if you care.

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
