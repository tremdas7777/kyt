import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type PaymentOptions = {
  cardEnabled: boolean;
};

const PaymentOptionsContext = createContext<PaymentOptions>({ cardEnabled: true });

export function PaymentOptionsProvider({ children }: { children: ReactNode }) {
  const [cardEnabled, setCardEnabled] = useState(true);

  useEffect(() => {
    void fetch("/api/payment-public", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { cardEnabled?: boolean }) => {
        setCardEnabled(data.cardEnabled !== false);
      })
      .catch(() => {
        setCardEnabled(true);
      });
  }, []);

  return <PaymentOptionsContext.Provider value={{ cardEnabled }}>{children}</PaymentOptionsContext.Provider>;
}

export function useCardEnabled() {
  return useContext(PaymentOptionsContext).cardEnabled;
}
