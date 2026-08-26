import { ImageResponse } from "next/og";

export const alt = "GTA6MAP — Carte interactive GTA VI";
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
          justifyContent: "center",
          padding: 80,
          background: "linear-gradient(135deg, #0b0f14 0%, #1a2230 60%, #3b0a1f 100%)",
          color: "#e6edf3",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              background: "linear-gradient(135deg, #ff2d7a, #c026d3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 48,
              fontWeight: 900,
              color: "#fff",
            }}
          >
            VI
          </div>
          <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -2 }}>GTA6MAP</div>
        </div>
        <div style={{ marginTop: 32, fontSize: 32, color: "#8b98a9" }}>
          Leonida & Vice City — landmarks, collectibles, suivi de complétion
        </div>
      </div>
    ),
    size,
  );
}
