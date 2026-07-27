# Steel — App Store handover

## Where we're at

**The decision is made: Steel is going native.**

Steel has been a React PWA since day one. It's live at `steel-app-eight.vercel.app`, has a real (small) beta user base, a growing waitlist, and a proven feature set. That's done its job. The final home is the **iOS App Store** and **Google Play Store**, shipped as a proper native app that a stranger can install with one tap.

**Nothing native has been built yet.** No Xcode, no Expo project, no `steel-native` repo. This document is Day 0. Whoever picks up next opens VS Code, `npx create-expo-app`, and starts.

**Constraints shaping the plan**:
- Dev works on Windows. No Mac available or wanted.
- The current web UI is fine but not the final look. The rewrite is also a redesign, not just a port.
- The web app stays live during and after the migration. It's the fallback while native is in review, and the "try it in your browser" demo path from the landing page.

The rest of this doc is how to get from here to "live on both stores."

---

This doc is written for whoever picks up this work next (future me, another dev, another Claude session). It assumes zero prior context beyond "Steel is a workout app that lives at steel-app-eight.vercel.app and I want it on the stores."

---

## Current state

- **Stack:** React 18 + Vite + Zustand + Supabase (Postgres + Auth + Storage). Web only.
- **PWA:** installable via Add-to-Home-Screen. Service worker with workbox runtime caching.
- **Deployed:** Vercel → `steel-app-eight.vercel.app`. Landing at `steel-landing-sigma.vercel.app`.
- **Supabase project:** `tkrwctmzftnmdspioohw`. Anon key baked into JS bundle (public by design; RLS enforced).
- **User count:** small but real. Waitlist growing (`waitlist` table in Supabase; ntfy topic `steel-signups-7k9x2qp4mr` pings on insert).
- **Constraints on the dev:** Windows machine, no Mac, no dedicated designer.

The app is genuinely used. Migration must not break existing accounts or workouts.

---

## The path: Expo React Native + EAS Build

Chosen because:
- **No Mac needed.** Expo's EAS Build spins up iOS build machines in the cloud. Development, testing, submission — all doable from Windows.
- **Adam wants to redesign anyway.** Since we're not preserving the current inline-style React UI, the "Capacitor wrap it" argument for keeping the web code disappears. The tradeoff flips: rewriting the UI in React Native components (`<View>`, `<Text>`, `<Pressable>` etc.) buys us a genuinely native feel, real modals, real haptics, real gesture handling, and a proper starting point for design.
- **Lowest App Store rejection risk.** Guideline 4.7 catches webview-wrapper apps; a real RN app doesn't trigger it.
- **Reuses business logic wholesale.** All of `src/lib/store.js`, the Supabase queries, the 1RM math, the WIP recovery — all straight ports.

Skipped alternatives (previous versions of this doc considered these; here for context):
- **Capacitor wrap** — good on paper, but painful without a Mac and doesn't solve the "UI needs redoing" problem.
- **PWABuilder** — fastest possible but very likely to hit App Store 4.7 rejection.
- **Native Swift + Kotlin** — solo dev + hobby project ≠ two full rewrites.

---

## Phase 0: Design pass (do this BEFORE writing any RN code)

The current web UI is functional but was built by iterating on inline styles. A native app needs a real design system. This phase takes ~1 week and saves ~2 weeks of code churn later.

### What to keep from the current identity

- **Wordmark**: `STEEL`, Inter Tight 900, uppercase, letter-spacing 0.04em. Do not resurrect the italic-lowercase serif attempt.
- **Accent**: lime `#BFE600` on light surfaces, darker olive `#6B8A00` for text on cream, black-on-lime for buttons.
- **Type**: Inter Tight for display + body, JetBrains Mono for data / labels / timecodes. Tabular numerals everywhere for stats.
- **Surface**: warm cream `#FAFAF7` (light) / near-black `#0A0A0A` (dark), not pure white/black.
- **Voice**: athletic but not gym-bro. Concrete, punchy, no problem-setup pitch framing.

### What to redesign

- **Bottom tab bar**: currently inline-styled with an offset centre button. Rebuild with `expo-router`'s Tabs and native `Pressable`. Keep the lime centre "Log" button; use native icons via `@expo/vector-icons`.
- **Cards**: standardise border-radius (14 for cards, 8 for inner items, 999 for pills). Use one card component with variants, not inline `<div style={{}}>` every time.
- **Modals & sheets**: replace fixed-position overlays with `@gorhom/bottom-sheet` for actions/pickers, `Modal` for confirmations. Big UX upgrade for the finish flow, exercise picker, and rest panel.
- **Rest timer**: currently a lime-fill pill on a dark background inline in the set list. Native version should probably be a floating bottom banner that stays visible even when scrolling the exercise list.
- **Charts**: current SVG line charts are OK but rewrite with `victory-native` or `react-native-svg` primitives for gesture support (tap a point, see the workout).
- **Empty states**: fine as-is, port them.

