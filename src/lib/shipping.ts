export const SHIPPING_METHODS = ["gratis", "full", "expresso"] as const;
export type ShippingMethod = (typeof SHIPPING_METHODS)[number];

export type ShippingOption = {
  id: ShippingMethod;
  /** Nome exibido (vazio no "full", que mostra o selo Envio Full). */
  title: string;
  eta: string;
  price: number;
};

/** Opções de frete do checkout. O servidor cobra o preço daqui pela opção escolhida. */
export const SHIPPING_OPTIONS: ShippingOption[] = [
  {
    id: "gratis",
    title: "Frete grátis",
    eta: "5 a 8 dias úteis",
    price: 0,
  },
  {
    id: "full",
    title: "",
    eta: "3 a 5 dias úteis",
    price: 24.9,
  },
  {
    id: "expresso",
    title: "Frete Expresso",
    eta: "1 a 2 dias úteis",
    price: 39.9,
  },
];

export function isShippingMethod(value: unknown): value is ShippingMethod {
  return typeof value === "string" && (SHIPPING_METHODS as readonly string[]).includes(value);
}

export function shippingOption(id: ShippingMethod): ShippingOption {
  return SHIPPING_OPTIONS.find((option) => option.id === id) ?? SHIPPING_OPTIONS[0]!;
}

export function shippingPrice(id: ShippingMethod): number {
  return shippingOption(id).price;
}

/** Nome do envio para textos e cobrança (ex.: "Envio Full", "Frete Expresso"). */
export function shippingName(id: ShippingMethod): string {
  return shippingOption(id).title || "Envio Full";
}

export function shippingLabel(id: ShippingMethod): string {
  const option = shippingOption(id);
  return option.title ? `${option.title} · ${option.eta}` : option.eta;
}
