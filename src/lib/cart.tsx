import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { PaymentGateway } from "@/lib/payment-types";
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
  paymentGateway?: PaymentGateway;
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
  paymentGateway?: PaymentGateway;
  errorMessage?: string;
  /** Pedido de upsell: id do pedido principal (pago) ao qual esta cobrança extra pertence. */
  parentOrderId?: string;
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
  placeOrder: (customer: CheckoutPayload, extras: PlaceOrderExtras, extraItems?: CartItem[]) => Order;
  /** Cobrança extra (upsell) ligada a um pedido já pago; não mexe no carrinho. */
  placeExtraOrder: (parent: Order, extraItems: CartItem[], extras: PlaceOrderExtras) => Order;
  getOrder: (id: string) => Order | undefined;
  /** Pedidos extras (upsell) de um pedido principal. */
  getChildOrders: (parentId: string) => Order[];
  updateOrderPayment: (id: string, paymentStatus: PaymentStatus) => void;
  /** Volta os capacetes de um pedido para o carrinho (ex.: PIX expirado). */
  restoreOrderToCart: (order: Order) => void;
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
    (customer: CheckoutPayload, extras: PlaceOrderExtras, extraItems: CartItem[] = []) => {
      const allItems = [...items, ...extraItems];
      const subtotal = allItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const order: Order = {
        id: `KYT-${Date.now().toString(36).toUpperCase()}`,
        createdAt: new Date().toISOString(),
        items: allItems,
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
        ...(extras.paymentGateway ? { paymentGateway: extras.paymentGateway } : {}),
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

  const placeExtraOrder = useCallback((parent: Order, extraItems: CartItem[], extras: PlaceOrderExtras) => {
    const subtotal = extraItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const order: Order = {
      id: `KYT-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      items: extraItems,
      customer: { ...parent.customer, payment: "pix" },
      subtotal,
      shipping: 0,
      shippingMethod: parent.shippingMethod ?? "gratis",
      total: extras.total,
      discount: extras.discount,
      paymentStatus: extras.paymentStatus,
      parentOrderId: parent.id,
      ...(extras.transactionId ? { transactionId: extras.transactionId } : {}),
      ...(extras.referenceId ? { referenceId: extras.referenceId } : {}),
      ...(extras.pix ? { pix: extras.pix } : {}),
      ...(extras.eventId ? { eventId: extras.eventId } : {}),
      ...(extras.paymentGateway ? { paymentGateway: extras.paymentGateway } : {}),
    };
    const orders = readJson<Order[]>(ORDERS_KEY, []);
    writeOrders([order, ...orders]);
    return order;
  }, []);

  const getChildOrders = useCallback((parentId: string) => {
    return readJson<Order[]>(ORDERS_KEY, []).filter((order) => order.parentOrderId === parentId);
  }, []);

  const restoreOrderToCart = useCallback((order: Order) => {
    const helmets = order.items.filter((item) => !item.id.startsWith("offer::"));
    if (helmets.length === 0) return;
    persistCart(helmets);
    setItems(helmets);
  }, []);

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
      placeExtraOrder,
      getOrder,
      getChildOrders,
      updateOrderPayment,
      restoreOrderToCart,
    };
  }, [
    items,
    addItem,
    removeItem,
    updateQty,
    clear,
    isOpen,
    hydrated,
    placeOrder,
    placeExtraOrder,
    getOrder,
    getChildOrders,
    updateOrderPayment,
    restoreOrderToCart,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
