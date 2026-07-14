import { registerSW } from "virtual:pwa-register";

export function initPwa(): void {
  const toast = document.getElementById("pwa-toast");
  const reloadBtn = document.getElementById("pwa-reload");
  const dismissBtn = document.getElementById("pwa-dismiss");

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      if (!toast) return;
      toast.hidden = false;
    },
    onOfflineReady() {
      // Silent offline-ready; site is cached.
    },
  });

  reloadBtn?.addEventListener("click", () => {
    void updateSW(true);
  });

  dismissBtn?.addEventListener("click", () => {
    if (toast) toast.hidden = true;
  });
}
