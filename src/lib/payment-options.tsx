import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { DEFAULT_PIX_GATEWAY, isPixGateway, STOREFRONT_ALLOWS_CARD, type PixGateway } from "@/lib/payment-types";

type PaymentOptions = {
  cardEnabled: boolean;
  /** Gateway que gera o PIX do checkout (escolhido em /admin/integracoes). */
  pixGateway: PixGateway;
};

const PaymentOptionsContext = createContext<PaymentOptions>({ cardEnabled: false, pixGateway: DEFAULT_PIX_GATEWAY });

export function PaymentOptionsProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<PaymentOptions>({ cardEnabled: false, pixGateway: DEFAULT_PIX_GATEWAY });

  useEffect(() => {
    void fetch("/api/payment-public", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { cardEnabled?: boolean; pixGateway?: unknown }) => {
        setOptions({
          cardEnabled: STOREFRONT_ALLOWS_CARD && data.cardEnabled === true,
          pixGateway: isPixGateway(data.pixGateway) ? data.pixGateway : DEFAULT_PIX_GATEWAY,
        });
      })
      .catch(() => {
        setOptions({ cardEnabled: false, pixGateway: DEFAULT_PIX_GATEWAY });
      });
  }, []);

  return <PaymentOptionsContext.Provider value={options}>{children}</PaymentOptionsContext.Provider>;
}

export function useCardEnabled() {
  return useContext(PaymentOptionsContext).cardEnabled;
}

export function usePixGateway() {
  return useContext(PaymentOptionsContext).pixGateway;
}
