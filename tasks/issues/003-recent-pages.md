# Issue 003: Recent Pages on Homepage

## Summary
Track recently visited stops, lines, and arrival pages in localStorage and display them on the homepage beneath the search input when there's no active search query.

## Context
After issue 001, the homepage shows just a search input with nothing below it when the user hasn't typed anything. This issue fills that empty state with a "Recents" section so returning users can quickly jump back to pages they've visited before. Since all navigation uses `<a>` tags (full page loads), tracking must happen on mount of each tracked page.

## Scope
**In scope:**
- Track visits to all 3 page types: `/stops/[slug]`, `/lines/[slug]`, `/stops/[slug]/lines/[slug]`
- Store recent visits in localStorage (type + slugs + timestamp)
- Display up to 10 recents on the homepage when search is empty
- Deduplication: revisiting a page moves it to the top

**Out of scope:**
- Boosting recent items in search results
- Clear/manage recents UI
- Persisting across devices (localStorage only)

## Key Decisions
- **Minimal storage**: Store only `{ type, stationSlug?, routeSlug?, timestamp }` per entry. Look up display info (names, colors, route bullets) from the GTFS data already passed to `HomeSearch` as props. This keeps localStorage small and display data always in sync with GTFS updates.
- **localStorage key**: `nyc-subway-recents`
- **Max stored entries**: 10 (matches display limit, no need to store more)
- **Dedup key**: `type + stationSlug + routeSlug` — same page revisited replaces the old entry and moves to top
- **Tracking mechanism**: A `<RecentTracker>` client component added to each of the 3 tracked server-component pages. It calls the `useTrackRecentPage` hook on mount to record the visit.
- **Graceful degradation**: If localStorage is unavailable (private browsing, quota), silently skip — no errors, no recents shown.

## Implementation Plan

1. **Create `src/hooks/use-recent-pages.ts`**
   - Define the `RecentPage` type:
     ```ts
     type RecentPageType = "stop" | "line" | "arrival";
     interface RecentPage {
       type: RecentPageType;
       stationSlug?: string;
       routeSlug?: string;
       timestamp: number;
     }
     ```
   - `STORAGE_KEY = "nyc-subway-recents"`, `MAX_RECENTS = 10`
   - Export `trackRecentPage(page: Omit<RecentPage, "timestamp">)`: reads current list from localStorage, removes any existing entry with the same dedup key, prepends new entry with `Date.now()` timestamp, trims to `MAX_RECENTS`, writes back. Wrapped in try/catch for localStorage errors.
   - Export `getRecentPages(): RecentPage[]`: reads and parses from localStorage, returns `[]` on any error.
   - Export `useTrackRecentPage(page: Omit<RecentPage, "timestamp">)`: a hook that calls `trackRecentPage` in a `useEffect` on mount (empty deps + the page identity).

2. **Create `src/components/recent-tracker.tsx`**
   - `"use client"` component
   - Props: `{ type: RecentPageType; stationSlug?: string; routeSlug?: string }`
   - Calls `useTrackRecentPage` with the props
   - Renders nothing (`return null`)

3. **Add `<RecentTracker>` to the 3 tracked pages**

   **`src/app/stops/[stationSlug]/page.tsx`** — add near the top of the return JSX:
   ```tsx
   <RecentTracker type="stop" stationSlug={station.slug} />
   ```

   **`src/app/lines/[routeSlug]/page.tsx`** — add near the top of the return JSX:
   ```tsx
   <RecentTracker type="line" routeSlug={route.slug} />
   ```

   **`src/app/stops/[stationSlug]/lines/[routeSlug]/page.tsx`** — add near the top of the return JSX:
   ```tsx
   <RecentTracker type="arrival" stationSlug={station.slug} routeSlug={route.slug} />
   ```

4. **Update `src/components/home-search.tsx`** to display recents
   - Import `getRecentPages` and `RecentPage` type
   - Use `useState` + `useEffect` to load recents from localStorage on mount (avoids SSR hydration mismatch)
   - When `query` is empty and recents exist, render a "Recents" section:
     - Heading: `"Recents"` (same `text-xs font-bold uppercase tracking-wider text-muted` style)
     - For each recent entry, look up display data from the `stations`/`routes` props:
       - **stop**: Find station by slug, render station name + route bullets (same as search stops row)
       - **line**: Find route by slug, render route bullet + long name (same as search lines row)
       - **arrival**: Find station + route by slugs, render like: `RouteBullet` + `"StationName"` (link to `/stops/[slug]/lines/[slug]`)
     - Skip entries where the station/route can't be found (stale data after GTFS update)
     - Each entry links to the appropriate page

## Files to Modify
- `src/hooks/use-recent-pages.ts` — (new) localStorage read/write logic + tracking hook
- `src/components/recent-tracker.tsx` — (new) client component that tracks visits, renders nothing
- `src/app/stops/[stationSlug]/page.tsx` — (modify) add `<RecentTracker>`
- `src/app/lines/[routeSlug]/page.tsx` — (modify) add `<RecentTracker>`
- `src/app/stops/[stationSlug]/lines/[routeSlug]/page.tsx` — (modify) add `<RecentTracker>`
- `src/components/home-search.tsx` — (modify) render recents section when query is empty

## Acceptance Criteria
- [ ] Visiting a station page records it in localStorage
- [ ] Visiting a line page records it in localStorage
- [ ] Visiting an arrival page records it in localStorage
- [ ] Homepage shows up to 10 recents below the search input when no query is entered
- [ ] Recents disappear when user starts typing (search results take over)
- [ ] Revisiting a page moves it to the top of recents (no duplicates)
- [ ] Stale entries (station/route removed after GTFS update) are silently skipped
- [ ] Works correctly when localStorage is unavailable (no errors, no recents shown)
