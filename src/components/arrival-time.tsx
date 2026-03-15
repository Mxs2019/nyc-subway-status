"use client";

import { useNow } from "@/hooks/use-now";

interface ArrivalTimeProps {
  timestamp: number; // Unix timestamp in seconds
}

export function ArrivalTime({ timestamp }: ArrivalTimeProps) {
  const now = useNow();

  const diffMinutes = Math.round((timestamp - now) / 60);

  const absoluteTime = new Date(timestamp * 1000).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  let relative: string;
  if (diffMinutes <= 0) {
    relative = "now";
  } else if (diffMinutes === 1) {
    relative = "1 min";
  } else {
    relative = `${diffMinutes} min`;
  }

  return (
    <span className="tabular-nums" aria-label={`Arriving in ${relative}, at ${absoluteTime}`} aria-live="polite">
      <span className="font-bold">{relative}</span>
      <span className="text-muted ml-2 text-xs">{absoluteTime}</span>
    </span>
  );
}
