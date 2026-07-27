# Steel — App Store handover

Goal: get Steel into the iOS App Store and the Google Play Store without rebuilding it from scratch.

This doc is written for whoever picks up this work next (future me, another dev, another Claude session). It assumes zero prior context beyond "Steel is a workout app that lives at steel-app-eight.vercel.app and I want it on the stores."

---

## Current state

- **Stack:** React 18 + Vite + Zustand + Supabase (Postgres + Auth + Storage + Realtime).
- **PWA:** installable via Add-to-Home-Screen. Service worker with workbox runtime caching. Works offline for logging + browsing.
- **Deployed:** Vercel → `steel-app-eight.vercel.app`. Landing at `steel-landing-sigma.vercel.app`.
- **Supabase project:** `tkrwctmzftnmdspioohw`. Anon key baked into JS bundle (public by design; RLS enforced).
- **Repo layout:** everything's in this one repo. `src/` is the React app; `supabase-*.sql` files are the migrations already applied to prod.
- **User count:** small (real beta users measured in tens, waitlist growing).

The app is genuinely used. Migration must not break existing accounts, existing workouts, existing offline queues.

---

## Three paths to the stores

| Path | Time to shelf | Native feel | Code reuse | Cost |
|---|---|---|---|---|
| **A. PWABuilder / Capacitor wrap** | 1–2 weeks | Webview (mediocre) | ~95% | Apple Dev $99/yr, Play $25 one-off |
| **B. React Native + Expo** | 4–8 weeks | Excellent | ~40% (business logic reuses, UI rewrite) | Same store fees |
| **C. Swift + Kotlin native** | 3–6 months | Best possible | ~0% (full rewrite) | Same, plus dev time |

**Recommended: staged A → B.** Ship Capacitor now to test whether App Store presence actually moves the needle. If it does (real installs, real retention), invest in the Expo rewrite for the long term. If it doesn't, you spent one week not three months.

**Not recommended: C.** Solo dev + hobby project ≠ Swift/Kotlin from scratch.

---

## Path A: Capacitor wrap (recommended first step)

Capacitor bundles the existing React app as a native shell that runs the web code inside a `WKWebView` (iOS) / `WebView` (Android). Same JS runtime, same Supabase, same everything — just packaged as `.ipa` and `.apk`.

### What breaks and needs fixing

1. **Service worker.** Capacitor serves files from `capacitor://` on iOS, not `https://`. Workbox runtime caching config in `vite.config.js` filters by URL origin — that filter needs `https:` origins swapped for both `capacitor:` and `https:`. Or move offline caching to native (Capacitor Preferences + Http plugins) — cleaner.
2. **Auth callbacks.** Supabase's auth deep-link callbacks currently go to Vercel URLs. Need a custom URL scheme (`steel://auth-callback`) registered in `Info.plist` / `AndroidManifest.xml`, plus the corresponding entry in Supabase Dashboard → Auth → URL Configuration.
3. **Safe areas.** Add `viewport-fit=cover` (already set) plus CSS `env(safe-area-inset-*)` on the top bar and bottom tab bar (already partially done). Double-check on iPhone 15 Pro notch and Dynamic Island.
4. **Keyboard.** iOS keyboard covers form inputs at the bottom of the screen. Use `@capacitor/keyboard` to shift the viewport or add padding when keyboard opens.
5. **Haptics.** `navigator.vibrate` doesn't work on iOS. Swap for `@capacitor/haptics` (`Haptics.impact({ style: ImpactStyle.Light })`).
6. **Push notifications.** Web `Notification` API doesn't work when app is backgrounded on iOS. Need `@capacitor/push-notifications` + APNs (iOS) + FCM (Android) setup. Store push token per-user in `profiles` (new column `push_token`).
7. **Nominatim on gym map.** May hit CORS restrictions in webview — verify. If broken, proxy through a Supabase Edge Function.
8. **App Store 4.7 risk.** Apple rejects apps that are "primarily web content." Mitigate by leaning on native features that don't work in Safari: push notifications, HealthKit integration (import bodyweight), background sync, camera for progress pics. Add at least one of these before submitting.

### Implementation steps

```bash
# in the existing repo
npm i @capacitor/core @capacitor/cli
npx cap init "Steel" "com.steel.app"
npm run build                # produces dist/
npx cap add ios              # requires macOS or GitHub Actions with macos-latest runner
npx cap add android          # works on Windows
npx cap copy                 # sync web assets into native projects
npx cap open ios             # opens Xcode
npx cap open android         # opens Android Studio
```

**No Mac?** Options:
- Rent one for a day on MacInCloud ($20).
- Use **Ionic AppFlow** or **EAS Build** for cloud iOS builds (~$0–$100/month).
- Use GitHub Actions with a `macos-latest` runner to build the `.ipa` in CI.

### Native features to add BEFORE first submission

