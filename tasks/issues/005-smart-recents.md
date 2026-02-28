# Issue 005: Smart Recents with Frequency Scoring and Grouped Display

## Summary
Upgrade the recents algorithm from pure recency to a frequency+recency weighted score, and break the flat list into 3 grouped sections (Stops, Lines, Arrivals) for easier scanning.

## Context
Issue 003 introduced basic recents tracking with pure most-recent-first ordering. This works but has two problems: (1) a single one-off visit displaces frequently-visited pages, and (2) a flat mixed list is hard to scan when you have stops, lines, and arrivals interleaved.

## Scope
**In scope:**
- Add `visitCount` to the stored `RecentPage` entries
- Implement frequency+recency scoring algorithm
- Migrate old entries without `visitCount` (default to 1)
- Increase max stored entries from 10 → 20
- Group recents display into 3 sections: Stops, Lines, Arrivals
- Sort each section by score (highest first)
- Cap display at 5 items per section; hide empty sections

**Out of scope:**
- Clear/manage recents UI
- Boosting recents in search results
- Any UI changes beyond the grouping (styling stays the same)

## Key Decisions
- **Scoring formula**: `score = frequencyScore * 0.6 + recencyScore * 0.4`
  - `frequencyScore = Math.min(visitCount / 5, 1)` — caps at 5 visits (0 to 1)
  - `recencyScore = Math.max(0, 1 - (ageMs / SEVEN_DAYS_MS))` — linear decay over 7 days (0 to 1)
  - Effect: a page visited 3 times beats a single one-off visit even if the one-off was more recent
- **Migration**: Old entries without `visitCount` field get `visitCount: 1` when read from localStorage. No explicit migration step needed.
- **Storage increase**: 20 entries stored (up from 10) to ensure enough data to populate 3 sections after scoring
- **Section order**: Fixed — Stops, Lines, Arrivals (not dynamic based on content)
- **Max per section**: 5 items displayed per section

## Implementation Plan

1. **Update `src/hooks/use-recent-pages.ts`**
   - Add `visitCount: number` to the `RecentPage` interface
   - Change `MAX_RECENTS` from 10 to 20
   - Update `trackRecentPage()`:
     - When deduplicating, if a matching entry exists, carry forward its `visitCount + 1`
     - New entries start with `visitCount: 1`
     - Still prepend and trim to MAX_RECENTS
   - Update `getRecentPages()`:
     - After parsing, normalize entries: if `visitCount` is missing, default to 1
   - Add new export `getScoredRecents()`:
     - Calls `getRecentPages()`
     - Computes score for each entry using the formula above
     - Returns entries sorted by score descending

2. **Update `src/components/home-search.tsx`**
   - Import `getScoredRecents` instead of `getRecentPages`
   - In the `useEffect`, call `getScoredRecents()` instead of `getRecentPages()`
   - Replace the single "Recents" section with 3 grouped sections:
     - Filter recents by type into `stops`, `lines`, `arrivals` arrays
     - For each non-empty group, render a section with its heading ("Stops", "Lines", "Arrivals")
     - Each section shows up to 5 items, sorted by score (already sorted from `getScoredRecents`)
     - Individual item rendering stays the same (station name + bullets, route bullet + name, etc.)
   - Wrap all 3 sections in a container with the "Recents" heading above

## Files to Modify
- `src/hooks/use-recent-pages.ts` — (modify) add visitCount, scoring logic, migration
- `src/components/home-search.tsx` — (modify) grouped section display

## Acceptance Criteria
- [ ] Revisiting a page increments its visitCount in localStorage
- [ ] New entries start with visitCount of 1
- [ ] Old entries without visitCount are treated as visitCount 1 (no crash, no data loss)
- [ ] Recents are sorted by frequency+recency score, not pure recency
- [ ] A page visited 3+ times stays in the list even after 5-6 one-off visits to other pages
- [ ] Recents display is grouped into Stops, Lines, Arrivals sections
- [ ] Each section shows up to 5 items
- [ ] Empty sections are not displayed
- [ ] Up to 20 entries stored in localStorage
