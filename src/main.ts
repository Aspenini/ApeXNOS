import "./styles/main.css";
import { initBackdrop } from "./modules/backdrop";
import { initCarousels } from "./modules/carousel";
import { initPwa } from "./modules/pwa";
import { initReveal } from "./modules/reveal";
import { initScramble } from "./modules/scramble";

function initYear(): void {
  const year = String(new Date().getFullYear());
  for (const el of document.querySelectorAll<HTMLElement>("[data-year]")) {
    el.textContent = year;
  }
}

function init(): void {
  document.documentElement.classList.add("js");

  initYear();
  initReveal();

  // Order matters: each of these measures the DOM before it writes to it, so
  // running the two that only measure-then-write first, and the carousel — which
  // writes a transform to every card — last, avoids interleaving reads and
  // writes into a chain of forced synchronous layouts.
  initBackdrop(
    document.querySelector<HTMLCanvasElement>("#field"),
    document.querySelector<HTMLElement>("#spotlight"),
  );
  initScramble(document.querySelector<HTMLElement>("[data-scramble]"));
  initCarousels();

  // The service worker only matters after the page is interactive, so let it
  // wait for idle rather than competing with the first paint.
  const idle = window.requestIdleCallback;
  if (typeof idle === "function") idle(() => initPwa(), { timeout: 3000 });
  else window.setTimeout(initPwa, 1200);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
