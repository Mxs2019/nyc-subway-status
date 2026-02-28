/**
 * Route bullet — colored circle with route letter/number.
 * Colors come from GTFS route_color/route_text_color.
 */

interface RouteBulletProps {
  shortName: string;
  color: string;
  textColor: string;
  size?: "sm" | "md" | "lg";
  /** Add a white ring for stacked-avatar layouts */
  ring?: boolean;
}

const sizes = {
  sm: "w-5 h-5 text-[10px]",
  md: "w-7 h-7 text-xs",
  lg: "w-9 h-9 text-sm",
};

/** Parse hex color to [r, g, b] (0-255). */
function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Relative luminance per WCAG 2.x. */
function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const MIN_CONTRAST = 4.5;

/**
 * Darken or lighten `bg` just enough to reach 4.5:1 contrast with `fg`.
 * Uses a cache to avoid recomputation. Returns the original color if it
 * already meets the threshold.
 */
const contrastCache = new Map<string, string>();

function ensureContrast(bg: string, fg: string): string {
  const key = `${bg}:${fg}`;
  const cached = contrastCache.get(key);
  if (cached !== undefined) return cached;

  const bgRgb = parseHex(bg);
  const fgRgb = parseHex(fg);

  if (contrastRatio(bgRgb, fgRgb) >= MIN_CONTRAST) {
    contrastCache.set(key, bg);
    return bg;
  }

  // Determine direction: if fg is lighter than bg, darken bg; otherwise lighten.
  const fgLight = luminance(fgRgb) > luminance(bgRgb);
  let lo = 0;
  let hi = 1;
  let bestRgb = bgRgb;

  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const target = fgLight
      ? bgRgb.map((c) => Math.round(c * (1 - mid))) as [number, number, number]
      : bgRgb.map((c) => Math.round(c + (255 - c) * mid)) as [number, number, number];

    if (contrastRatio(target, fgRgb) >= MIN_CONTRAST) {
      bestRgb = target;
      hi = mid;
    } else {
      lo = mid;
    }
  }

  const result = `#${bestRgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  contrastCache.set(key, result);
  return result;
}

export function RouteBullet({
  shortName,
  color,
  textColor,
  size = "md",
  ring = false,
}: RouteBulletProps) {
  const bgColor = ensureContrast(color, textColor);

  return (
    <span
      className={`${sizes[size]} inline-flex items-center justify-center rounded-full font-bold shrink-0 no-underline ${ring ? "ring-2 ring-white" : ""}`}
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {shortName}
    </span>
  );
}
