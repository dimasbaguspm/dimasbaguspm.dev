import satori from "satori";
import { createElement as h } from "satori/jsx";
import sharp from "sharp";
import { getProfile } from "./posts";

// Inter 700 TTF — satori needs TTF/OTF (WOFF2 unsupported), fetched once and
// held in memory. On fetch failure we fall back to a solid-color image so the
// OG endpoint never 500s.
let font: Promise<ArrayBuffer | null> | null = null;
function loadFont(): Promise<ArrayBuffer | null> {
  font ??= fetch(
    "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf",
  )
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .catch(() => null);
  return font;
}

function loadAvatar(url: string): Promise<string | null> {
  return fetch(url)
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((b) =>
      b ? `data:image/png;base64,${Buffer.from(b).toString("base64")}` : null,
    )
    .catch(() => null);
}

function trunc(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

/** GitHub-style 1200×630 social preview: avatar + type + title(2 lines) + metadata. */
export async function renderOg(
  title: string,
  subtitle?: string | null,
  meta?: { type?: string | null; author?: string | null; date?: string | null; readingTime?: string | null },
): Promise<Buffer> {
  const profile = await getProfile();
  const [fontData, avatar] = await Promise.all([
    loadFont(),
    loadAvatar(profile.avatar),
  ]);

  if (!fontData) {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#161b22"/></svg>';
    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  const type = meta?.type ?? null;
  const author = meta?.author ?? profile.name;
  const date = meta?.date ?? null;
  const readingTime = meta?.readingTime ?? null;

  // Enforce max 2 lines visually: truncate by chars (satori has no line-clamp)
  // 56px ~33 chars/line → ~66 for 2 lines; 44px allows more. Cap at 110.
  const rawTitle = trunc(title, title.length > 80 ? 110 : 90);
  const rawSubtitle = subtitle ? trunc(subtitle, 120) : null;

  const metaLine = [author && `by ${author}`, date, readingTime].filter(Boolean).join("  •  ");

  const node = h("div", {
    style: {
      display: "flex",
      width: 1200,
      height: 630,
      background: "linear-gradient(135deg, #161b22 0%, #0d1117 55%, #010409 100%)",
      padding: "48px 56px",
      flexDirection: "column",
      justifyContent: "space-between",
    },
    children: [
      // header: avatar + name
      h("div", {
        style: { display: "flex", alignItems: "center", justifyContent: "space-between" },
        children: [
          h("div", {
            style: { display: "flex", alignItems: "center", gap: "16px" },
            children: [
              avatar &&
                h("img", {
                  src: avatar,
                  width: 56,
                  height: 56,
                  style: { borderRadius: 999, border: "2px solid #30363d" },
                }),
              h("div", {
                style: { display: "flex", flexDirection: "column", gap: "2px" },
                children: [
                  h(
                    "div",
                    { style: { display: "flex", color: "#e6edf3", fontSize: 22, fontWeight: 700 } },
                    profile.name,
                  ),
                  h(
                    "div",
                    { style: { display: "flex", color: "#8b949e", fontSize: 16 } },
                    `@${profile.login}`,
                  ),
                ],
              }),
            ],
          }),
          type &&
            h("div", {
              style: {
                display: "flex",
                background: "#238636",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 0.8,
                padding: "6px 12px",
                borderRadius: 999,
                textTransform: "uppercase",
              },
            }, type),
        ],
      }),
      // center: title + subtitle
      h("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          flex: 1,
          justifyContent: "center",
          paddingTop: "24px",
          paddingBottom: "24px",
        },
        children: [
          h("div", {
            style: {
              display: "flex",
              color: "#f0f6fc",
              fontSize: rawTitle.length > 60 ? 46 : 54,
              fontWeight: 700,
              lineHeight: 1.15,
              maxWidth: 1088,
              // satori line clamp via truncation above; keep overflow hidden for safety
              overflow: "hidden",
            },
          }, rawTitle),
          rawSubtitle &&
            h("div", {
              style: {
                display: "flex",
                color: "#8b949e",
                fontSize: 24,
                lineHeight: 1.35,
                maxWidth: 960,
                overflow: "hidden",
              },
            }, rawSubtitle),
        ],
      }),
      // footer: metadata
      h("div", {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: "1px solid #21262d",
          paddingTop: "16px",
        },
        children: [
          h("div", {
            style: { display: "flex", color: "#8b949e", fontSize: 16 },
          }, metaLine || `dimasbaguspm.dev`),
          h("div", {
            style: { display: "flex", color: "#484f58", fontSize: 14 },
          }, "dimasbaguspm.dev"),
        ],
      }),
    ],
  });

  const svg = await satori(node, {
    width: 1200,
    height: 630,
    fonts: [{ name: "Inter", data: fontData, weight: 700, style: "normal" }],
  });
  return sharp(Buffer.from(svg)).png().toBuffer();
}
