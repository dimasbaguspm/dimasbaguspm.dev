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

/** GitHub-style 1200×630 social preview: name + avatar up top, title big. */
export async function renderOg(title: string): Promise<Buffer> {
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

  const node = h("div", {
    style: {
      display: "flex",
      width: 1200,
      height: 630,
      background: "linear-gradient(135deg, #161b22 0%, #010409 100%)",
      padding: "72px",
      flexDirection: "column",
      justifyContent: "space-between",
    },
    children: [
      h("div", {
        style: { display: "flex", alignItems: "center", gap: "24px" },
        children: [
          avatar &&
            h("img", {
              src: avatar,
              width: 96,
              height: 96,
              style: { borderRadius: 999 },
            }),
          h("div", {
            style: { display: "flex", flexDirection: "column", gap: "4px" },
            children: [
              h(
                "div",
                {
                  style: {
                    display: "flex",
                    color: "#e6edf3",
                    fontSize: 40,
                    fontWeight: 700,
                  },
                },
                profile.name,
              ),
              h(
                "div",
                { style: { display: "flex", color: "#8b949e", fontSize: 24 } },
                `@${profile.login}`,
              ),
            ],
          }),
        ],
      }),
      h(
        "div",
        {
          style: {
            display: "flex",
            color: "#f0f6fc",
            fontSize: title.length > 70 ? 44 : 56,
            fontWeight: 700,
            lineHeight: 1.25,
            maxWidth: 1000,
          },
        },
        title,
      ),
    ],
  });

  const svg = await satori(node, {
    width: 1200,
    height: 630,
    fonts: [{ name: "Inter", data: fontData, weight: 700, style: "normal" }],
  });
  return sharp(Buffer.from(svg)).png().toBuffer();
}
