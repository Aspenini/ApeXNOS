/** Shared motion plumbing: one reduced-motion source of truth, one frame loop. */

const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

let reduced = reduceQuery.matches;
const reducedListeners = new Set<(reduced: boolean) => void>();

reduceQuery.addEventListener("change", (event) => {
  reduced = event.matches;
  for (const listener of reducedListeners) listener(reduced);
});

export function prefersReducedMotion(): boolean {
  return reduced;
}

/** Subscribe to reduced-motion changes; returns an unsubscribe. */
export function onReducedMotionChange(listener: (reduced: boolean) => void): () => void {
  reducedListeners.add(listener);
  return () => reducedListeners.delete(listener);
}

export type FrameTask = (dt: number, now: number) => void;

const tasks = new Set<FrameTask>();
let rafId = 0;
let last = 0;

function tick(now: number): void {
  // Clamp dt so a backgrounded tab doesn't resume with one huge integration step.
  const dt = last === 0 ? 16.67 : Math.min(now - last, 50);
  last = now;

  for (const task of tasks) task(dt, now);

  rafId = tasks.size > 0 ? requestAnimationFrame(tick) : 0;
  if (rafId === 0) last = 0;
}

/**
 * Every animated module shares a single requestAnimationFrame loop. One callback
 * per frame instead of one per effect keeps layout/paint batched and lets the
 * whole site go idle the moment nothing is moving.
 */
export function addFrameTask(task: FrameTask): () => void {
  tasks.add(task);
  if (rafId === 0 && !document.hidden) {
    last = 0;
    rafId = requestAnimationFrame(tick);
  }
  return () => {
    tasks.delete(task);
  };
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (rafId !== 0) cancelAnimationFrame(rafId);
    rafId = 0;
    last = 0;
  } else if (tasks.size > 0 && rafId === 0) {
    rafId = requestAnimationFrame(tick);
  }
});

/** Frame-rate independent exponential approach — the workhorse for smoothing. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return target + (current - target) * Math.exp(-lambda * (dt / 1000));
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** True when the pointer can hover precisely — gates cursor-tracking effects. */
export function hasFinePointer(): boolean {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}
