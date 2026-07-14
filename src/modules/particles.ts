const PARTICLE_COUNT = 28;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function initParticles(container: HTMLElement | null): void {
  if (!container || prefersReducedMotion()) return;

  const fragment = document.createDocumentFragment();

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const particle = document.createElement("span");
    particle.className = "particle";
    if (i % 3 === 0) particle.classList.add("particle--violet");

    const size = randomBetween(2, 5);
    particle.style.setProperty("--size", `${size}px`);
    particle.style.setProperty("--x", `${randomBetween(2, 98)}%`);
    particle.style.setProperty("--y", `${randomBetween(8, 92)}%`);
    particle.style.setProperty("--dx", `${randomBetween(-28, 28)}px`);
    particle.style.setProperty("--dur", `${randomBetween(9, 18)}s`);
    particle.style.setProperty("--delay", `${randomBetween(0, 10)}s`);
    particle.style.setProperty("--max-opacity", `${randomBetween(0.25, 0.7)}`);

    fragment.append(particle);
  }

  container.append(fragment);
}
