import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "NYC Subway Status — Real-time subway arrival times";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          backgroundColor: "#0a0a0a",
          gap: 40,
        }}
      >
        {/* Q Subway Bullet */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 180,
            height: 180,
            borderRadius: "50%",
            backgroundColor: "#F6BC26",
          }}
        >
          <span
            style={{
              fontSize: 110,
              fontWeight: 700,
              color: "#000000",
              lineHeight: 1,
            }}
          >
            Q
          </span>
        </div>

        {/* Site Title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-0.02em",
            }}
          >
            NYC Subway Status
          </span>
          <span
            style={{
              fontSize: 24,
              color: "#a0a0a0",
            }}
          >
            Real-time arrival times for every station and line
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
