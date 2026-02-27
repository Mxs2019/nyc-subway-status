"use client";

import Link from "next/link";
import type { Route } from "@/lib/gtfs";
import { RouteBullet } from "./route-bullet";
import { SearchFilter } from "./search-filter";

interface RouteListProps {
  routes: Route[];
}

export function RouteList({ routes }: RouteListProps) {
  return (
    <SearchFilter
      items={routes}
      filterFn={(route, query) =>
        route.shortName.toLowerCase().includes(query) ||
        route.longName.toLowerCase().includes(query)
      }
      placeholder="Filter lines..."
    >
      {(filtered) => (
        <ul className="divide-y divide-border">
          {filtered.map((route) => (
            <li key={route.id} className="py-2">
              <Link
                href={`/lines/${route.slug}`}
                className="flex items-center gap-3 no-underline hover:opacity-70"
              >
                <RouteBullet
                  shortName={route.shortName}
                  color={route.color}
                  textColor={route.textColor}
                />
                <span className="text-sm">{route.longName}</span>
              </Link>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="py-4 text-muted text-sm">No lines found.</li>
          )}
        </ul>
      )}
    </SearchFilter>
  );
}
