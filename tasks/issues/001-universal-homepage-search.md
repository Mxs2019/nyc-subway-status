# Issue 001: Universal Homepage Search

## Summary
Replace the tabbed Stops/Lines search on the homepage with a single universal search that shows results from both categories simultaneously in two sections, ordered by relevance.

## Context
The homepage currently uses a tabbed interface (`HomeSearch` component) that forces users to pick between Stops and Lines before searching. This adds friction — users should be able to type anything and immediately see matching stops and lines together.

The `useFuzzySearch` hook already runs both searches in parallel but only displays one based on the active tab. We need to surface both simultaneously and use MiniSearch scores to decide which section appears first.

## Scope
**In scope:**
- Remove tabbed UI from HomeSearch
- Show both Stops and Lines sections when query is non-empty
- Cap each section at 5 results
- Order sections by top MiniSearch score (most relevant section first)
- Modify `useFuzzySearch` to return top score alongside items

**Out of scope:**
- "See all" / "Browse" links from search results
- Combined/intermingled results list (sections stay separate)
- Changes to /stops or /lines pages

## Key Decisions
- **Section ordering**: Compare `topScore` from each `useFuzzySearch` call. Higher score section renders first. This means typing "A" will likely show Lines first (exact match on shortName), while "Union" shows Stops first.
- **Empty query**: Show nothing below the input — clean minimal state.
- **No matches**: Show "No results found." (no browse links).
- **Max results**: 5 per section, no expansion mechanism.
- **Hook change**: `useFuzzySearch` returns `{ items: T[], topScore: number }` instead of `T[]`. This is a breaking change to the 2 other callers (`SearchFilter`, any future consumers) that must be updated.

## Implementation Plan

1. **Modify `src/hooks/use-fuzzy-search.ts`**
   - Change return type from `T[]` to `{ items: T[], topScore: number }`
   - When query is empty, return `{ items, topScore: 0 }`
   - When query has results, extract `results[0]?.score ?? 0` as `topScore`
   - When query has no results, return `{ items: [], topScore: 0 }`

2. **Update `src/components/search-filter.tsx`**
   - Destructure new return shape: `const { items: filtered } = useFuzzySearch(...)`
   - Pass `filtered` to `children()` as before — no other changes needed

3. **Rewrite `src/components/home-search.tsx`**
   - Remove: `tab` state, `Tab` type, tab buttons, tab-conditional rendering
   - Keep: `query` state, `routeMap`, both `useFuzzySearch` calls
   - Destructure both searches to get `{ items, topScore }` for each
   - Update input placeholder to `"Search stops and lines..."`
   - When `query` is empty: render nothing below input
   - When `query` is non-empty:
     - Build an array of two section renderers (stops section, lines section)
     - Sort by `topScore` descending so higher-relevance section renders first
     - Only render sections that have results
     - Each section: small muted uppercase heading ("Stops" / "Lines"), then `<ul>` with up to 5 items
     - Station rows: same layout (name left, route bullets right)
     - Line rows: same layout (bullet + long name)
   - When both sections are empty: show "No results found."

## Files to Modify
- `src/hooks/use-fuzzy-search.ts` — (modify) change return type to include topScore
- `src/components/search-filter.tsx` — (modify) destructure new return shape
- `src/components/home-search.tsx` — (modify) rewrite as universal search

## Acceptance Criteria
- [ ] Empty homepage shows just the search input, nothing below
- [ ] Typing a station name shows a "Stops" section with up to 5 matches
- [ ] Typing a line letter/name shows a "Lines" section with up to 5 matches
- [ ] When both match, the section with the higher-relevance first result appears on top
- [ ] Each section capped at 5 results
- [ ] No matches shows "No results found."
- [ ] SearchFilter component still works correctly on /stops and /lines pages
