import { escapeHtml } from "../utils";

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(
  a: [number, number, number],
  b: [number, number, number]
): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const MIN_CONTRAST = 4.5;

function ensureContrast(bg: string, fg: string): string {
  const bgRgb = parseHex(bg);
  const fgRgb = parseHex(fg);
  if (contrastRatio(bgRgb, fgRgb) >= MIN_CONTRAST) return bg;

  const fgLight = luminance(fgRgb) > luminance(bgRgb);
  let lo = 0;
  let hi = 1;
  let bestRgb = bgRgb;

  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const target = (
      fgLight
        ? bgRgb.map((c) => Math.round(c * (1 - mid)))
        : bgRgb.map((c) => Math.round(c + (255 - c) * mid))
    ) as [number, number, number];

    if (contrastRatio(target, fgRgb) >= MIN_CONTRAST) {
      bestRgb = target;
      hi = mid;
    } else {
      lo = mid;
    }
  }

  return `#${bestRgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export function renderRouteBullet(
  name: string,
  color: string,
  textColor: string,
  size: "sm" | "md" | "lg" = "md"
): string {
  const adjustedBg = ensureContrast(color, textColor);
  const sizeClass = size === "md" ? "" : ` ${size}`;
  return `<span class="route-bullet${sizeClass}" style="background:${escapeHtml(adjustedBg)};color:${escapeHtml(textColor)}">${escapeHtml(name)}</span>`;
}
