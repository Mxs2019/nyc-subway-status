/**
 * Shared utilities for OG image generation.
 * Uses Satori (via next/og) with Geist Mono Bold font.
 */

import * as fs from "fs";
import * as path from "path";

const FONT_PATH = path.join(
  process.cwd(),
  "src",
  "assets",
  "fonts",
  "GeistMono-Bold.ttf"
);

let _fontData: ArrayBuffer | null = null;

export function getFont(): ArrayBuffer {
  if (!_fontData) {
    _fontData = fs.readFileSync(FONT_PATH).buffer as ArrayBuffer;
  }
  return _fontData;
}

export const OG_SIZE = { width: 1200, height: 630 };
export const BG_COLOR = "#fafafa";
export const TEXT_COLOR = "#0a0a0a";
export const MUTED_COLOR = "#6b7280";

/** Full-bleed container for OG images. */
export function OgContainer({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        backgroundColor: BG_COLOR,
        fontFamily: "GeistMono",
        padding: 60,
      }}
    >
      {children}
    </div>
  );
}

/** Site branding line at bottom of OG images. */
export function OgBranding({ text }: { text?: string }) {
  return (
    <span
      style={{
        fontSize: 22,
        color: MUTED_COLOR,
        marginTop: 20,
      }}
    >
      {text ?? "nycsubwaystatus.com"}
    </span>
  );
}

/** Colored circle route bullet for OG images (inline-flex, Satori-compatible). */
export function OgRouteBullet({
  shortName,
  color,
  textColor,
  size = 64,
}: {
  shortName: string;
  color: string;
  textColor: string;
  size?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: color,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: size * 0.58,
          fontWeight: 700,
          color: textColor,
          lineHeight: 1,
        }}
      >
        {shortName}
      </span>
    </div>
  );
}
