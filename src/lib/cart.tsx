import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { ShippingMethod } from "@/lib/shipping";

const STORAGE_KEY = "kyt-cart";
const ORDERS_KEY = "kyt-orders";

export type CartItem = {
  id: string;
  productId: string;
  name: string;
  color: string;
  size: string;
  image: string;
  price: number;
  quantity: number;
};

export type CheckoutPayload = {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  payment: "pix" | "card";
  cardName?: string;
  cardLast4?: string;
};

export type PaymentStatus = "pending" | "paid" | "failed";

export type OrderPix = {
  code: string;
  image: string;
};

export type PlaceOrderExtras = {
  total: number;
  discount: number;
  paymentStatus: PaymentStatus;
  transactionId?: string;
  referenceId?: string;
  pix?: OrderPix;
  installments?: number;
  eventId?: string;
  shipping?: number;
  shippingMethod?: ShippingMethod;
};

export type Order = {
  id: string;
  createdAt: string;
  items: CartItem[];
  customer: CheckoutPayload;
  subtotal: number;
  shipping: number;
  shippingMethod: ShippingMethod;
  total: number;
  discount: number;
  paymentStatus: PaymentStatus;
  transactionId?: string;
  referenceId?: string;
  pix?: OrderPix;
  installments?: number;
  eventId?: string;
};

type CartContextValue = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "id">, opts?: { open?: boolean }) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, quantity: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
  hydrated: boolean;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  placeOrder: (customer: CheckoutPayload, extras: PlaceOrderExtras) => Order;
  getOrder: (id: string) => Order | undefined;
  updateOrderPayment: (id: string, paymentStatus: PaymentStatus) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function cartItemId(productId: string, color: string, size: string) {
  return `${productId}::${color}::${size}`;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeOrders(orders: Order[]) {
  window.localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

function persistCart(next: CartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("kyt:cart"));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(readJson<CartItem[]>(STORAGE_KEY, []));
    setHydrated(true);
  }, []);

  const addItem = useCallback((item: Omit<CartItem, "id">, opts?: { open?: boolean }) => {
    const id = cartItemId(item.productId, item.color, item.size);
    setItems((current) => {
      const existing = current.find((entry) => entry.id === id);
      const next = existing
        ? current.map((entry) =>
            entry.id === id ? { ...entry, quantity: entry.quantity + item.quantity } : entry,
          )
        : [...current, { ...item, id }];
      persistCart(next);
      return next;
    });
    if (opts?.open !== false) setIsOpen(true);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((current) => {
      const next = current.filter((item) => item.id !== id);
      persistCart(next);
      return next;
    });
  }, []);

  const updateQty = useCallback((id: string, quantity: number) => {
    setItems((current) => {
      const next =
        quantity <= 0 ? current.filter((item) => item.id !== id) : current.map((item) => (item.id === id ? { ...item, quantity } : item));
      persistCart(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    persistCart([]);
    setItems([]);
  }, []);

  const placeOrder = useCallback(
    (customer: CheckoutPayload, extras: PlaceOrderExtras) => {
      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const order: Order = {
        id: `KYT-${Date.now().toString(36).toUpperCase()}`,
        createdAt: new Date().toISOString(),
        items: [...items],
        customer,
        subtotal,
        shipping: extras.shipping ?? 0,
        shippingMethod: extras.shippingMethod ?? "gratis",
        total: extras.total,
        discount: extras.discount,
        paymentStatus: extras.paymentStatus,
        ...(extras.transactionId ? { transactionId: extras.transactionId } : {}),
        ...(extras.referenceId ? { referenceId: extras.referenceId } : {}),
        ...(extras.pix ? { pix: extras.pix } : {}),
        ...(extras.installments ? { installments: extras.installments } : {}),
        ...(extras.eventId ? { eventId: extras.eventId } : {}),
      };
      const orders = readJson<Order[]>(ORDERS_KEY, []);
      writeOrders([order, ...orders]);
      persistCart([]);
      setItems([]);
      setIsOpen(false);
      return order;
    },
    [items],
  );

  const getOrder = useCallback((id: string) => {
    const found = readJson<Order[]>(ORDERS_KEY, []).find((order) => order.id === id);
    if (!found) return undefined;
    return {
      ...found,
      discount: found.discount ?? 0,
      paymentStatus: found.paymentStatus ?? "pending",
      shippingMethod: found.shippingMethod ?? (found.shipping > 0 ? "full" : "gratis"),
    };
  }, []);

  const updateOrderPayment = useCallback((id: string, paymentStatus: PaymentStatus) => {
    const orders = readJson<Order[]>(ORDERS_KEY, []);
    writeOrders(orders.map((order) => (order.id === id ? { ...order, paymentStatus } : order)));
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    return {
      items,
      addItem,
      removeItem,
      updateQty,
      clear,
      count,
      subtotal,
      hydrated,
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      placeOrder,
      getOrder,
      updateOrderPayment,
    };
  }, [items, addItem, removeItem, updateQty, clear, isOpen, hydrated, placeOrder, getOrder, updateOrderPayment]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
