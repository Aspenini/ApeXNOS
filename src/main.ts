import "./styles/main.css";
import { initPwa } from "./modules/pwa";
import { initCarousels } from "./modules/carousel";
import { initParticles } from "./modules/particles";

function initYear(): void {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
}

function init(): void {
  initYear();
  initParticles(document.getElementById("particles"));
  initCarousels();
  initPwa();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
