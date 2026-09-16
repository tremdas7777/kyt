import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";

import { captureAttribution, initPixels, loadPublicTracking, pingLive, trackPageView } from "@/lib/pixel-client";

export function TrackingProvider({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isAdmin = pathname.startsWith("/admin");
  const ready = useRef(false);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    if (isAdmin) return;
    captureAttribution();
    pingLive({ path: pathRef.current, event: "PageView" });
    let cancelled = false;
    void loadPublicTracking().then((config) => {
      if (cancelled || !config) return;
      initPixels(config);
      ready.current = true;
      trackPageView(pathRef.current);
      pingLive({ path: pathRef.current, event: "PageView" });
    });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) return;
    pingLive({ path: pathname, event: "PageView" });
    if (ready.current) trackPageView(pathname);
  }, [isAdmin, pathname]);

  useEffect(() => {
    if (isAdmin) return;
    const beat = () => pingLive({ path: pathRef.current });
    const timer = window.setInterval(beat, 4000);
    const onCart = () => pingLive({ path: pathRef.current });
    const onVis = () => {
      if (document.visibilityState === "visible") beat();
    };
    window.addEventListener("kyt:cart", onCart);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("kyt:cart", onCart);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [isAdmin]);

  return <>{children}</>;
}
