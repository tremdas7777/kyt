const HOME_HASHES = new Set(["", "#", "#produtos", "#sobre", "#pilotos"]);

export function pinHomeToTop() {
  if (typeof window === "undefined") return;
  try {
    window.history.scrollRestoration = "manual";
  } catch {
    // ignore
  }
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

export function startHomeScrollLock() {
  if (typeof window === "undefined") return () => undefined;
  const hash = window.location.hash;
  if (hash && !HOME_HASHES.has(hash)) {
    try {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
    } catch {
      // ignore
    }
  }
  try {
    window.sessionStorage.removeItem("tsr-scroll-restoration-v1_3");
  } catch {
    // ignore
  }
  pinHomeToTop();
  const onShow = () => pinHomeToTop();
  window.addEventListener("pageshow", onShow);
  const timers = [0, 32, 80, 160, 320, 640].map((ms) => window.setTimeout(pinHomeToTop, ms));
  return () => {
    window.removeEventListener("pageshow", onShow);
    for (const timer of timers) window.clearTimeout(timer);
  };
}
