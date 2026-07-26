/**
 * Asset pipeline — run locally with ImageMagick installed, commit the output.
 *
 *   bun run assets
 *
 * Sources live in /assets (never shipped). Optimised derivatives land in
 * /public and are committed, so CI only needs the checked-in files.
 *
 * For every member portrait it emits square AVIF + WebP at the widths the
 * layout actually uses (never upscaling past the source), and prints a
 * dominant accent colour to paste into src/data/members.ts.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SRC_MEMBERS = join(ROOT, "assets", "members");
const OUT_MEMBERS = join(ROOT, "public", "members");
const SRC_LOGO = join(ROOT, "assets", "logo.png");
const OUT_PUBLIC = join(ROOT, "public");

/** Widths the card art is actually rendered at (1x and 2x of the card width). */
const MEMBER_WIDTHS = [400, 800];
const LOGO_WIDTHS = [128, 256];

const magick = (args) => execFileSync("magick", args, { encoding: "buffer" });
const magickText = (args) => execFileSync("magick", args, { encoding: "utf8" }).trim();

function sourceWidth(file) {
  return Number(magickText(["identify", "-format", "%w", file]));
}

/** Widths to emit: everything at or below the source width, capped to no upscale. */
function targetWidths(src, wanted) {
  const w = sourceWidth(src);
  const fits = wanted.filter((x) => x <= w);
  return fits.length > 0 ? fits : [w];
}

/**
 * Pick a vibrant accent from the artwork: quantise to a small palette, then
 * score each entry by how much of the image it covers *and* how saturated it
 * is, so we get the memorable colour rather than a muddy average.
 */
function accentColor(file) {
  const hist = magickText([
    file,
    "-resize", "80x80!",
    "-quantize", "LAB",
    "-colors", "10",
    "-format", "%c",
    "histogram:info:",
  ]);

  let best = null;

  for (const line of hist.split("\n")) {
    const m = line.match(/^\s*(\d+):\s*\([^)]*\)\s*(#[0-9A-Fa-f]{6})/);
    if (!m) continue;

    const count = Number(m[1]);
    const hex = m[2].toLowerCase();
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const light = (max + min) / 2;
    const sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * light - 1));

    // Reject near-black and near-white: they read as background, not identity.
    if (light < 0.12 || light > 0.93) continue;

    const score = Math.sqrt(count) * (0.25 + sat);
    if (!best || score > best.score) best = { hex, score };
  }

  return best?.hex ?? "#5eead4";
}

function encode(src, out, width, { square }) {
  const geometry = square
    ? ["-resize", `${width}x${width}^`, "-gravity", "center", "-extent", `${width}x${width}`]
    : ["-resize", `${width}x${width}>`];

  const base = [
    src,
    "-auto-orient",
    "-strip",
    ...geometry,
    "-colorspace", "sRGB",
    "-filter", "Lanczos",
  ];

  // AVIF at 52 is visually indistinguishable from 62 at the sizes these render
  // at, for ~20% fewer bytes. WebP only serves browsers without AVIF, so it
  // keeps a safer quality.
  magick([...base, "-quality", "52", "-define", "heic:speed=2", `${out}.avif`]);
  magick([...base, "-quality", "80", "-define", "webp:method=6", `${out}.webp`]);
  return [`${out}.avif`, `${out}.webp`];
}

function kb(file) {
  return `${(statSync(file).size / 1024).toFixed(1)}kB`;
}

// ── Member portraits ──────────────────────────────────────────
rmSync(OUT_MEMBERS, { recursive: true, force: true });
mkdirSync(OUT_MEMBERS, { recursive: true });

const accents = [];

for (const file of readdirSync(SRC_MEMBERS).sort()) {
  const src = join(SRC_MEMBERS, file);
  if (!statSync(src).isFile()) continue;

  const slug = basename(file, extname(file));
  const widths = targetWidths(src, MEMBER_WIDTHS);
  const written = [];

  for (const width of widths) {
    written.push(...encode(src, join(OUT_MEMBERS, `${slug}-${width}`), width, { square: true }));
  }

  const accent = accentColor(src);
  accents.push({ slug, accent, widths });

  console.log(
    `portrait ${slug.padEnd(14)} ${kb(src).padStart(8)} -> ` +
      written.map((f) => `${basename(f)} ${kb(f)}`).join(", "),
  );
}

// ── Logo ──────────────────────────────────────────────────────
for (const width of targetWidths(SRC_LOGO, LOGO_WIDTHS)) {
  const written = encode(SRC_LOGO, join(OUT_PUBLIC, `logo-${width}`), width, { square: true });
  console.log(`logo     ${String(width).padEnd(14)} ${written.map((f) => `${basename(f)} ${kb(f)}`).join(", ")}`);
}

// PWA icons must stay raster PNG.
for (const width of [192, 512]) {
  const out = join(OUT_PUBLIC, `logo-${width}.png`);
  magick([
    SRC_LOGO,
    "-auto-orient",
    "-strip",
    "-resize", `${width}x${width}^`,
    "-gravity", "center",
    "-extent", `${width}x${width}`,
    "-colorspace", "sRGB",
    "-define", "png:compression-level=9",
    out,
  ]);
  console.log(`icon     ${String(width).padEnd(14)} ${basename(out)} ${kb(out)}`);
}

// ── Social card (1200x630) ────────────────────────────────────
// JPEG, not PNG: a 1200x630 gradient costs ~500kB as PNG and ~60kB as JPEG,
// and every scraper that reads og:image supports JPEG.
{
  const out = join(OUT_PUBLIC, "og.jpg");
  magick([
    "-size", "1200x630", "gradient:#0d1a1f-#050505",
    // Teal bloom behind the mark.
    "(", "-size", "1200x630", "xc:black",
    "-fill", "#5eead4", "-draw", "circle 600,250 600,410",
    "-blur", "0x110", ")",
    "-compose", "screen", "-composite",
    "(", SRC_LOGO, "-strip", "-resize", "300x300", ")",
    "-gravity", "center", "-geometry", "+0-56", "-compose", "over", "-composite",
    "-fill", "#f2f2f2", "-pointsize", "64", "-gravity", "center",
    "-annotate", "+0+150", "ApeXNOS",
    "-fill", "#5eead4", "-pointsize", "26",
    "-annotate", "+0+215", "A group of friends who happen to be really good at games.",
    "-strip", "-quality", "88", "-sampling-factor", "4:2:0", "-interlace", "JPEG",
    out,
  ]);
  rmSync(join(OUT_PUBLIC, "og.png"), { force: true });
  console.log(`social   ${"og".padEnd(14)} ${basename(out)} ${kb(out)}`);
}

// ── Accent report ─────────────────────────────────────────────
console.log("\nAccents for src/data/members.ts:");
for (const { slug, accent, widths } of accents) {
  console.log(`  ${slug.padEnd(14)} accent: "${accent}"  widths: [${widths.join(", ")}]`);
}