### Recommended UI kit

**Tamagui** — universal (web + iOS + Android from the same components), compiler-optimised, native design tokens. Steel could then still have a web landing/preview alongside the mobile app if useful. Steepest learning curve of the options.

Alternatives:
- **gluestack-ui v2** — headless components, less magic than Tamagui, easier to eject from.
- **NativeBase** — mature but heavier, less styling flexibility.
- **Roll your own** — build a small `<Text>`, `<Card>`, `<Button>` set from RN primitives + a `theme.ts` tokens file. Cleanest, most work.

Recommend Tamagui unless the LTV of "web parity" is zero, in which case roll your own.

### Design deliverables before writing code

- Figma or similar: Log Workout flow, Feed, Profile stats + calendar, Workout detail, Gym map + join, Privacy modes
- Token file (colors, spacing, radii, font sizes) that maps cleanly to the code
- One reference screen fully polished (recommend the Log Workout logging screen — it's the hardest one)

---

## Phase 1: Scaffolding (week 1)

```bash
# Windows works fine
npx create-expo-app@latest steel-native --template
cd steel-native
npx expo install expo-router @react-navigation/native
npx expo install @gorhom/bottom-sheet react-native-reanimated react-native-gesture-handler
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
npx expo install expo-notifications expo-haptics expo-secure-store expo-linking
```

Directory layout roughly:
```
steel-native/
├── app/                    # expo-router routes
│   ├── (tabs)/
│   │   ├── feed.tsx
│   │   ├── discover.tsx
│   │   ├── log.tsx
│   │   ├── gym.tsx
│   │   └── profile.tsx
│   ├── workout/[id].tsx
│   └── _layout.tsx
├── lib/
│   ├── supabase.ts         # ported from src/lib/supabase.js
│   ├── store.ts            # ported from src/lib/store.js
│   └── storage.ts          # AsyncStorage + SecureStore replacements
├── components/             # design system components
└── theme.ts                # tokens
```

### Direct ports from the web app

These files convert almost 1:1 to TS + slight API tweaks:
- `src/lib/store.js` → `lib/store.ts` (swap zustand's `persist` middleware to AsyncStorage adapter)
- `src/lib/localStorage.js` → `lib/storage.ts` (AsyncStorage for user data, SecureStore for auth tokens)
- `src/lib/supabase.js` → `lib/supabase.ts` (swap `localStorage` for AsyncStorage in auth persistence)
- All migration files in `supabase-migration-*.sql` — leave alone, they're already applied to prod. Same Supabase project serves both web and mobile.

### What needs real rewrites

- All `src/pages/*.jsx` — these were the UI; redo in RN with the new design system.
- All `src/components/UI.jsx` — same.
- `App.jsx` bottom tab bar — replace with expo-router `<Tabs>`.
- Workbox service worker — gone. Replace runtime cache with `@tanstack/react-query` or SWR with AsyncStorage persistence.
- Web `Notification` API — replace with `expo-notifications`.
- `navigator.vibrate` → `expo-haptics`.

---

## Phase 2: Screens (weeks 2–5)

Build order (motivated by what unblocks the rest):

1. **Auth** — Supabase auth with SecureStore token persistence. Sign up, sign in, sign out.
2. **Log Workout** (the hardest screen; do it first while you're fresh)
   - Exercise picker with the same search normalisation
   - Set rows with weight/reps inputs, PR detection, bodyweight `+kg` mode
   - Rest timer (floating banner, native buzz, expo-notifications on background)
   - WIP recovery (port `steel_wip_workout` pattern to AsyncStorage)
   - Save flow: same queue-first pattern, background sync
3. **Feed** — workout cards, like/comment (comment sheet), Steel It.
4. **Workout detail** — view + edit + delete.
5. **Profile** — stats, workouts list, calendar, PRs, following. Calendar heatmap from `react-native-calendar-heatmap` or custom.
6. **Discover** — athlete list with follow.
7. **Gym** — map with `react-native-maps`, Nominatim search, join/leave.
8. **Settings + Privacy modes**.

---

## Phase 3: Native features that justify "not just a website" (week 6)

App Store review specifically looks for whether the app does things a website can't. Ship at least one from each column:

**Cheap, high impact:**
- Real push notifications for rest timer completion (works when app is backgrounded, which is the whole point)
- Native share sheet from a workout ("share to Instagram / Messages")
- Haptic feedback on set completion, PR, and rest timer end

**Bigger, one-of-these-is-plenty:**
- HealthKit integration (iOS): read bodyweight, write workout sessions
- Google Fit integration (Android)
- Native camera for progress photos + before/after (also great for the feed)
- Live Activities on iOS for the rest timer (this is the killer feature — appears on the lock screen)

Recommend push + haptics + Live Activities for rest timer if time allows. That last one is the "why native" pitch for both users and reviewers.

---

## Phase 4: EAS Build + submission (week 7)

### One-time setup

- Sign up: `eas.dev`. Free tier: 30 builds/month, unlimited for internal distribution.
- Apple Developer account: `developer.apple.com/programs`. $99/year, verification 1–7 days. Start this on day 1 of Phase 0 — everything else waits on it.
- Google Play Console: `play.google.com/console`. $25 one-off, verification ~2 days.

### Build + upload

```bash
eas login
eas build:configure                    # creates eas.json
eas build --platform ios --profile production
# Cloud spins up macOS runner, produces .ipa, uploads to your EAS dashboard
eas submit --platform ios              # posts to App Store Connect
eas build --platform android --profile production
eas submit --platform android
```

### App Store Connect (all web-based, no Mac needed)

- App name (30 chars): "Steel · Workouts, together" or similar. Steel alone is a hard search keyword to rank on.
- Subtitle (30 chars): "The gym doesn't have to be solo"
- Description (up to 4000 chars): reuse landing copy, tighten em-dashes
- Keywords (100 chars): `workout tracker, gym log, powerlifting, 1RM, personal records, PRs, lifting, training, gym feed, community`
- Category: Health & Fitness
- Age rating: 4+ (comments are the only UGC; add report/block if reviewers push back)
- **Privacy policy URL** (mandatory): draft covers email collection, workout data, gym location (opt-in), device push token
- Support URL, Marketing URL (landing page)
- **Demo account for reviewers**: seed `demo@steel.app` with a gym, some workouts, followers
- Review notes: explain that social features need log-in; here's the demo account

### Screenshots

Required sizes for iOS 2024+:
- iPhone 6.7" (Pro Max, mandatory) — 1290×2796
- iPhone 6.5" (recommended) — 1242×2688
- iPad 12.9" (only if targeting iPad)

Take with a real device (borrow one) or from the Simulator (`⌘S` in iOS Simulator, but that needs a Mac). Cloud alternative: `Xcode Cloud` snapshots, or Screenshots.pro / Previewed.app for mocked-in-device shots.

Recommended shots (5 max per size):
1. Log workout mid-set with rest timer
2. Feed with a friend's PR
3. Gym map with pins
4. Personal records list
5. Leaderboard with "You" highlighted

### Expected timeline once submitted

- Apple review: 24–72 hours for first review
- Rejection cycle likely on first submission. Common reasons: 4.7 (mitigated by Phase 3), 5.1.1 (privacy policy details), 2.1 (missing metadata). Budget 1–2 rounds.
- Live on store: 1–2 weeks from first submission.

Google Play is easier and usually accepts within 24 hours.

---

## What NOT to touch during the migration

- **Supabase schema**. Prod data. Add new migration files if changes needed; never rewrite existing ones.
- **Anon key**. Public by design; RLS protects. Do not commit the service_role key.
- **Waitlist table + ntfy trigger**. The signup notification pipeline works; keep it running.
- **The web app**. Leave `steel-app-eight.vercel.app` deployed until the native app hits parity — the landing page still links there under "Or try the web beta now →". Web serves as the fallback while native is in review, and as the "no app store" demo for anyone who wants to try before installing.

---

## Suggested first-week plan

**Day 1**
- Apply for Apple Developer account (this is the long pole — start immediately)
- Sign up for EAS at expo.dev
- Read the Expo docs on `expo-router` and `expo-notifications`

**Day 2–3**
- Design pass in Figma (or equivalent): one polished reference screen (Log Workout logging), plus token file
- Pick UI kit (default: Tamagui) or decide to roll your own

**Day 4–5**
- Scaffold `steel-native` with Expo + expo-router
- Port `lib/store.ts`, `lib/supabase.ts`, `lib/storage.ts` from the web app
- Build the theme layer

**Day 6–7**
- First screen (Feed is easiest starting point; it's mostly read-only)
- Run on your phone via Expo Go, iterate

Then Phase 2 builds out from there over 4 more weeks.

---

## Open questions to answer before starting

1. **Apple Developer account status?** (Application takes days; start immediately regardless.)
2. **Design pass: solo, hire, or use a starter kit?** (Solo works if Adam has taste — the web app already has decent taste. Hiring for a week gets a proper Figma. Starter kit like Rork or Tamagui's Bento saves weeks.)
3. **Which "why native" feature ships in v1?** (Recommend: push notifications for rest timer + iOS Live Activities. Skip HealthKit v1, save for v1.1.)
4. **Rename in App Store search?** "Steel" alone is very generic. Consider "Steel Workouts" or "Steel · Gym Log" in the App Store title for keyword ranking. Subtitle carries the positioning.
5. **In-app purchases planned?** Currently free. Apple takes 30% of any IAP. If Steel goes freemium later, that's a whole separate design + Supabase billing conversation.
6. **App name conflict check?** Search "Steel" on the App Store before submitting. If there's a well-known app already called Steel, decide now whether to rename to avoid confusion + rejection risk.
