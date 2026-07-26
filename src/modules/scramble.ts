import { addFrameTask, prefersReducedMotion } from "./motion";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&$@/\\<>*";
const CHAR_MS = 55;
const SETTLE_MS = 320;

/**
 * Decode-in effect for the wordmark: each character churns through glyphs and
 * locks in left to right.
 *
 * The final text is already in the HTML and is restored on the last frame, so
 * the real word is what gets indexed and what a screen reader announces; only
 * the pixels are scrambled.
 */
export function initScramble(el: HTMLElement | null): void {
  if (!el) return;

  const final = el.textContent ?? "";
  if (final.length === 0 || prefersReducedMotion()) return;

  // Freeze the layout box in both axes before touching the text. Width alone is
  // not enough: the monospace face used while scrambling has different vertical
  // metrics, so the line box would change height, and because the page centres
  // its content that shift moves everything below it.
  const rect = el.getBoundingClientRect();
  if (rect.width === 0) return;
  el.style.width = `${rect.width}px`;
  el.style.height = `${rect.height}px`;
  el.setAttribute("aria-label", final);

  const chars = [...final];
  const total = chars.length * CHAR_MS + SETTLE_MS;
  // Wall-clock, not accumulated frame deltas: a fixed-duration text effect
  // should take the same time whether or not frames were dropped.
  let start = 0;

  const stop = addFrameTask((_dt, now) => {
    if (start === 0) start = now;
    const elapsed = now - start;

    if (elapsed >= total) {
      el.textContent = final;
      el.classList.add("is-decoded");
      el.style.width = "";
      el.style.height = "";
      el.removeAttribute("aria-label");
      stop();
      return;
    }

    let out = "";
    for (let i = 0; i < chars.length; i++) {
      const locked = elapsed >= i * CHAR_MS + SETTLE_MS;
      out += locked ? chars[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    el.textContent = out;
  });
}
