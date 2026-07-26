import {
  addFrameTask,
  clamp,
  damp,
  hasFinePointer,
  onReducedMotionChange,
  prefersReducedMotion,
} from "./motion";

/**
 * 3D coverflow carousel.
 *
 * The position is a continuous float in slide units rather than an integer
 * index, and every frame lays the cards out from it. That is what makes a drag
 * track the finger 1:1 and a flick carry momentum — with CSS transitions on
 * discrete steps the cards can only jump once the gesture ends.
 */

const AUTOPLAY_MS = 4200;
const SETTLE_EPSILON = 0.0004;
/** How far a flick is allowed to carry past the nearest slide, in slides. */
const FLICK_LIMIT = 1.2;
/** ms of coasting the release velocity is projected over. */
const FLICK_PROJECTION = 190;
const NARROW_MQ = "(max-width: 640px)";
/** Half the arrow button, and the gap it keeps from the outermost card. */
const ARROW_RADIUS = 22;
const ARROW_GAP = 26;

type LayoutMetrics = {
  visibleRange: number;
  /** Horizontal step per slide, as a fraction of card width. */
  xStep: number;
  zStep: number;
  rotateStep: number;
  yStep: number;
  tilt: number;
};

const WIDE: LayoutMetrics = {
  visibleRange: 2,
  xStep: 0.82,
  zStep: 100,
  rotateStep: -20,
  yStep: 7,
  tilt: 7,
};

/** Phones: tighter steps and one card either side, so nothing leaves the screen. */
const NARROW: LayoutMetrics = {
  visibleRange: 1,
  xStep: 0.46,
  zStep: 70,
  rotateStep: -13,
  yStep: 4,
  tilt: 0,
};

type SlideState = {
  el: HTMLElement;
  transform: string;
  opacity: string;
  visible: boolean;
  active: boolean;
};

function wrap(value: number, length: number): number {
  return ((value % length) + length) % length;
}

/**
 * Shortest signed distance from `position` to slide `i` around a ring of
 * `length` slides, in (-length/2, length/2]. This is what makes the track
 * infinite: a card three to the right is also four to the left, and we always
 * lay it out on whichever side is closer.
 */
function ringOffset(i: number, position: number, length: number): number {
  const raw = i - position;
  return raw - Math.round(raw / length) * length;
}

