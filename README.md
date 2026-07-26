# ApeXNOS

Single-page site for the ApeXNOS gaming clan. Vanilla TypeScript + Vite, no UI
framework. Deployed to GitHub Pages from `main` at
[apexnos.aspenini.com](https://apexnos.aspenini.com/).

```bash
bun install
bun run dev
```

| Script | What it does |
| --- | --- |
| `bun run dev` | Vite dev server |
| `bun run build` | Typecheck, then production build to `dist/` |
| `bun run preview` | Serve the built `dist/` |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run assets` | Regenerate optimised images (see below) |

## Adding or changing a member

The roster lives in one place: [`src/data/members.ts`](src/data/members.ts).
Card markup is generated from it at build time by
[`build/roster.ts`](build/roster.ts), which substitutes the `<!--@roster-->`
placeholder in `index.html` — so the cards are in the served HTML for crawlers
and for the first paint, with no client-side rendering.

To add someone:

1. Drop a square portrait in `assets/members/<slug>.{jpg,png}`. Sources live
   outside `public/` so the unoptimised original never ships.
2. Run `bun run assets`. It prints the generated widths and a suggested accent
   colour per portrait.
3. Add a line to `members` in `src/data/members.ts` with the slug, the widths
   that were generated, and an accent.

`portrait: null` is fine — those members get a monogram card tinted with their
accent instead.

## Asset pipeline

`bun run assets` runs [`scripts/build-assets.mjs`](scripts/build-assets.mjs),
which **requires [ImageMagick](https://imagemagick.org/) 7 on `PATH`**. It is a
local, occasional step: the derivatives are committed, so CI only ever needs the
checked-in files and does not need ImageMagick.

It produces, from `assets/`:

- `public/members/<slug>-<width>.{avif,webp}` — square portraits at the widths
  the layout uses, never upscaled past the source
- `public/logo-{128,256}.{avif,webp}` — hero mark
- `public/logo-{192,512}.png` — PWA icons, which have to stay raster PNG
- `public/og.jpg` — 1200x630 social card

Re-running it is idempotent. The member portraits directory is rebuilt from
scratch each time, so deleting a source removes its derivatives.

## Notes

- **Motion**: every effect shares one `requestAnimationFrame` loop
  (`src/modules/motion.ts`) and parks itself when nothing is moving, when the
  section scrolls off screen, or when the tab is hidden.
  `prefers-reduced-motion` disables the ambient layers outright.
- **Carousel**: position is a continuous float in slide units rather than an
  integer index, which is what lets a drag track the pointer 1:1 and a flick
  carry momentum. The fan measures itself against the stage and sheds a peek
  rank rather than overflowing the viewport.
- **No JS**: the cards fall back to a static flex grid and the controls hide.
