# 002: Prioritize exact route matches in universal search

## Problem

When searching for a single letter or number that exactly matches a subway line (e.g., "Q", "6", "B"), stations often appear above lines in the results. Users searching for the Q line expect to see the Q line first, not stations whose names happen to contain "Q".

## Root Cause

In `src/components/home-search.tsx`, the Stops and Lines sections are ordered by the top MiniSearch relevance score from each section (lines 88-91). MiniSearch's scoring doesn't know that a query like "Q" is an exact match for a route's `shortName` — it just computes generic text relevance, and stations frequently score higher because they have longer text fields with more matching opportunities.

## Solution

Add an exact-match boost for routes: when the search query exactly matches a route's `shortName` (case-insensitive), boost the Lines section score so it always appears above Stops.

### Implementation

**File:** `src/components/home-search.tsx`

In the section-ordering logic (~lines 88-91), after computing `stationsScore` and `routesScore`:

1. Check if the trimmed, lowercased query exactly matches any route's `shortName` (the route letter/number like "Q", "6", "A", "SI", etc.)
2. If there's an exact match, boost `routesScore` to guarantee Lines sorts above Stops (e.g., set it to `Infinity` or `stationsScore + 1`, whichever is cleaner)

This is a minimal change — only the section ordering is affected. Individual result ranking within each section stays the same.

### Test Cases

- Search "Q" → Lines section appears first, showing the Q line
- Search "6" → Lines section appears first, showing the 6 line
- Search "B" → Lines section appears first, showing the B line
- Search "SI" → Lines section appears first, showing the Staten Island Railway
- Search "Union" → Stops section still appears first (no exact route match)
- Search "14" → Stops section still appears first (no route named "14")
