import { addFrameTask, clamp, damp, hasFinePointer, prefersReducedMotion } from "./motion";

/**
 * Drifting mote field with a constellation web, on one canvas.
 *
 * This replaces 28 separately-animated DOM nodes: those each got their own
 * compositor layer and kept the main thread busy even when nothing was visible.
 * One canvas is a single layer, the particle count scales with viewport area,
 * and the loop parks itself when the section scrolls away or the tab hides.
 */

type Mote = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** 0 = teal, 1 = violet. */
  hue: number;
  phase: number;
};

const TEAL = [94, 234, 212] as const;
const VIOLET = [167, 139, 250] as const;

/** One mote per this many CSS px² of viewport, so density feels equal everywhere. */
const AREA_PER_MOTE = 26_000;
const MIN_MOTES = 14;
const MAX_MOTES = 64;
const LINK_DISTANCE = 132;
const PARALLAX = 26;

function motesFor(width: number, height: number): number {
  const byArea = Math.round((width * height) / AREA_PER_MOTE);
  // Coarse proxy for a low-end device; halve the work rather than skipping the effect.
  const budget = (navigator.hardwareConcurrency ?? 4) <= 4 ? 0.6 : 1;
  return clamp(Math.round(byArea * budget), MIN_MOTES, MAX_MOTES);
}

export function initBackdrop(canvas: HTMLCanvasElement | null, spotlight: HTMLElement | null): void {
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let motes: Mote[] = [];

  // Pointer parallax, in -1..1, smoothed toward the raw reading.
  let pointerX = 0;
  let pointerY = 0;
  let driftX = 0;
  let driftY = 0;

  let spotOn = false;

  const resize = (): void => {
    const rect = canvas.getBoundingClientRect();
    // Cap DPR: past 2x the extra pixels cost real time and nobody can see them.
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = motesFor(width, height);
    if (motes.length !== count) seed(count);
  };

  const seed = (count: number): void => {
    motes = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.05,
      vy: -0.02 - Math.random() * 0.05,
      r: 0.8 + Math.random() * 1.9,
      hue: Math.random() < 0.34 ? 1 : 0,
      phase: Math.random() * Math.PI * 2,
    }));
  };

  const draw = (dt: number, now: number): void => {
    driftX = damp(driftX, pointerX, 3, dt);
    driftY = damp(driftY, pointerY, 3, dt);

    const ox = driftX * PARALLAX;
    const oy = driftY * PARALLAX;

    ctx.clearRect(0, 0, width, height);

    const t = now / 1000;

    for (const mote of motes) {
      mote.x += mote.vx * (dt / 16.67);
      mote.y += mote.vy * (dt / 16.67);

      // Wrap with a margin so motes never pop in at the exact edge.
      if (mote.y < -20) {
        mote.y = height + 20;
        mote.x = Math.random() * width;
      }
      if (mote.x < -20) mote.x = width + 20;
      else if (mote.x > width + 20) mote.x = -20;
    }

    // Constellation links first, so motes sit on top of their own web.
    ctx.lineWidth = 1;
    for (let i = 0; i < motes.length; i++) {
      const a = motes[i]!;
      const ax = a.x + ox;
      const ay = a.y + oy;

      for (let j = i + 1; j < motes.length; j++) {
        const b = motes[j]!;
        const dx = ax - (b.x + ox);
        const dy = ay - (b.y + oy);
        const distSq = dx * dx + dy * dy;
        if (distSq > LINK_DISTANCE * LINK_DISTANCE) continue;

        const fade = 1 - Math.sqrt(distSq) / LINK_DISTANCE;
        const rgb = a.hue === 1 || b.hue === 1 ? VIOLET : TEAL;
        ctx.strokeStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${(fade * 0.1).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(b.x + ox, b.y + oy);
        ctx.stroke();
      }
    }

    for (const mote of motes) {
      // Slow twinkle keeps the field alive without moving anything.
      const twinkle = 0.42 + 0.38 * Math.sin(t * 0.7 + mote.phase);
      const rgb = mote.hue === 1 ? VIOLET : TEAL;
      const px = mote.x + ox * (mote.hue === 1 ? 1.5 : 1);
      const py = mote.y + oy * (mote.hue === 1 ? 1.5 : 1);

      ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${twinkle.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(px, py, mote.r, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  let stopFrame: (() => void) | null = null;

  const start = (): void => {
    if (stopFrame || prefersReducedMotion()) return;
    stopFrame = addFrameTask(draw);
  };

  const stop = (): void => {
    stopFrame?.();
    stopFrame = null;
  };

  // Only animate while the canvas is actually on screen.
  const visibility = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) start();
        else stop();
      }
    },
    { rootMargin: "64px" },
  );

  const observer = new ResizeObserver(() => resize());
  observer.observe(canvas);
  resize();

  if (prefersReducedMotion()) {
    // Draw one static frame so the field still reads as texture, then stay put.
    draw(16.67, 0);
  } else {
    visibility.observe(canvas);
  }

  if (hasFinePointer()) {
    window.addEventListener(
      "pointermove",
      (event) => {
        pointerX = (event.clientX / window.innerWidth) * 2 - 1;
        pointerY = (event.clientY / window.innerHeight) * 2 - 1;

        if (spotlight) {
          if (!spotOn) {
            spotOn = true;
            spotlight.classList.add("is-live");
          }
          // Pixels feeding a translate3d: compositor-only, no repaint of the
          // full-screen gradient the way animating background-position would be.
          spotlight.style.setProperty("--spot-x", `${event.clientX}px`);
          spotlight.style.setProperty("--spot-y", `${event.clientY}px`);
        }
      },
      { passive: true },
    );

    document.addEventListener("pointerleave", () => {
      pointerX = 0;
      pointerY = 0;
      spotOn = false;
      spotlight?.classList.remove("is-live");
    });
  }
}
