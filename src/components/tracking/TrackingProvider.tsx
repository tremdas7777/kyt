import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";

import { captureAttribution, initPixels, loadPublicTracking, trackPageView } from "@/lib/pixel-client";

export function TrackingProvider({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isAdmin = pathname.startsWith("/admin");
  const ready = useRef(false);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    if (isAdmin) return;
    captureAttribution();
    let cancelled = false;
    void loadPublicTracking().then((config) => {
      if (cancelled || !config) return;
      initPixels(config);
      ready.current = true;
      trackPageView(pathRef.current);
    });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin || !ready.current) return;
    trackPageView(pathname);
  }, [isAdmin, pathname]);

  return <>{children}</>;
}
