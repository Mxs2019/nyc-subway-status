"use client";

import { useEffect, useState } from "react";

interface ArrivalTimeProps {
  timestamp: number; // Unix timestamp in seconds
}

export function ArrivalTime({ timestamp }: ArrivalTimeProps) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 10_000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const diffSeconds = timestamp - now;
  const diffMinutes = Math.round(diffSeconds / 60);

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
    <span className="tabular-nums">
      <span className="font-bold">{relative}</span>
      <span className="text-muted ml-2 text-xs">{absoluteTime}</span>
    </span>
  );
}
