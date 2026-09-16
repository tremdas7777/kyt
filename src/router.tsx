import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    getScrollRestorationKey: (location) => {
      if (location.pathname === "/") return `kyt-home-${Date.now()}`;
      return location.state.__TSR_key || location.href;
    },
    defaultPreloadStaleTime: 0,
  });

  return router;
};
