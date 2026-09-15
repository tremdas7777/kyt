import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname === "/admin/login") return <Outlet />;
  return <AdminShell />;
}
