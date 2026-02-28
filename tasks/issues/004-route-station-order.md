# Issue 004: Sort Route Stations by Subway Order

## Summary
Stations on route detail pages (`/lines/[routeSlug]`) are sorted alphabetically by name instead of in the correct subway order. Fix the build script to use GTFS `stop_sequence` data so stations appear in the order the train actually visits them.

## Context
The `scripts/build-gtfs.ts` script generates `routeStations.json`, which maps each route to its list of station IDs. Currently (lines 441-447), stations are sorted via `localeCompare()` — purely alphabetical. This produces nonsensical orderings (e.g., "103 St" before "125 St" before "14 St").

The GTFS `stop_times.txt` data already includes a `stop_sequence` field (parsed into `GtfsStopTime` at line 51) that defines the correct order of stops along each trip. This data is already loaded but discarded during the station↔route mapping phase (lines 356-370).

No changes are needed to the page component (`src/app/lines/[routeSlug]/page.tsx`) or the data loader (`src/lib/gtfs.ts`) — they already respect the array order from `routeStations.json`.

## Scope
**In scope:**
- Modify `scripts/build-gtfs.ts` to sort `routeStations` entries by `stop_sequence`
- Use one canonical direction (direction_id `"0"`) for consistent ordering
- Handle branching routes (e.g., A train) by using minimum `stop_sequence` per station

**Out of scope:**
- Showing both directions (uptown/downtown) as separate lists
- Showing express-skipped stations
- Any UI or page component changes

## Key Decisions
- **Canonical direction**: Use `direction_id "0"` trips to determine station order. This gives a consistent first-to-last ordering.
- **Branching routes**: For routes with branches (e.g., A train serves different stations on different trips), use the **minimum** `stop_sequence` value across all qualifying trips. This places branched stations as early as possible.
- **Fallback**: Stations that somehow have no `stop_sequence` data (shouldn't happen, but defensive) sort to the end.

## Implementation Plan

1. **Build a trip→direction lookup** (in `scripts/build-gtfs.ts`, after existing `tripRoute` map ~line 346)
   - Create `tripDirection: Map<string, string>` from `trips` array, mapping `trip_id` → `direction_id`

2. **Collect stop_sequence data during the stop_times loop** (modify the existing loop at lines 356-370)
   - Create a new map: `routeStationSequence: Map<string, Map<string, number>>` (route_id → station_id → min stop_sequence)
   - Inside the existing `for (const st of stopTimes)` loop, after resolving `canonicalId`:
     - Look up `direction_id` for the trip via `tripDirection`
     - Only collect sequence data for `direction_id === "0"` trips
     - Track the minimum `stop_sequence` for each (route, station) pair

3. **Sort routeStations by stop_sequence** (replace lines 441-447)
   - Instead of sorting by `localeCompare`, sort by the min `stop_sequence` value from the map
   - Stations without sequence data sort to the end (fallback to `Infinity`)

## Files to Modify
- `scripts/build-gtfs.ts` — (modify) Add stop_sequence collection and use it for sorting

## Acceptance Criteria
- [ ] Stations on route pages appear in correct subway order (first stop to last stop)
- [ ] Branching routes (e.g., A train) show all stations in a reasonable order
- [ ] No changes to page components or data loaders
- [ ] `npm run build:gtfs` completes successfully
