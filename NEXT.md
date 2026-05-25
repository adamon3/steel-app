# Steel — Next Session Punch List

**Date:** 25 May 2026
**Last session covered:** landing polish, identity scrub, domain (`getsteel.app`), Zoho mailbox, Resend transactional email, ntfy phone notifications on signup, welcome email automation, OSM attribution, DMARC reporting.

Read `CLAUDE.md` for product context, `HANDOVER.md` for prior session notes + current infra. This file is the punch list for what to do next.

---

## Outstanding from last session (quick wins)

1. **Add `app.getsteel.app` as custom domain in Vercel** for the `steel-app` project. DNS is already configured (CNAME → `cname.vercel-dns.com`). One click in Vercel dashboard → Settings → Domains → Add Domain → `app.getsteel.app`. Vercel auto-issues SSL in ~60 sec.

2. **After (1), switch the demo URL everywhere from `steel-app-eight.vercel.app` → `app.getsteel.app`.** Three places to update:
   - **Welcome email** (Resend, sent via Supabase trigger): edit the `notify_waitlist_signup()` function in Supabase — both the `text` and `html` bodies contain `steel-app-eight.vercel.app`. Replace with `app.getsteel.app`.
   - **Landing page** (`steel-landing/index.html`): grep for `steel-app-eight.vercel.app`, replace. Used in the hero CTA, nav, and the final CTA section.
   - **In-app links** if any.

3. **Resend reputation:** First ~50 welcome emails will likely land in spam at Gmail/Yahoo. Don't panic. Tell early signups to mark "Not spam" — that's the only fix. Builds naturally as engagement accumulates.

4. **DMARC tightening:** Currently `p=none` (monitor only). After ~30 days of clean aggregate reports landing at `dmarc@getsteel.app` (catch-all Zoho mailbox), upgrade to `p=quarantine` then `p=reject`. Not urgent.

5. **Resend suppression list:** `adam@getsteel.app` is on Resend's suppression list (anti-loopback rule that kicks in when sending FROM your domain TO an address on the same domain). Cosmetic — only matters for internal tests. To re-enable: Resend dashboard → Suppressions → remove.

---

## Product polish (from prior HANDOVER + CLAUDE.md)

Ranked by visibility/severity. Pick what feels worth shipping.

### Bugs

1. **Duplicate templates in "Start Workout" home screen.** The grid shows duplicate template names (two "Legs", two "Workout"). Either a data dedup issue in the `templates` table or the query is missing `DISTINCT` somewhere. Visible to every user, top priority.

2. **Guest mode crashes when opening `WorkoutDetail`.** `fetchWorkout()` in `store.js` hits Supabase; guest users have no auth so the request fails / page blank-screens. Fix: either skip detail-fetch in guest mode (show local cached version only) or surface a clear "Sign in to view" CTA.

3. **PWA install banner unverified.** `manifest.json` exists but never tested the install prompt on a fresh device. Worth opening Chrome on a phone-shaped viewport and confirming the "Add to Home Screen" prompt appears.

### Stale UI

4. **Profile tabs on old layouts.** Only Stats and Workouts tabs got the refresh. Progress, PRs, Body, Following still use older layouts that don't match the rest of the app. Bring them in line with the design language (cream, lime accents, JetBrains Mono labels, tabular nums).

5. **BodyStats and Tools components** likely stale, haven't been opened recently. Audit + refresh or remove.

6. **Leaderboard opt-out toggle:** `show_leaderboard` flag exists in the `profiles` schema but the UI toggle isn't verified. Confirm it's wired in EditProfile and respects the flag in `Leaderboard.jsx`.

---

## Nice-to-haves / longer-term

- **Web demo CTA on welcome email** could include a screenshot or the lime "Steel It" pill graphic. Right now it's typography-only.
- **Inline DiceBear avatar SVGs** on the landing — currently fetched from `api.dicebear.com` per request; if CDN goes down, every mockup breaks.
- **Service worker offline-first** is wired (per CLAUDE.md). Likes/comments still fail offline — out of scope for v1 per CLAUDE.md but flag for later.
- **App Store / Play Store** version. Currently PWA-only. CLAUDE.md says "maybe later" — a Capacitor/React Native wrapper is the cheapest path if/when wanted.

---

## Credentials inventory (for reference)

All set up under a single `adamon3` identity (user chose to stay with this — not fully anon, just not branded "Adam"):

| Service | Account | Notes |
|---|---|---|
| GitHub | `adamon3` | Repos: `steel-app`, `steel-landing`. Commits authored as `Adamon3 <adamon3@yahoo.com>`. |
| Vercel | Linked to GitHub | Projects `steel-app`, `steel-landing` |
| Cloudflare | `Adamon3@yahoo.com` | Registrar + DNS for `getsteel.app` |
| Supabase | (linked) | Project `tkrwctmzftnmdspioohw`. Resend key in vault as `resend_api_key` |
| Zoho Mail (EU) | `adam@getsteel.app` | Free plan, web at https://mail.zoho.eu |
| Resend | `adamon3@yahoo.com` (via GitHub OAuth) | Domain `getsteel.app` verified. EU region. |
| ntfy.sh | Topic `Steel-sign-free-wait-zaron` | No account. Anyone with topic name can publish/subscribe. |

**Live URLs:**
- Landing: https://getsteel.app (also https://steel-landing-sigma.vercel.app)
- App PWA: https://steel-app-eight.vercel.app (and `app.getsteel.app` once user adds it in Vercel)

---

## Suggested first move for next session

```bash
git status
git log --oneline -20
```

Pick the duplicate-templates bug — most visible, contained scope. Or knock out the Vercel `app.getsteel.app` add + URL swap (15 min total).

Don't start writing code until told what to work on. Past me has changed direction a lot.
