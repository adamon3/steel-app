# Steel — Handover for Claude Code

You're picking up an existing project. Read this once, then read the actual codebase before writing anything. Most of the context you need is in the code itself — this doc just tells you what's where, what the design language is, and what's currently in flight.

---

## What I'm building

**Steel** is a social fitness app, built on the side. I'm an athlete so I'm a hard user as well as the maintainer.

The pitch: "the gym doesn't have to be a solo sport." Strava-style social, but built for people who lift (and run, and do anything else — we're explicitly not a powerlifters-only app). Free in beta. Differentiator vs Strong/Hevy is the social layer + Steel It (one-tap copy of someone else's workout as a template).

---

## The product right now

**Live URLs**
- App: https://steel-app-eight.vercel.app
- Landing: https://steel-landing-sigma.vercel.app
- Supabase project: `tkrwctmzftnmdspioohw`

**Stack**
- React PWA, Vite, deployed to Vercel
- Supabase (Postgres + Auth + Storage)
- No native — installable via "Add to Home Screen" on iOS/Android
- Zustand for state (`src/lib/store.js`)
- No CSS framework — inline styles using a `COLORS` token system from `src/components/UI.jsx`

**File tree** (approximate)
```
src/
├── App.jsx                  # Top-level routing + state
├── main.jsx                 # React entry point
├── components/
│   └── UI.jsx               # All shared UI: COLORS, Icon, Avatar, Badge, Spinner, BottomTabBar, etc.
├── lib/
│   ├── store.js             # Zustand store, all Supabase calls live here
│   ├── supabase.js          # Client init
│   └── localStorage.js      # Guest mode + offline queue
└── pages/
    ├── Auth.jsx             # Login/signup
    ├── Feed.jsx             # Home — workout feed with WorkoutCard
    ├── Discover.jsx         # Athlete discovery
    ├── LogWorkout.jsx       # The logger + CompletionScreen (THE big component, ~2400 lines)
    ├── Leaderboard.jsx      # Gym + global rankings
    ├── UserProfile.jsx      # Other people's profiles
    ├── GymCommunity.jsx     # Your gym's feed + members
    ├── Profile.jsx          # Your own profile (multi-tab: Stats/Workouts/PRs/...)
    ├── WorkoutDetail.jsx    # Just shipped — full view + edit + delete (NEW)
    ├── BodyStats.jsx        # Body measurements (probably stale)
    └── Tools.jsx            # Calculator stuff
```

---

## Design language — STRICT, do not deviate

I've iterated on these decisions a lot. Don't redo them.

**Theme**
- Light mode is the default. Warm cream background `#FAFAF7`, not pure white.
- Dark mode also exists (toggle lives in App header). `COLORS.isDark` flag drives variants.
- Body text `#0A0A0A`, dim text `#4A4A48`, borders `#E5E5E0`.

**Wordmark — STEEL**
- Bold uppercase sans-serif. `Inter Tight` weight 900, `letter-spacing: 0.04em`, uppercase.
- **NO DOT.** No green dot after the word. We tried it, looked like Deloitte.
- **NO SERIF ITALIC.** We tried lowercase italic "steel" — looked like a magazine. I hated it. Don't bring it back.
- The wordmark appears in: top nav (App.jsx), Auth screen, both phone mockups on the landing, footer of landing.

**Accent color**
- Lime `#BFE600`. Used sparingly: PR badges, primary CTAs, highlight bars BEHIND punchline words.
- The "highlight bar" pattern: in headlines, certain words get `<span class="hl">word</span>` with a `::after` lime block at z-index -1 that sits behind the text like a marker line. This is how we replaced italic-serif-as-emphasis. Used on the landing in headlines.

**Typography**
- Fonts: `Inter Tight` (sans, all weights) + `JetBrains Mono` (data/labels/timecodes/eyebrows).
- Tabular numerals for all stats: `font-variant-numeric: tabular-nums`.
- All-caps mono labels with `letter-spacing: 0.14em` for eyebrows / data labels (e.g. "VOLUME", "SETS", "PR", "LAST · 100×6").

**Phone mockups**
- Light cream screen, dark `#1A1A1A` 8px bezel border, recognizable as device frames.
- Used on the landing to show: hero feed card, logger mid-workout, Steel It popup, leaderboard.

