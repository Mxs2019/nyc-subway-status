/**
 * Server-side MiniSearch indexes for stations and routes.
 * Mirrors the processTerm + ABBREVIATIONS logic from use-fuzzy-search.ts
 * but runs on the server (no "use client" / React hooks).
 */

import MiniSearch from "minisearch";
import { getStations, getRoutes, type Station, type Route } from "./gtfs";

const ABBREVIATIONS: Record<string, string> = {
  street: "st",
  avenue: "av",
  ave: "av",
  square: "sq",
  boulevard: "blvd",
  parkway: "pkwy",
  train: "",
  line: "",
};

function processTerm(term: string): string | false {
  const lower = term.toLowerCase();
  if (!lower) return false;

  // Strip ordinal suffixes: "72nd" → "72", "1st" → "1"
  const stripped = lower.replace(/^(\d+)(st|nd|rd|th)$/i, "$1");
  if (stripped !== lower) return stripped;

  const mapped = ABBREVIATIONS[lower];
  if (mapped !== undefined) return mapped || false; // "" → false (drop the term)
  return lower;
}

// Lazy singleton indexes
let _stationIndex: MiniSearch<Station> | null = null;
let _routeIndex: MiniSearch<Route> | null = null;

function getStationIndex(): MiniSearch<Station> {
  if (!_stationIndex) {
    _stationIndex = new MiniSearch<Station>({
      fields: ["name"],
      idField: "id",
      processTerm,
      searchOptions: { prefix: true, fuzzy: 0.2, combineWith: "AND" },
    });
    _stationIndex.addAll(getStations());
  }
  return _stationIndex;
}

function getRouteIndex(): MiniSearch<Route> {
  if (!_routeIndex) {
    _routeIndex = new MiniSearch<Route>({
      fields: ["shortName", "longName"],
      idField: "id",
      processTerm,
      searchOptions: { prefix: true, fuzzy: 0.2, combineWith: "AND" },
    });
    _routeIndex.addAll(getRoutes());
  }
  return _routeIndex;
}

export interface SearchResults {
  stations: Station[];
  routes: Route[];
}

export function search(query: string, limit: number = 10): SearchResults {
  if (!query.trim()) return { stations: [], routes: [] };

  const stations = getStations();
  const routes = getRoutes();

  // First try the full query for stations
  let stationResults = getStationIndex().search(query);

  // If no station results, try stripping route-like tokens (e.g., "union square Q" → "union square")
  // This handles queries where a route letter/number prevents station matching
  if (stationResults.length === 0) {
    const routeByShortName = new Set(routes.map((r) => r.shortName.toLowerCase()));
    const terms = query.trim().split(/\s+/);
    const stationTerms = terms.filter((t) => !routeByShortName.has(t.toLowerCase()));
    if (stationTerms.length > 0 && stationTerms.length < terms.length) {
      stationResults = getStationIndex().search(stationTerms.join(" "));
    }
  }

  let routeResults = getRouteIndex().search(query);

  // If the full query didn't match any routes, check for exact route shortName
  // matches among the query terms. This handles "72 st q" → route "Q".
  if (routeResults.length === 0) {
    const routeByShortName = new Map(
      routes.map((r) => [r.shortName.toLowerCase(), r]),
    );
    const terms = query.trim().split(/\s+/);
    const seen = new Set<string>();
    for (const term of terms) {
      const lower = term.toLowerCase();
      const route = routeByShortName.get(lower);
      if (route && !seen.has(route.id)) {
        seen.add(route.id);
        routeResults.push({ id: route.id, score: 1 } as never);
      }
    }
  }

  const stationMap = new Map(stations.map((s) => [s.id, s]));
  const routeMap = new Map(routes.map((r) => [r.id, r]));

  return {
    stations: stationResults
      .slice(0, limit)
      .map((r) => stationMap.get(r.id as string))
      .filter((s): s is Station => s != null),
    routes: routeResults
      .slice(0, limit)
      .map((r) => routeMap.get(r.id as string))
      .filter((r): r is Route => r != null),
  };
}