export function initCarousel(root: HTMLElement): () => void {
  const stage = root.querySelector<HTMLElement>("[data-carousel-stage]");
  const slideEls = Array.from(root.querySelectorAll<HTMLElement>("[data-carousel-slide]"));
  if (!stage || slideEls.length === 0) return () => undefined;

  const prevBtn = root.querySelector<HTMLButtonElement>("[data-carousel-prev]");
  const nextBtn = root.querySelector<HTMLButtonElement>("[data-carousel-next]");
  const dotsHost = root.querySelector<HTMLElement>("[data-carousel-dots]");
  const live = root.querySelector<HTMLElement>("[data-carousel-live]");

  const count = slideEls.length;
  const narrowMq = window.matchMedia(NARROW_MQ);
  const cleanups: Array<() => void> = [];

  const slides: SlideState[] = slideEls.map((el) => ({
    el,
    transform: "",
    opacity: "",
    visible: false,
    active: false,
  }));

  let metrics = narrowMq.matches ? NARROW : WIDE;
  let cardWidth = 0;

  /**
   * Cached stage rect. The tilt handler needs it on every pointer move, and
   * reading it there forces a synchronous layout mid-gesture — exactly when
   * there is least time to spare. Invalidated on scroll and resize instead.
   */
  let stageRect: DOMRect | null = null;
  const rectOf = (): DOMRect => (stageRect ??= stage.getBoundingClientRect());
  const invalidateRect = (): void => {
    stageRect = null;
  };

  let position = 0;
  let target = 0;
  let index = 0;

  // Pointer tilt on the active card, in -1..1.
  let tiltTargetX = 0;
  let tiltTargetY = 0;
  let tiltX = 0;
  let tiltY = 0;
  let specX = 50;
  let specY = 50;

  let activeSlide: SlideState | null = null;
  let dragging = false;
  let pointerId: number | null = null;
  let dragStartX = 0;
  let dragStartPos = 0;
  let dragMoved = false;
  let velocity = 0;
  let lastDragX = 0;
  let lastDragT = 0;

  let stopFrame: (() => void) | null = null;
  let autoplayId: number | null = null;
  let onScreen = true;

  /**
   * Fit the fan to the stage.
   *
   * The base metrics assume a roomy stage. In a short landscape window the
   * stage can be narrower than the fan is wide, which pushed cards past the
   * viewport edge. Shed an outer rank first — losing a peek card reads as
   * intentional — and only squash the spacing if one rank still will not fit.
   */
  const measure = (): void => {
    const base = narrowMq.matches ? NARROW : WIDE;
    cardWidth = slideEls[0]?.offsetWidth || 220;
    invalidateRect();

    // 0.94 leaves room for the perspective/rotation spread the flat maths misses.
    const half = (stage.clientWidth / 2) * 0.94;
    const fits = (range: number, xStep: number): boolean =>
      range * xStep * cardWidth + cardWidth / 2 <= half;

    let visibleRange = base.visibleRange;
    let xStep = base.xStep;

    while (visibleRange > 1 && !fits(visibleRange, xStep)) visibleRange--;
    if (!fits(visibleRange, xStep)) {
      xStep = Math.max(0.3, (half - cardWidth / 2) / (visibleRange * cardWidth));
    }

    metrics = { ...base, visibleRange, xStep };

    // Park the arrows just outside the outermost card instead of at the
    // container edge, so they stay next to the fan at any width.
    const reach = visibleRange * xStep * cardWidth + cardWidth / 2;
    const room = stage.clientWidth / 2 - ARROW_RADIUS;
    const offset = Math.min(reach + ARROW_GAP, Math.max(room, cardWidth / 2));
    root.style.setProperty("--btn-offset", `${Math.round(offset)}px`);
  };

  /** Pixels of drag that equal one slide, matched to the card's visual travel. */
  const dragStep = (): number => Math.max(60, cardWidth * metrics.xStep);

  const layout = (): void => {
    const useTilt = metrics.tilt > 0 && !prefersReducedMotion();

    for (let i = 0; i < count; i++) {
      const slide = slides[i]!;
      const offset = ringOffset(i, position, count);
      const abs = Math.abs(offset);
      const visible = abs <= metrics.visibleRange + 0.5;
      const active = abs < 0.5;

      if (!visible) {
        // Park culled cards once, then stop touching them.
        if (slide.visible || slide.opacity !== "0") {
          slide.el.style.transform = "translate3d(-50%, -50%, -400px) scale(0.55)";
          slide.el.style.opacity = "0";
          slide.transform = "";
          slide.opacity = "0";
        }
        if (slide.visible) {
          slide.el.classList.remove("is-visible", "is-active");
          slide.visible = false;
          slide.active = false;
        }
        continue;
      }

      const x = offset * metrics.xStep * cardWidth;
      const y = abs * metrics.yStep;
      const z = -abs * metrics.zStep;
      const rotateY = offset * metrics.rotateStep + (active && useTilt ? tiltX * metrics.tilt : 0);
      const rotateX = active && useTilt ? -tiltY * metrics.tilt : 0;
      const scale = Math.max(0.76, 1 - abs * 0.12);
      const opacity = Math.max(0.28, 1 - abs * 0.3);

      const transform =
        `translate3d(calc(-50% + ${x.toFixed(2)}px), calc(-50% + ${y.toFixed(2)}px), ${z.toFixed(2)}px)` +
        ` rotateY(${rotateY.toFixed(3)}deg) rotateX(${rotateX.toFixed(3)}deg) scale(${scale.toFixed(4)})`;
      const opacityStr = opacity.toFixed(3);

      // Only write when the value actually changed — style writes are not free.
      if (transform !== slide.transform) {
        slide.el.style.transform = transform;
        slide.transform = transform;
      }
      if (opacityStr !== slide.opacity) {
        slide.el.style.opacity = opacityStr;
        slide.opacity = opacityStr;
      }
      if (!slide.visible) {
        slide.el.classList.add("is-visible");
        slide.visible = true;
      }
      if (active !== slide.active) {
        slide.el.classList.toggle("is-active", active);
        slide.el.style.zIndex = active ? "20" : String(Math.round(19 - abs * 4));
        slide.active = active;
        if (active) {
          activeSlide = slide;
          if (useTilt) {
            slide.el.style.setProperty("--mx", `${specX}%`);
            slide.el.style.setProperty("--my", `${specY}%`);
          }
        } else if (activeSlide === slide) {
          activeSlide = null;
        }
      }
    }
  };

  const frame = (dt: number): void => {
    let moving = false;

    if (!dragging) {
      const next = damp(position, target, 11, dt);
      if (Math.abs(next - target) < SETTLE_EPSILON) {
        position = target;
      } else {
        position = next;
        moving = true;
      }
    } else {
      moving = true;
    }

    const nextTiltX = damp(tiltX, tiltTargetX, 9, dt);
    const nextTiltY = damp(tiltY, tiltTargetY, 9, dt);
    if (Math.abs(nextTiltX - tiltTargetX) > 0.0008 || Math.abs(nextTiltY - tiltTargetY) > 0.0008) {
      moving = true;
    }
    tiltX = nextTiltX;
    tiltY = nextTiltY;

    layout();

    if (!moving) {
      // Keep the working numbers small after every settle.
      const shift = Math.round(position / count) * count;
      position -= shift;
      target -= shift;
      stopLoop();
    }
  };

  const startLoop = (): void => {
    if (stopFrame || !onScreen) return;
    stopFrame = addFrameTask(frame);
  };

  const stopLoop = (): void => {
    stopFrame?.();
    stopFrame = null;
  };

  const syncIndex = (announce: boolean): void => {
    const next = wrap(Math.round(target), count);
    if (next === index && !announce) return;
    index = next;

    for (let i = 0; i < dots.length; i++) {
      const dot = dots[i]!;
      const on = i === index;
      dot.classList.toggle("is-active", on);
      if (on) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    }

    if (announce && live) {
      const name = slideEls[index]?.dataset.name ?? "";
      live.textContent = `${name} — ${index + 1} of ${count}`;
    }
  };

  const goToOffset = (delta: number, announce = true): void => {
    target = Math.round(target) + delta;
    syncIndex(announce);
    startLoop();
    restartAutoplay();
  };

  /** Move to an absolute slide by the shorter way around the ring. */
  const goToIndex = (next: number): void => {
    const delta = ringOffset(next, wrap(target, count), count);
    target = Math.round(target) + delta;
    syncIndex(true);
    startLoop();
    restartAutoplay();
  };

  const next = (): void => goToOffset(1);
  const prev = (): void => goToOffset(-1);

  // ── Dots ────────────────────────────────────────────────────
  const dots: HTMLButtonElement[] = [];
  if (dotsHost) {
    dotsHost.replaceChildren();
    slideEls.forEach((slide, i) => {
      const name = slide.dataset.name ?? `Member ${i + 1}`;
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "carousel-dot";
      dot.setAttribute("aria-label", `Show ${name}`);
      dot.addEventListener("click", () => goToIndex(i));
      dotsHost.append(dot);
      dots.push(dot);
    });
  }

  // ── Autoplay ────────────────────────────────────────────────
  const stopAutoplay = (): void => {
    if (autoplayId !== null) {
      window.clearInterval(autoplayId);
      autoplayId = null;
    }
  };

  const startAutoplay = (): void => {
    if (autoplayId !== null || prefersReducedMotion() || !onScreen || dragging) return;
    autoplayId = window.setInterval(() => {
      target = Math.round(target) + 1;
      syncIndex(false);
      startLoop();
    }, AUTOPLAY_MS);
  };

  const restartAutoplay = (): void => {
    if (autoplayId === null) return;
    stopAutoplay();
    startAutoplay();
  };

  // ── Gestures ────────────────────────────────────────────────
  const onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    dragging = true;
    dragMoved = false;
    pointerId = event.pointerId;
    dragStartX = event.clientX;
    lastDragX = event.clientX;
    lastDragT = event.timeStamp;
    dragStartPos = position;
    velocity = 0;

    root.classList.add("is-dragging");
    stage.setPointerCapture(event.pointerId);
    stopAutoplay();
    startLoop();
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!dragging || event.pointerId !== pointerId) return;

    const dx = event.clientX - dragStartX;
    if (Math.abs(dx) > 6) dragMoved = true;

    position = dragStartPos - dx / dragStep();

    const dt = event.timeStamp - lastDragT;
    if (dt > 0) {
      // px/ms converted to slides/ms, smoothed so one jittery sample can't flick.
      const sample = -(event.clientX - lastDragX) / dragStep() / dt;
      velocity = velocity * 0.7 + sample * 0.3;
      lastDragX = event.clientX;
      lastDragT = event.timeStamp;
    }
  };

  const endDrag = (event: PointerEvent): void => {
    if (!dragging || event.pointerId !== pointerId) return;

    dragging = false;
    pointerId = null;
    root.classList.remove("is-dragging");

    // Carry the flick, but never more than one slide past the nearest one:
    // long throws that skip five cards feel broken, not fast.
    const projected =
      position + clamp(velocity * FLICK_PROJECTION, -FLICK_LIMIT, FLICK_LIMIT);
    target = Math.round(projected);

    syncIndex(true);
    startLoop();
    startAutoplay();
  };

  const onWheel = (event: WheelEvent): void => {
    // Only claim clearly horizontal intent, so vertical page scroll still works.
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) * 1.4) return;
    event.preventDefault();
    if (Math.abs(event.deltaX) < 8) return;
    goToOffset(event.deltaX > 0 ? 1 : -1);
  };

  const onKeydown = (event: KeyboardEvent): void => {
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        next();
        break;
      case "ArrowLeft":
        event.preventDefault();
        prev();
        break;
      case "Home":
        event.preventDefault();
        goToIndex(0);
        break;
      case "End":
        event.preventDefault();
        goToIndex(count - 1);
        break;
    }
  };

  const onStagePointerMove = (event: PointerEvent): void => {
    if (metrics.tilt <= 0 || prefersReducedMotion()) return;
    const rect = rectOf();
    const nx = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
    const ny = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
    tiltTargetX = nx;
    tiltTargetY = ny;

    specX = Math.round((nx * 0.5 + 0.5) * 100);
    specY = Math.round((ny * 0.5 + 0.5) * 100);
    if (activeSlide) {
      activeSlide.el.style.setProperty("--mx", `${specX}%`);
      activeSlide.el.style.setProperty("--my", `${specY}%`);
    }
    startLoop();
  };

  const resetTilt = (): void => {
    tiltTargetX = 0;
    tiltTargetY = 0;
    specX = 50;
    specY = 50;
    activeSlide?.el.style.setProperty("--mx", "50%");
    activeSlide?.el.style.setProperty("--my", "50%");
    startLoop();
  };

  // ── Wiring ──────────────────────────────────────────────────
  const on = (
    el: EventTarget,
    type: string,
    fn: EventListenerOrEventListenerObject,
    opts?: AddEventListenerOptions,
  ): void => {
    el.addEventListener(type, fn, opts);
    cleanups.push(() => el.removeEventListener(type, fn, opts));
  };

  if (prevBtn) on(prevBtn, "click", prev);
  if (nextBtn) on(nextBtn, "click", next);
  on(root, "keydown", onKeydown as EventListener);
  on(stage, "pointerdown", onPointerDown as EventListener);
  on(stage, "pointermove", onPointerMove as EventListener, { passive: true });
  on(stage, "pointerup", endDrag as EventListener);
  on(stage, "pointercancel", endDrag as EventListener);
  on(stage, "wheel", onWheel as EventListener, { passive: false });
  on(root, "mouseenter", stopAutoplay);
  on(root, "mouseleave", startAutoplay);
  on(root, "focusin", stopAutoplay);
  on(root, "focusout", ((event: FocusEvent) => {
    if (!root.contains(event.relatedTarget as Node | null)) startAutoplay();
  }) as EventListener);

  if (hasFinePointer()) {
    on(stage, "pointermove", onStagePointerMove as EventListener, { passive: true });
    on(stage, "pointerleave", resetTilt);
    // The rect is viewport-relative, so scrolling moves it.
    on(window, "scroll", invalidateRect, { passive: true });
  }

  // Clicking a side card brings it forward; a completed drag must not count.
  slideEls.forEach((slide, i) => {
    on(slide, "click", () => {
      if (dragMoved) return;
      if (wrap(Math.round(target), count) !== i) goToIndex(i);
    });
  });

  const onMqChange = (): void => {
    measure();
    startLoop();
  };
  narrowMq.addEventListener("change", onMqChange);
  cleanups.push(() => narrowMq.removeEventListener("change", onMqChange));

  const resizeObserver = new ResizeObserver(() => {
    measure();
    startLoop();
  });
  resizeObserver.observe(stage);
  cleanups.push(() => resizeObserver.disconnect());

  // Idle entirely while the roster is off screen.
  const visibility = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        onScreen = entry.isIntersecting;
        if (onScreen) {
          startLoop();
          startAutoplay();
        } else {
          stopLoop();
          stopAutoplay();
        }
      }
    },
    { rootMargin: "80px" },
  );
  visibility.observe(root);
  cleanups.push(() => visibility.disconnect());

  const onVisibility = (): void => {
    if (document.hidden) stopAutoplay();
    else startAutoplay();
  };
  document.addEventListener("visibilitychange", onVisibility);
  cleanups.push(() => document.removeEventListener("visibilitychange", onVisibility));

  cleanups.push(
    onReducedMotionChange((reduced) => {
      if (reduced) {
        stopAutoplay();
        resetTilt();
      } else {
        startAutoplay();
      }
    }),
  );

  measure();
  syncIndex(true);
  layout();
  root.classList.add("is-ready");
  startAutoplay();

  return () => {
    stopLoop();
    stopAutoplay();
    for (const off of cleanups) off();
  };
}

export function initCarousels(): void {
  for (const root of document.querySelectorAll<HTMLElement>("[data-carousel]")) {
    initCarousel(root);
  }
}
