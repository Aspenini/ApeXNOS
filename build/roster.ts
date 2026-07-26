import type { Plugin } from "vite";
import { members, type Member } from "../src/data/members";

const PLACEHOLDER = "<!--@roster-->";

/**
 * The rendered card width, so the browser picks the right srcset entry.
 *
 * Mirrors the CSS: phones use `min(15.5rem, 74vw)`, where the 15.5rem cap wins
 * above a 335px viewport, and desktop tops out at 19rem/1.36 = 14rem. Written
 * with media queries rather than min() so it needs no math-function support.
 */
const SIZES = "(max-width: 335px) 74vw, (max-width: 640px) 15.5rem, 14rem";

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function srcset(slug: string, widths: number[], ext: string): string {
  return widths.map((w) => `/members/${slug}-${w}.${ext} ${w}w`).join(", ");
}

function art(member: Member): string {
  if (!member.portrait) {
    // No portrait on file: fall back to a monogram over the member's accent.
    return `<div class="card-art card-art--mono" aria-hidden="true"><span>${escapeAttr(
      member.name.slice(0, 1).toUpperCase(),
    )}</span></div>`;
  }

  const { portrait, widths } = member;
  const smallest = widths[0]!;

  return `<div class="card-art">
              <picture>
                <source type="image/avif" sizes="${SIZES}" srcset="${srcset(portrait, widths, "avif")}" />
                <source type="image/webp" sizes="${SIZES}" srcset="${srcset(portrait, widths, "webp")}" />
                <img src="/members/${portrait}-${smallest}.webp" alt="" width="${smallest}" height="${smallest}" loading="lazy" decoding="async" draggable="false" />
              </picture>
            </div>`;
}

function card(member: Member, index: number): string {
  const name = escapeAttr(member.name);

  return `<li class="card" data-carousel-slide data-name="${name}" style="--accent: ${member.accent}; --i: ${index}">
            ${art(member)}
            <div class="card-frame" aria-hidden="true"></div>
            <div class="card-sheen" aria-hidden="true"></div>
            <div class="card-specular" aria-hidden="true"></div>
            <div class="card-body">
              <span class="card-name">${name}</span>
              <span class="card-rule" aria-hidden="true"></span>
            </div>
          </li>`;
}

/**
 * Injects the roster markup into index.html at build time. Keeping it in the
 * HTML rather than rendering client-side means the cards are present for
 * crawlers, for the first paint, and with JS disabled.
 */
export function rosterPlugin(): Plugin {
  return {
    name: "apexnos-roster",
    enforce: "pre",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        if (!html.includes(PLACEHOLDER)) {
          // Silently shipping an empty roster would be far worse than failing.
          throw new Error(`roster placeholder ${PLACEHOLDER} not found in index.html`);
        }
        return html.replace(PLACEHOLDER, members.map(card).join("\n          "));
      },
    },
  };
}
