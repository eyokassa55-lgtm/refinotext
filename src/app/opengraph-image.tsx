import { ImageResponse } from "next/og";

export const alt = "RefinoText — AI Writing Humanizer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "#0f1110",
          color: "#e8f5ef",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "#1a8f6a",
          }}
        >
          RefinoText
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              fontSize: 72,
              fontWeight: 700,
              lineHeight: 1.05,
              color: "#ffffff",
            }}
          >
            AI Writing Humanizer
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 28,
              lineHeight: 1.4,
              color: "#c8ddd4",
              maxWidth: 900,
            }}
          >
            Turn robotic AI text into natural, human-sounding prose.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
