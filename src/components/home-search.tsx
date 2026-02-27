"use client";

import Link from "next/link";
import { useState } from "react";
import type { Route, Station } from "@/lib/gtfs";
import { RouteBullet } from "./route-bullet";

interface HomeSearchProps {
  stations: Station[];
  routes: Route[];
}

export function HomeSearch({ stations, routes }: HomeSearchProps) {
  const [query, setQuery] = useState("");
  const q = query.toLowerCase();

  const filteredStations = q
    ? stations.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 8)
    : [];

  const filteredRoutes = q
    ? routes
        .filter(
          (r) =>
            r.shortName.toLowerCase().includes(q) ||
            r.longName.toLowerCase().includes(q)
        )
        .slice(0, 8)
    : [];

  const hasResults = filteredStations.length > 0 || filteredRoutes.length > 0;

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search stations or lines..."
        className="w-full border border-border px-3 py-2 text-sm bg-white focus:outline-none focus:border-foreground"
        autoFocus
      />

      {q && hasResults && (
        <div className="mt-3 border border-border divide-y divide-border">
          {filteredRoutes.length > 0 && (
            <div className="p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
                Lines
              </p>
              <ul className="space-y-1">
                {filteredRoutes.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/lines/${r.slug}`}
                      className="flex items-center gap-2 text-sm no-underline hover:opacity-70 py-1"
                    >
                      <RouteBullet
                        shortName={r.shortName}
                        color={r.color}
                        textColor={r.textColor}
                        size="sm"
                      />
                      {r.longName}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {filteredStations.length > 0 && (
            <div className="p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
                Stations
              </p>
              <ul className="space-y-1">
                {filteredStations.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/stops/${s.slug}`}
                      className="text-sm no-underline hover:opacity-70 py-1 block"
                    >
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {q && !hasResults && (
        <p className="mt-3 text-muted text-sm">No results found.</p>
      )}
    </div>
  );
}
