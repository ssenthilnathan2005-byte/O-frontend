// Keeps the CSS variable --nav-h equal to the real height of the sticky top header.
// When there is no visible sticky header (phones), the variable is removed so existing fallbacks apply.
export function initNavHeight() {
  let ro: ResizeObserver | null = null;
  let current: HTMLElement | null = null;
  let queued = false;

  function findHeader(): HTMLElement | null {
    const all = Array.from(document.querySelectorAll("header")) as HTMLElement[];
    return all.find((h) => h.offsetHeight > 0 && getComputedStyle(h).position === "sticky") || null;
  }

  function apply() {
    queued = false;
    const h = findHeader();
    const root = document.documentElement;
    if (h) {
      root.style.setProperty("--nav-h", h.getBoundingClientRect().height + "px");
    } else {
      root.style.removeProperty("--nav-h");
    }
    if (h !== current) {
      ro?.disconnect();
      current = h;
      if (h && "ResizeObserver" in window) {
        ro = new ResizeObserver(schedule);
        ro.observe(h);
      }
    }
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  const root = document.getElementById("root");
  if (root) new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
  schedule();
}
