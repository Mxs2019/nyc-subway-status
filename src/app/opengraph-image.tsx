import { ImageResponse } from "next/og";
import {
  getFont,
  OG_SIZE,
  OgContainer,
  OgBranding,
  OgRouteBullet,
  TEXT_COLOR,
} from "@/lib/og";

export const runtime = "nodejs";
export const alt = "NYC Subway Status — Real-time subway arrival times";
export const size = OG_SIZE;
export const contentType = "image/png";

const SHOWCASE_BULLETS = [
  { shortName: "1", color: "#EE352E", textColor: "#FFFFFF" },
  { shortName: "A", color: "#0039A6", textColor: "#FFFFFF" },
  { shortName: "7", color: "#B933AD", textColor: "#FFFFFF" },
  { shortName: "L", color: "#A7A9AC", textColor: "#000000" },
  { shortName: "N", color: "#FCCC0A", textColor: "#000000" },
  { shortName: "G", color: "#6CBE45", textColor: "#FFFFFF" },
  { shortName: "B", color: "#FF6319", textColor: "#FFFFFF" },
  { shortName: "Q", color: "#FCCC0A", textColor: "#000000" },
];

export default function Image() {
  return new ImageResponse(
    (
      <OgContainer>
        <div
          style={{
            display: "flex",
            gap: 16,
            marginBottom: 40,
          }}
        >
          {SHOWCASE_BULLETS.map((b) => (
            <OgRouteBullet
              key={b.shortName}
              shortName={b.shortName}
              color={b.color}
              textColor={b.textColor}
              size={72}
            />
          ))}
        </div>

        <span
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: TEXT_COLOR,
            letterSpacing: "-0.02em",
          }}
        >
          NYC Subway Status
        </span>

        <OgBranding text="Real-time arrival times for every station and line" />
      </OgContainer>
    ),
    {
      ...size,
      fonts: [
        {
          name: "GeistMono",
          data: getFont(),
          style: "normal",
          weight: 700,
        },
      ],
    }
  );
}
