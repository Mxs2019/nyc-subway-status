"use client";

import { useSyncExternalStore } from "react";

const INTERVAL_MS = 10_000;

let now = Math.floor(Date.now() / 1000);
let listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function startTimer() {
  if (timer) return;
  timer = setInterval(() => {
    now = Math.floor(Date.now() / 1000);
    for (const listener of listeners) listener();
  }, INTERVAL_MS);
}

function stopTimer() {
  if (timer && listeners.size === 0) {
    clearInterval(timer);
    timer = null;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  startTimer();
  return () => {
    listeners.delete(listener);
    stopTimer();
  };
}

function getSnapshot() {
  return now;
}

function getServerSnapshot() {
  return Math.floor(Date.now() / 1000);
}

/**
 * Shared hook that returns the current unix timestamp (seconds),
 * updating every 10 seconds. All consumers share a single timer.
 */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
