"use client";

import { useEffect } from "react";

export function AutoRefresh({ interval = 30000 }: { interval?: number }) {
  useEffect(() => {
    const timer = setInterval(() => {
      window.location.reload();
    }, interval);
    return () => clearInterval(timer);
  }, [interval]);

  return null;
}