- **Push notifications** for rest timer completion (already wired for web; port to Capacitor push).
- **HealthKit import** for bodyweight (iOS) / Google Fit (Android). Small feature, huge "why native" credibility with Apple review.
- **Share sheet** to share a workout to Instagram/Messages. `@capacitor/share`.

### App Store submission checklist

- [ ] Apple Developer account ($99/yr, up to a week for verification)
- [ ] Google Play Developer account ($25 one-off, ~2 days for verification)
- [ ] App icon at 1024×1024 (already have 512, just upscale/redraw)
- [ ] Launch screen (native splash, not the web loader)
- [ ] Screenshots: iPhone 6.7" (mandatory), 6.1" (recommended), iPad (optional). Take from a real device or use Simulator.
- [ ] App name (30 chars): "Steel: Workouts with friends" or similar
- [ ] Subtitle (30 chars): "The gym doesn't have to be solo"
- [ ] Description (up to 4000 chars): reuse the landing copy, less em-dashes
- [ ] Keywords (100 chars, comma-separated): workout tracker, gym log, powerlifting, personal records, PRs, strong, lifting…
- [ ] Category: Health & Fitness
- [ ] Age rating: 4+ (no user-generated content beyond text comments)
- [ ] **Privacy policy URL** (required). Draft one — the app collects email, workout data, gym location (opt-in), device push token. Boilerplate template + your specifics.
- [ ] Support URL
- [ ] Marketing URL (landing page)
- [ ] Demo account (Apple reviewers need to log in): create `demo@steel.app` / a random password, seed with a few workouts
- [ ] Review notes: explain that the app is a social workout tracker; social features require log-in

Expect **1–3 rejection cycles** before acceptance. Common reasons: 4.7 (web content), 5.1.1 (missing privacy policy), 4.3 (spam / low quality). Budget 2 weeks between "ready to submit" and "live in store."

---

## Path B: Expo React Native (when Capacitor proves the market)

Only worth doing if Capacitor ships, gets real users, and you want the app to feel genuinely native (smoother scroll, real modals, no webview lag).

- **What reuses:** Zustand store, Supabase queries, business logic in `store.js`, all the workout math, all the migrations.
- **What rewrites:** every `.jsx` in `src/pages/` and `src/components/`. Inline `<div style={...}>` becomes `<View style={...}>`, `<span>` becomes `<Text>`, scrollable containers become `<ScrollView>` or `<FlatList>`. `localStorage` becomes `@react-native-async-storage/async-storage`. Web `Notification` becomes Expo Notifications. Router (currently ad-hoc via `tab` state) probably wants to become `expo-router`.
- **Estimated:** 4–8 focused weeks depending on how much of the logger you can lift-and-shift.
- **Cloud build:** EAS Build handles iOS + Android without a Mac. Free tier: 30 builds/month.

---

## Android is easier

Android accepts hybrid apps like Capacitor without the App Store 4.7-style scrutiny. Ship Path A → Play Store first if you want a quick confidence win.

---

## What NOT to touch

- **Supabase schema.** It's already in prod with real user data. If you need changes, add a new migration file next to the existing `supabase-migration-*.sql` scripts.
- **Anon key.** Baked into the bundle. That's fine — RLS protects. Don't accidentally check in the service_role key.
- **Waitlist table.** Notification trigger fires on insert (ntfy.sh topic `steel-signups-7k9x2qp4mr`). Keep it working.
- **Rest timer / WIP recovery.** Recently rebuilt after a real data-loss bug in beta. Don't undo the queue-first save pattern or the `steel_wip_workout` localStorage key.

---

## Suggested first-week plan

**Day 1** — Buy Apple Dev account + Google Play account. Both take a few days to verify; get them queued immediately.

**Day 2–3** — `npx cap init` and get the app booting inside iOS Simulator (borrow a Mac / rent one). Fix the obvious safe-area and auth-callback issues.

**Day 4–5** — Wire push notifications (rest timer end). Add HealthKit bodyweight import as the "why native" feature.

**Day 6–7** — Assemble screenshots, write App Store metadata, draft privacy policy, submit.

**Week 2** — Play Store submission runs in parallel (easier). Handle Apple's first rejection round.

**Week 3–4** — Live on both stores.

---

## Open questions for the next session

1. Does Adam already have an Apple Developer account or is that day 1?
2. Mac access, or fully remote / cloud-build path?
3. Which "why native" feature do we lead with — push, HealthKit, or something else? (Recommend push since we already ship the web version and it's rest-timer critical.)
4. In-app purchases planned? (Currently free. Apple takes 30% of any IAP. If Steel goes freemium later, that's a whole separate design conversation about what's premium and what's free.)
5. Rename "Steel" for App Store search? Steel is a generic-heavy keyword; App Store SEO may favour a more distinctive name in the App Store title (subtitle can carry "Steel").
