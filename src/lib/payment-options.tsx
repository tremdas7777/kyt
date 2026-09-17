import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { STOREFRONT_ALLOWS_CARD } from "@/lib/payment-types";

type PaymentOptions = {
  cardEnabled: boolean;
};

const PaymentOptionsContext = createContext<PaymentOptions>({ cardEnabled: false });

export function PaymentOptionsProvider({ children }: { children: ReactNode }) {
  const [cardEnabled, setCardEnabled] = useState(false);

  useEffect(() => {
    if (!STOREFRONT_ALLOWS_CARD) {
      setCardEnabled(false);
      return;
    }
    void fetch("/api/payment-public", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { cardEnabled?: boolean }) => {
        setCardEnabled(data.cardEnabled === true);
      })
      .catch(() => {
        setCardEnabled(false);
      });
  }, []);

  return <PaymentOptionsContext.Provider value={{ cardEnabled }}>{children}</PaymentOptionsContext.Provider>;
}

export function useCardEnabled() {
  return useContext(PaymentOptionsContext).cardEnabled;
}
