import { prefersReducedMotion } from "./motion";

/**
 * Entrance animation, driven by IntersectionObserver rather than a plain CSS
 * animation on load: on tall/mobile layouts the roster starts below the fold,
 * so an unconditional animation plays where nobody can see it.
 */
export function initReveal(): void {
  const targets = document.querySelectorAll<HTMLElement>("[data-reveal]");
  if (targets.length === 0) return;

  // The pre-reveal state is opacity 0, so anything that stops the observer from
  // running would hide the whole page. Bail out to visible instead.
  if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
    for (const el of targets) el.classList.add("is-revealed");
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
  );

  for (const el of targets) observer.observe(el);
}