---

## Recent state of every major component

### `LogWorkout.jsx` — recently rebuilt (last big session)
- Phase: `'home'` (Start Workout screen with template grid + Start Empty CTA), `'logging'`, `'complete'`
- Tap + → home (NOT auto-start). Tap "Start empty workout" or pick template → logging
- Top bar: clock btn (left, opens rest panel) | inline title + timer/date | Finish button (right). Optional minimize button next to Finish if `onMinimize` prop + completed sets.
- Cancel link top-left of body (red mono caps), always confirms via discard modal
- Discard modal copy adapts: "You'll lose 3 completed sets" (red Discard btn) vs "Nothing to save yet" (mono Cancel btn)
- Finish flow: tap Finish → either (a) all complete = celebratory modal with lime check circle, "Nice work!" + stats grid, "Save & share" / "One more set" or (b) unfinished sets = warning modal "Finish without these sets?"
- Rest timer: compact 28px bar between sets showing remaining time (taps to expand into Strong-style RestPanel bottom sheet with big timer, Pause/Resume/Reset/Skip, −15/−5/+5/+15, tap to type custom time)
- Skip properly clears `restAnchor` → bar disappears (uses `restAnchor={exIdx, setIdx}` to track which set's rest is active)
- Web Audio ding + `navigator.vibrate(15)` on rest complete and set complete
- Active set highlighted with `card2` bg + border. Completed sets get lime wash (`rgba(191,230,0,0.07)` dark / `0.10` light)
- Auto-populates weight/reps from previous set when checking empty set
- Exercise picker: muscle group pills, search, "+ New" button to create custom exercises (saves to `supabase.from('exercises').insert` with `is_custom: true`, `created_by: user.id`)
- Set types cyclable by tapping `#`: normal/warmup(W orange)/dropset(D purple)/failure(F)
- Swipe left to delete set (60px threshold)
- Per-exercise notes, workout notes, save as template (handler in CompletionScreen too)
- "Back to workout" button in completion screen if user finished by accident
- Bottom Finish/Cancel buttons after exercise list for natural flow
- Timer formats `H:MM:SS` for hours, `M:SS` otherwise
- Enter key on weight → focus reps; Enter on reps → completes set
- **Previous-set hint ("LAST · weight×reps")**: `loadPrevious(exId)` → store `getPreviousSets`. `getPreviousSets` now checks the offline queue FIRST (`getQueuedPreviousSets` in localStorage.js) before hitting Supabase — so a workout you finished moments ago still shows as "LAST" when you re-add the same exercise, even before it has synced. Weights stored/returned in kg; render does `convertWeight`.

### `CompletionScreen` (inside LogWorkout.jsx) — redesigned
- Reached at `phase === 'complete'` after `doSave`. Receives `{workout, onDone, onReopen, unit, onSaveAsTemplate}`.
- Lime celebratory check circle, "Workout complete", duration · exercise count eyebrow.
- 3 stat cards: SETS / VOLUME / PR (PR value goes lime via `COLORS.accentDim` when `prs > 0`).
- **Volume format**: full number with thousands separator + unit, e.g. `8,200 kg` (was the ugly "8.2 k kg"). Same clean format used in the celebratory "Nice work!" finish modal. Don't reintroduce the `/1000` + " k" abbreviation.
- Estimated 1RM list (Epley) per exercise.
- **"Full workout" section**: full set-by-set breakdown of every completed exercise, **expanded by default** (`showBreakdown` defaults `true`, collapsible). This is the "tap into the workout from completion" that was asked for — it lives here, not on the celebratory modal (which fires pre-save, before there's a saved workout to view).
- Save-as-template input, "Back to workout" (`onReopen`), and "Done" (`onDone`).

### `WorkoutDetail.jsx` — just shipped
This is the **brand new** component. It opens as a fullscreen modal from anywhere a workout appears (Feed, Profile, Profile calendar, UserProfile, GymCommunity).

View mode shows: author block, title, date/time/duration, notes, stats strip (sets/volume/PRs), full exercise list with all sets, "Steel this workout" button if not your own.

Edit mode (Edit button top right, only if `workout.user_id === user.id`): rename title, edit notes, edit any set's weight/reps/PR/type, delete sets, add sets, remove exercises, add new exercises, **delete entire workout** (red button at bottom with confirm modal).

Three new store actions back this:
- `fetchWorkout(workoutId)` — full workout with profile, exercises, sets, likes, comments
- `updateWorkoutFull(workoutId, payload)` — wipes & rebuilds workout_exercises + sets (the cleanest way to handle full edits, but might wipe likes/comments tied to old workout_exercise IDs — needs spot-check on first real edit)
- `deleteWorkout(workoutId)` — delete sets, workout_exercises, likes, comments, then workout

State plumbing: `App.jsx` holds `viewWorkoutId` state, mounts `<WorkoutDetail>` modal, passes `onWorkout={handleViewWorkout}` to all surfaces. Cards everywhere have `onClick` to open detail; inner buttons (avatar, like, comment, steel, ⋯ menu) `stopPropagation`.

### Feed.jsx
`WorkoutCard` body is fully tappable now. Like/comment/Steel It buttons on the action bar use `stopPropagation`. Avatar and display name still link to profile.

### Profile.jsx
Multi-tab profile: Stats / Progress / Workouts / PRs / Body / Following. Workouts tab cards are tappable. Calendar selected-day workouts are tappable. ⋯ menu on each card has: View / Edit (opens detail), Quick rename, Make Private/Public, Delete. The deeper edit flow lives in WorkoutDetail.

### UserProfile.jsx
Other people's profiles. Workout cards tappable. "Steel this workout" button still works inside the card via stopPropagation.

### GymCommunity.jsx
Gym feed cards tappable. Avatar/name still link to profile.

### Discover.jsx
Athlete cards only — no workouts here. No changes needed.

### store.js
All Supabase calls live here. Workout-specific actions:
- `saveWorkout`, `_saveWorkoutToSupabase` — for creating new workouts (existing)
- `fetchWorkout`, `updateWorkoutFull`, `deleteWorkout` — new for the detail view
- `steelWorkout` — copy a workout into a template structure (sets `weight: 0` so the steeler enters their own loads)
- `getPreviousSets` — last sets for an exercise; checks the offline queue first, then Supabase
- `toggleLike`, `toggleFollow`
- `fetchFeed` — feed query with deep nested select (now logs query errors instead of swallowing them)

Guest mode: workouts saved to localStorage if `isGuest` or offline. Sync queue gets flushed when user logs in or comes back online.

### localStorage.js
Guest workouts/templates, prefs, WIP-workout autosave, cached exercises, and the offline queue. New: `getQueuedPreviousSets(exerciseId)` — scans the offline queue (newest first) for an exercise's most recent sets, so just-saved-but-not-yet-synced workouts feed the "LAST" hint.

---

## Key product decisions (don't relitigate)

- **Beta is a PWA, not native.** Add-to-Home-Screen instructions are on the landing page. No App Store / Play Store version. Maybe later.
- **Inclusive without being patronising.** "Athletic but not gym-bro." We don't say "for serious lifters" (excludes newcomers) and we don't say "chasing your first pull-up" (patronising). Headline is "The gym doesn't have to be a solo sport." Subhead: "Track your sessions. See what your friends are training. Get better in the company of people who actually push you."
- **Privacy default**: workouts public unless user toggles private. Leaderboards opt-out (with `show_leaderboard` flag in profiles).

---

## Most recent session (logger polish + marketing pass) — June 2026

Focus was making the app look good for a TikTok/marketing video and tightening the logger journey. Shipped:
- **Logger journey aesthetics**: lime dumbbell graphic on the "Ready to lift" pre-start empty state; redesigned `CompletionScreen` (lime check, clean stats, full-workout breakdown expanded by default).
- **3 logger bugs fixed (commit `89266c1`)**: (1) previous sets now show for an exercise you logged earlier the same session, via the offline-queue check in `getPreviousSets`; (2) the full workout breakdown shows by default on completion; (3) volume reads `8,200 kg`, not "8.2 k kg".
- **Demo-data realism** (for the marketing vid): round/believable weights, "BW" instead of `×0kg` on bodyweight moves, seeded follower counts + recent last-active, a stronger lead feed card, real candid athlete photos (Unsplash, not headshots) on Discover + landing.
- **Steel journey**: Discover → profile → "Steel this workout" (full-width footer w/ copy icon) → choose start-now or save-as-template. Template page got workout previews + the warmer card styling.
- **Color/contrast**: added `COLORS.accentDim` (readable lime for text) and `COLORS.accentText` (dark ink for text ON lime). Use these instead of raw `#BFE600` whenever lime carries text. Ambient lime radial-gradient background across pages; desktop is a 520px max-width centered column.
- **Templates**: `updateTemplate` store action + edit/delete/rename via an options popup; fixed grid overflow + duplicate-template saves.

## Currently pending / known issues

1. ~~WorkoutDetail edit needs real-world testing.~~ **Resolved by code review:** `likes` and `comments` FK to `workout_id` (not `workout_exercise_id`), so `updateWorkoutFull`'s wipe-and-rebuild of exercises+sets leaves them untouched.
2. **Profile's other tabs are stale.** Progress / PRs / Body / Following still use older layouts. Stats + Workouts got refreshed (and the privacy_mode segmented control lives in EditProfile).
3. **PWA install banner.** `manifest.json` is in place but the install prompt's reliability on fresh devices isn't verified.
4. ~~Service worker / cache.~~ **Resolved:** `registerType: 'prompt'` + `<UpdatePrompt />` banner using `useRegisterSW`. New SW activations now ask the user to refresh (with skipWaiting) instead of being stuck on the old bundle. **Heads-up:** Adam is often on a stale cached bundle — if something "still isn't fixed," check whether he's applied the update banner / hard-refreshed before re-debugging.
5. ~~Offline-first cache strategy untuned.~~ **Resolved.** Workbox `runtimeCaching` now caches Supabase REST GET (NetworkFirst, 14d), Storage (CacheFirst, 30d), Google Fonts, OSM tiles. Read flows (feed / profile / workouts / templates / exercises) serve from cache when offline. Writes still queue via the existing localStorage path. Saving a workout offline works; logging a fresh one offline works; browsing your recent feed offline works. Likes/comments still fail offline — out of scope for v1.
6. **Two pre-existing JSX warnings** in LogWorkout.jsx (duplicate `min`/`max`/`step` attrs on the weight/reps inputs, ~line 513 & 535). Harmless — build succeeds — but worth cleaning up.

### Workflow / environment notes for the next model
- **Deploys**: push to `main` → Vercel auto-deploys both app and landing. Build locally first to catch errors (`npx vite build` in the repo root).
- **Git from this environment**: commit via the dev-machine shell. Quoting is fragile through the tool wrapper — keep commit messages to a single token with no spaces (e.g. `-m "fix_logger_volume"`), or the words get parsed as pathspecs.
- **Don't**: enter Adam's passwords / log in for him, or permanently delete his workouts/templates (demote via dates and let him delete). He logs in himself.
- **Supabase RLS** on `workouts`: SELECT allowed when `is_public = true OR auth.uid() = user_id`.

---

## How I work (so you can match my pace)

- **Ship fast, iterate.** I'd rather merge something 80% right and tweak it than spend a day on the perfect version.
- **Don't over-explain.** When you finish a task, tell me which files changed, what to drop where, and stop. I don't need a recap of the design thinking unless I ask.
- **Give me copy-pasteable answers.** When suggesting code, give me the full final state of the file or the exact diff, not "here's roughly what to change."
- **Push back when I'm wrong.** I've changed my mind a lot in this build (theme dark→light, logo italic→bold, etc.). If I ask for something that contradicts a recent decision, flag it. Don't just do it.
- **Don't bullshit.** If you don't know whether something will work, say so. If you didn't actually verify a fix, say so. I'd rather have an honest "this is untested" than a confident "this is fixed" that breaks in prod.
- **No comments in code unless they earn their place.** I read the code, I don't need narration.

---

## Suggested first move

Read this doc. Then run:

```bash
git status
git log --oneline -20
ls -R src/
```

Skim `src/App.jsx`, `src/lib/store.js`, `src/pages/LogWorkout.jsx` (logger + CompletionScreen — most recently touched), and `src/pages/WorkoutDetail.jsx` to orient yourself. Then ask me what's next — don't start writing code until I tell you what I want.
