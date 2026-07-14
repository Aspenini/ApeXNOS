const AUTOPLAY_MS = 3800;
const SWIPE_THRESHOLD = 40;
const NARROW_MQ = "(max-width: 640px)";

type LayoutMetrics = {
  visibleRange: number;
  xStep: number;
  zStep: number;
  rotateStep: number;
};

type CarouselElements = {
  root: HTMLElement;
  stage: HTMLElement;
  slides: HTMLElement[];
  prev: HTMLButtonElement | null;
  next: HTMLButtonElement | null;
  dots: HTMLElement | null;
  live: HTMLElement | null;
};

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isNarrowViewport(): boolean {
  return window.matchMedia(NARROW_MQ).matches;
}

function getLayoutMetrics(): LayoutMetrics {
  // Desktop: deep 3D fan. Mobile: tighter steps so cards stay on-screen.
  if (isNarrowViewport()) {
    return {
      visibleRange: 1,
      xStep: 42,
      zStep: 70,
      rotateStep: -12,
    };
  }

  return {
    visibleRange: 2,
    xStep: 58,
    zStep: 90,
    rotateStep: -18,
  };
}

function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}

function getElements(root: HTMLElement): CarouselElements | null {
  const stage = root.querySelector<HTMLElement>("[data-carousel-stage]");
  const slides = Array.from(
    root.querySelectorAll<HTMLElement>("[data-carousel-slide]"),
  );

  if (!stage || slides.length === 0) return null;

  return {
    root,
    stage,
    slides,
    prev: root.querySelector<HTMLButtonElement>("[data-carousel-prev]"),
    next: root.querySelector<HTMLButtonElement>("[data-carousel-next]"),
    dots: root.querySelector<HTMLElement>("[data-carousel-dots]"),
    live: root.querySelector<HTMLElement>("[data-carousel-live]"),
  };
}

function createDots(els: CarouselElements, onSelect: (index: number) => void): HTMLButtonElement[] {
  if (!els.dots) return [];

  els.dots.replaceChildren();
  const buttons: HTMLButtonElement[] = [];

  els.slides.forEach((slide, index) => {
    const name = slide.dataset.name ?? `Member ${index + 1}`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "carousel-dot";
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-label", `Show ${name}`);
    btn.addEventListener("click", () => onSelect(index));
    els.dots!.append(btn);
    buttons.push(btn);
  });

  return buttons;
}

function layoutSlide(
  slide: HTMLElement,
  offset: number,
  isActive: boolean,
  metrics: LayoutMetrics,
): void {
  const abs = Math.abs(offset);
  const visible = abs <= metrics.visibleRange;

  slide.classList.toggle("is-active", isActive);
  slide.classList.toggle("is-visible", visible);
  slide.setAttribute("aria-hidden", visible ? "false" : "true");
  slide.tabIndex = isActive ? 0 : -1;

  if (!visible) {
    slide.style.transform = "translate(-50%, -50%) scale(0.5)";
    slide.style.opacity = "0";
    slide.style.zIndex = "0";
    return;
  }

  const x = offset * metrics.xStep;
  const z = -Math.abs(offset) * metrics.zStep;
  const rotateY = offset * metrics.rotateStep;
  const scale = isActive ? 1 : Math.max(0.78, 1 - abs * 0.12);
  const y = abs * (isNarrowViewport() ? 4 : 6);
  const opacity = isActive ? 1 : Math.max(0.4, 1 - abs * 0.28);

  slide.style.transform = `translate(calc(-50% + ${x}%), calc(-50% + ${y}px)) translateZ(${z}px) rotateY(${rotateY}deg) scale(${scale})`;
  slide.style.opacity = String(opacity);
  slide.style.zIndex = String(20 - abs);
}

