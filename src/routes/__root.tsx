import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { SiteShell } from "@/components/layout/SiteShell";
import { TrackingProvider } from "@/components/tracking/TrackingProvider";
import { Toaster } from "@/components/ui/sonner";
import { CartProvider } from "@/lib/cart";
import { PaymentOptionsProvider } from "@/lib/payment-options";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 pt-24">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-black text-foreground">404</h1>
        <h2 className="mt-4 font-display text-xl font-bold uppercase">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço que você acessou não existe ou foi movido.
        </p>
        <div className="mt-6">
          <Link to="/" className="kyt-btn kyt-btn-primary">
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 pt-24">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl font-bold uppercase">A página não carregou</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo deu errado. Tente recarregar ou volte para a página inicial.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="kyt-btn kyt-btn-primary"
          >
            Tentar de novo
          </button>
          <a href="/" className="kyt-btn kyt-btn-outline">
            Ir para o início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "KYT Capacetes Brasil | World Class Helmet" },
      {
        name: "description",
        content: "Loja oficial KYT no Brasil. Capacetes desenvolvidos nas pistas do MotoGP.",
      },
      { property: "og:title", content: "KYT Capacetes Brasil | World Class Helmet" },
      {
        property: "og:description",
        content: "Capacetes KYT oficiais. A partir de R$ 297.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Barlow:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Barlow+Condensed:wght@600;700;800;900&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{history.scrollRestoration='manual'}catch(e){}if(location.pathname==='/'||location.pathname===''){scrollTo(0,0);addEventListener('pageshow',function(){if(location.pathname==='/'||location.pathname==='')scrollTo(0,0)})}",
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isAdmin = pathname.startsWith("/admin");

  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <PaymentOptionsProvider>
          <TrackingProvider>
          {isAdmin ? (
            <Outlet />
          ) : (
            <SiteShell>
              <Outlet />
            </SiteShell>
          )}
          <Toaster />
        </TrackingProvider>
        </PaymentOptionsProvider>
      </CartProvider>
    </QueryClientProvider>
  );
}
