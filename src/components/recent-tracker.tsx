"use client";

import { useTrackRecentPage, type RecentPageType } from "@/hooks/use-recent-pages";

interface RecentTrackerProps {
  type: RecentPageType;
  stationSlug?: string;
  routeSlug?: string;
}

export function RecentTracker({ type, stationSlug, routeSlug }: RecentTrackerProps) {
  useTrackRecentPage({ type, stationSlug, routeSlug });
  return null;
}