export function initCarousel(root: HTMLElement): () => void {
  const els = getElements(root);
  if (!els) return () => undefined;

  let index = 0;
  let autoplayId: number | null = null;
  let pointerId: number | null = null;
  let startX = 0;
  let dragX = 0;
  let isDragging = false;
  let didDrag = false;

  const goTo = (next: number, announce = true): void => {
    index = wrapIndex(next, els.slides.length);
    render(announce);
    restartAutoplay();
  };

  const render = (announce = false): void => {
    const metrics = getLayoutMetrics();

    els.slides.forEach((slide, i) => {
      let offset = i - index;
      const half = Math.floor(els.slides.length / 2);
      if (offset > half) offset -= els.slides.length;
      if (offset < -half) offset += els.slides.length;
      layoutSlide(slide, offset, i === index, metrics);
    });

    dots.forEach((dot, i) => {
      const active = i === index;
      dot.classList.toggle("is-active", active);
      dot.setAttribute("aria-selected", active ? "true" : "false");
      dot.tabIndex = active ? 0 : -1;
    });

    if (announce && els.live) {
      const name = els.slides[index]?.dataset.name ?? "";
      els.live.textContent = `${name} · ${index + 1} of ${els.slides.length}`;
    }
  };

  const dots = createDots(els, (i) => goTo(i));
  const narrowMq = window.matchMedia(NARROW_MQ);
  const onViewportChange = (): void => {
    render(false);
  };

  const next = (): void => goTo(index + 1);
  const prev = (): void => goTo(index - 1);

  const stopAutoplay = (): void => {
    if (autoplayId !== null) {
      window.clearInterval(autoplayId);
      autoplayId = null;
    }
  };

  const startAutoplay = (): void => {
    if (prefersReducedMotion() || autoplayId !== null) return;
    autoplayId = window.setInterval(next, AUTOPLAY_MS);
  };

  const restartAutoplay = (): void => {
    stopAutoplay();
    startAutoplay();
  };

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      next();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      prev();
    } else if (event.key === "Home") {
      event.preventDefault();
      goTo(0);
    } else if (event.key === "End") {
      event.preventDefault();
      goTo(els.slides.length - 1);
    }
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    pointerId = event.pointerId;
    startX = event.clientX;
    dragX = 0;
    didDrag = false;
    isDragging = true;
    els.root.classList.add("is-dragging");
    els.stage.setPointerCapture(event.pointerId);
    stopAutoplay();
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!isDragging || event.pointerId !== pointerId) return;
    dragX = event.clientX - startX;
    if (Math.abs(dragX) > 8) didDrag = true;
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (!isDragging || event.pointerId !== pointerId) return;
    isDragging = false;
    pointerId = null;
    els.root.classList.remove("is-dragging");

    if (Math.abs(dragX) >= SWIPE_THRESHOLD) {
      if (dragX < 0) next();
      else prev();
    } else {
      restartAutoplay();
    }

    dragX = 0;
  };

  const onVisibility = (): void => {
    if (document.hidden) stopAutoplay();
    else restartAutoplay();
  };

  els.prev?.addEventListener("click", prev);
  els.next?.addEventListener("click", next);
  els.root.addEventListener("keydown", onKeydown);
  els.stage.addEventListener("pointerdown", onPointerDown);
  els.stage.addEventListener("pointermove", onPointerMove);
  els.stage.addEventListener("pointerup", onPointerUp);
  els.stage.addEventListener("pointercancel", onPointerUp);
  els.root.addEventListener("mouseenter", stopAutoplay);
  els.root.addEventListener("mouseleave", startAutoplay);
  els.root.addEventListener("focusin", stopAutoplay);
  els.root.addEventListener("focusout", (e) => {
    if (!els.root.contains(e.relatedTarget as Node | null)) startAutoplay();
  });
  document.addEventListener("visibilitychange", onVisibility);
  if (typeof narrowMq.addEventListener === "function") {
    narrowMq.addEventListener("change", onViewportChange);
  } else {
    // Safari < 14
    narrowMq.addListener(onViewportChange);
  }

  // Click side cards to jump
  els.slides.forEach((slide, i) => {
    slide.addEventListener("click", () => {
      if (didDrag) return;
      if (i !== index) goTo(i);
    });
  });

  render(true);
  startAutoplay();

  return () => {
    stopAutoplay();
    els.prev?.removeEventListener("click", prev);
    els.next?.removeEventListener("click", next);
    els.root.removeEventListener("keydown", onKeydown);
    els.stage.removeEventListener("pointerdown", onPointerDown);
    els.stage.removeEventListener("pointermove", onPointerMove);
    els.stage.removeEventListener("pointerup", onPointerUp);
    els.stage.removeEventListener("pointercancel", onPointerUp);
    document.removeEventListener("visibilitychange", onVisibility);
    if (typeof narrowMq.removeEventListener === "function") {
      narrowMq.removeEventListener("change", onViewportChange);
    } else {
      narrowMq.removeListener(onViewportChange);
    }
  };
}

export function initCarousels(): void {
  document.querySelectorAll<HTMLElement>("[data-carousel]").forEach((root) => {
    initCarousel(root);
  });
}
