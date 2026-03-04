export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "\u2014";
  if (minutes === 0) return "Arriving";
  if (minutes === 1) return "1 min";
  return `${minutes} min`;
}
