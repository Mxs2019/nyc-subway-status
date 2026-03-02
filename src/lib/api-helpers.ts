/**
 * Shared helpers for API route handlers.
 * Response envelope builders and arrival formatters.
 */

import { NextResponse } from "next/server";
import type { Arrival } from "./gtfsrt";

interface ApiMeta {
  timestamp: string;
  endpoint: string;
  realtime: boolean;
}

export function apiSuccess(
  data: unknown,
  endpoint: string,
  realtime: boolean = false,
) {
  return NextResponse.json({
    ok: true,
    data,
    _meta: { timestamp: new Date().toISOString(), endpoint, realtime } as ApiMeta,
  });
}

export function apiError(
  code: string,
  message: string,
  endpoint: string,
  status: number = 400,
) {
  return NextResponse.json(
    {
      ok: false,
      error: { code, message },
      _meta: {
        timestamp: new Date().toISOString(),
        endpoint,
        realtime: false,
      } as ApiMeta,
    },
    { status },
  );
}

export function formatArrival(arrival: Arrival, nowSeconds: number) {
  const minutesAway = Math.max(
    0,
    Math.round((arrival.arrivalTime - nowSeconds) / 60),
  );
  return {
    route_id: arrival.routeId,
    trip_id: arrival.tripId,
    direction: arrival.directionId === 0 ? "uptown" : "downtown",
    arrival_time: arrival.arrivalTime,
    arrival_time_iso: new Date(arrival.arrivalTime * 1000).toISOString(),
    minutes_away: minutesAway,
  };
}
