# Performance

## What was optimised

| Optimisation | Where | Why it helps |
| --- | --- | --- |
| FlashList with `masonry` instead of a `ScrollView` | `components/NoteGrid.tsx` | Only the cells near the viewport are mounted, and their views are recycled while scrolling. |
| `memo()` on `NoteCard`, `Avatar`, `LikeButton`, `TagChip` | `components/` | A card whose props did not change is skipped when the list re-renders. |
| Stable callbacks (`useCallback`, React Query's stable `mutate`) | `NoteGrid`, `useNoteActions` | A new function identity on every render would defeat `memo()`. |
| Identity-preserving cache writes | `api/noteCache.ts` | Liking one note creates one new note object; every other note and page keeps its reference, so only one card re-renders. |
| `expo-image` with `cachePolicy="memory-disk"` and `recyclingKey` | `NoteCard`, `Avatar` | Images survive app restarts without re-downloading, and a recycled cell never flashes the previous photo. |
| Image dimensions sent by the API | `NoteImage.width/height` | The card reserves its final height before the image loads, so the masonry layout never shifts. |
| Pull-to-refresh fetches one page | `features/feed/useFeed.ts` | Avoids re-requesting every loaded page. |

**About `estimatedItemSize`:** this project uses FlashList 2.x, where that prop no
longer exists. FlashList 2 measures items itself and does not need a size
estimate. It was a required tuning knob in FlashList 1.x only.

## Measured: Expo web build in headless Chromium

Produced by `apps/mobile/scripts/perf-web.cjs`; raw output in
[`perf-web-results.json`](./perf-web-results.json).

- **Before** = `src/perf/BaselineNoteGrid.tsx` (ScrollView, no memoisation, RN `Image`)
- **After** = the shipped `NoteGrid` (FlashList masonry, memoised cards, expo-image)
- 600 seeded notes, 390×844 viewport, 4× CPU throttle, median of 5 runs,
  images served locally so the network is not part of the measurement.

| Metric | Before | After |
| --- | ---: | ---: |
| Scroll frame rate while infinite-scrolling a fresh feed (15 s at 3000 px/s) | 33 fps | 59.5 fps |
| 95th-percentile frame time during that scroll | 116.7 ms | 16.8 ms |
| Worst frame during that scroll | 383.2 ms | 33.4 ms |
| Total time in frames longer than 50 ms during that scroll | 7367 ms | 0 ms |
| Tap "like" → updated count painted, 500 notes loaded | 551.6 ms | 24.4 ms |
| Note cards mounted with 500 notes loaded | 500 | 15 |
| DOM nodes with 500 notes loaded | 7566 | 308 |
| JS heap with 500 notes loaded | 46.3 MB | 10.3 MB |
| Scroll frame rate over the already-loaded 500 notes (6 s at 3000 px/s) | 60 fps | 60 fps |
| Time to first note card, cold load | 1040 ms | 1021 ms |

Card re-renders when one note is liked, measured in Jest
(`src/perf/__tests__/rerenders.test.tsx`, 20 notes): **20 of 20** before,
**1 of 20** after.

### Reading these numbers honestly

- This is a **browser** measurement of the React Native Web build. It captures
  React render work, layout and memory. It does **not** exercise Hermes, the
  native UI thread, Fabric, or native image decoding/caching, so it is not a
  substitute for a device measurement.
- Two rows did not improve, and that is expected: scrolling an already-rendered
  static list is cheap for a browser compositor in both versions, and the first
  page (20 notes) costs the same to render either way. The baseline's cost
  appears when the list *changes*: appending a page or liking a note re-renders
  every mounted card.
- The benefit of `expo-image`'s disk cache cannot be observed in a browser.

## Not yet measured: real device / simulator

No iOS simulator or Android emulator was available where this was built, so
there are **no device numbers in this repository**. To collect them:

1. Seed 500+ notes: `python -m app.seed --count 600 --reset` and start the API.
2. Build a **release** variant (dev builds are several times slower and not
   representative): `npx expo run:android --variant release` or
   `npx expo run:ios --configuration Release`.
3. Run once with `EXPO_PUBLIC_FEED_IMPL=baseline` and once without it.
4. **Scroll FPS:** open the dev menu → *Perf Monitor* in a dev build for a quick
   look at UI and JS thread FPS; for release builds use
   `adb shell dumpsys gfxinfo com.wenxuewu.glimpse framestats` (Android) or
   Xcode Instruments → *Animation Hitches* (iOS). Scroll the feed for a fixed
   time (the Maestro flow in `.maestro/` gives a repeatable scroll).
5. **Time to first render:** `adb shell am start -W -n com.wenxuewu.glimpse/.MainActivity`
   reports `TotalTime`; on iOS use Instruments → *App Launch*.
6. **Re-renders:** React DevTools → Profiler → record, tap a like, and check
   how many `NoteCard` components committed.

Add the results to this file with the device model, OS version and build type.
