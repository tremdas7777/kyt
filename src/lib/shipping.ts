export type ShippingMethod = "gratis" | "full";

export type ShippingOption = {
  id: ShippingMethod;
  title: string;
  eta: string;
  price: number;
};

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
];

export function shippingOption(id: ShippingMethod): ShippingOption {
  return SHIPPING_OPTIONS.find((option) => option.id === id) ?? SHIPPING_OPTIONS[0]!;
}

export function shippingPrice(id: ShippingMethod): number {
  return shippingOption(id).price;
}

export function shippingLabel(id: ShippingMethod): string {
  const option = shippingOption(id);
  return option.title ? `${option.title} · ${option.eta}` : option.eta;
}
