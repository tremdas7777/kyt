import { emptyAttribution, fromGoogleAds, fromMetaAds, fromTikTokAds } from "@/lib/ad-origin";
import { appendTrackingLog, findStoreOrder, getTrackingSettings, upsertStoreOrder } from "@/lib/admin-store.server";
import type { Attribution, PixelContent, StoreOrder, TrackPayload, TrackingSettings } from "@/lib/tracking-types";

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashed(value: string): Promise<string | undefined> {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return undefined;
  return sha256(trimmed);
}

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function contentsToMeta(contents: PixelContent[]) {
  return contents.map((item) => ({
    id: item.id,
    quantity: item.quantity,
    item_price: item.price,
  }));
}

function eventTime(): number {
  return Math.floor(Date.now() / 1000);
}

function clientIp(request: Request | undefined): string {
  if (!request) return "";
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || "";
}

async function metaUserData(payload: TrackPayload, request?: Request) {
  const customer = payload.customer;
  const name = customer?.name.trim() ?? "";
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "";
  const last = parts.slice(1).join(" ");
  const phone = digits(customer?.phone ?? "");
  const e164 = phone.startsWith("55") ? phone : phone ? `55${phone}` : "";
  const userData: Record<string, unknown> = {
    client_user_agent: payload.userAgent || request?.headers.get("user-agent") || "",
    client_ip_address: clientIp(request),
  };
  const em = await hashed(customer?.email ?? "");
  if (em) userData["em"] = [em];
  const ph = await hashed(e164);
  if (ph) userData["ph"] = [ph];
  const fn = await hashed(first);
  if (fn) userData["fn"] = [fn];
  const ln = await hashed(last);
  if (ln) userData["ln"] = [ln];
  const externalId = await hashed(digits(customer?.cpf ?? ""));
  if (externalId) userData["external_id"] = [externalId];
  const ct = await hashed(customer?.city ?? "");
  if (ct) userData["ct"] = [ct];
  const st = await hashed(customer?.state ?? "");
  if (st) userData["st"] = [st];
  const zp = await hashed(digits(customer?.cep ?? ""));
  if (zp) userData["zp"] = [zp];
  userData["country"] = [await sha256("br")];
  if (payload.attribution.fbp) userData["fbp"] = payload.attribution.fbp;
  if (payload.attribution.fbc) userData["fbc"] = payload.attribution.fbc;
  return userData;
}

async function postJson(url: string, body: unknown, headers?: Record<string, string>): Promise<{ ok: boolean; detail: string }> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    return { ok: response.ok, detail: text.slice(0, 400) || String(response.status) };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "falha de rede" };
  }
}

const META_MAP: Record<string, string> = {
  PageView: "PageView",
  ViewContent: "ViewContent",
  AddToCart: "AddToCart",
  InitiateCheckout: "InitiateCheckout",
  AddPaymentInfo: "AddPaymentInfo",
  CompletePayment: "AddPaymentInfo",
  Purchase: "Purchase",
};

const TIKTOK_MAP: Record<string, string> = {
  PageView: "Pageview",
  ViewContent: "ViewContent",
  AddToCart: "AddToCart",
  InitiateCheckout: "InitiateCheckout",
  AddPaymentInfo: "AddPaymentInfo",
  CompletePayment: "CompletePayment",
  Purchase: "CompletePayment",
};

async function sendMeta(settings: TrackingSettings, payload: TrackPayload, request?: Request): Promise<void> {
  if (!settings.meta.enabled || !settings.meta.pixelId || !settings.meta.accessToken) return;
  const eventName = META_MAP[payload.event];
  if (!eventName) return;
  const customData: Record<string, unknown> = {
    currency: payload.currency,
    value: payload.value,
    content_type: "product",
    contents: contentsToMeta(payload.contents),
    content_ids: payload.contents.map((item) => item.id),
    num_items: payload.contents.reduce((sum, item) => sum + item.quantity, 0),
  };
  if (payload.orderId) customData["order_id"] = payload.orderId;
  const body: Record<string, unknown> = {
    data: [
      {
        event_name: eventName,
        event_time: eventTime(),
        event_id: payload.eventId,
        event_source_url:
          payload.sourceUrl || request?.headers.get("referer") || (request ? new URL(request.url).origin : ""),
        action_source: "website",
        user_data: await metaUserData(payload, request),
        custom_data: customData,
      },
    ],
  };
  if (settings.meta.testEventCode) body["test_event_code"] = settings.meta.testEventCode;
  const result = await postJson(
    `https://graph.facebook.com/v21.0/${encodeURIComponent(settings.meta.pixelId)}/events?access_token=${encodeURIComponent(settings.meta.accessToken)}`,
    body,
  );
  await appendTrackingLog({
    event: eventName,
    source: "capi",
    eventId: payload.eventId,
    orderId: payload.orderId ?? "",
    value: payload.value,
    ok: result.ok,
    detail: result.detail,
    ...trackingLogIdentity(payload),
  });
}

async function sendTikTok(settings: TrackingSettings, payload: TrackPayload, request?: Request): Promise<void> {
  if (!settings.tiktok.enabled || !settings.tiktok.accessToken || settings.tiktok.pixelIds.length === 0) return;
  const eventName = TIKTOK_MAP[payload.event];
  if (!eventName) return;
  const customer = payload.customer;
  const phone = digits(customer?.phone ?? "");
  const e164 = phone.startsWith("55") ? phone : phone ? `55${phone}` : "";
  const context: Record<string, unknown> = {
    user_agent: payload.userAgent || request?.headers.get("user-agent") || "",
    ip: clientIp(request),
  };
  const user: Record<string, unknown> = {};
  const emailHash = await hashed(customer?.email ?? "");
  if (emailHash) user["email"] = emailHash;
  const phoneHash = await hashed(e164);
  if (phoneHash) user["phone"] = phoneHash;
  const externalId = await hashed(digits(customer?.cpf ?? ""));
  if (externalId) user["external_id"] = externalId;
  if (payload.attribution.ttclid) user["ttclid"] = payload.attribution.ttclid;
  if (payload.attribution.ttp) user["ttp"] = payload.attribution.ttp;

  const properties: Record<string, unknown> = {
    currency: payload.currency,
    value: payload.value,
    contents: payload.contents.map((item) => ({
      content_id: item.id,
      content_name: item.name,
      content_type: "product",
      quantity: item.quantity,
      price: item.price,
    })),
    content_type: "product",
  };
  if (payload.orderId) properties["order_id"] = payload.orderId;

  for (const pixelCode of settings.tiktok.pixelIds) {
    const event: Record<string, unknown> = {
      event: eventName,
      event_time: eventTime(),
      event_id: payload.eventId,
      user,
      properties,
      page: { url: payload.sourceUrl || request?.headers.get("referer") || (request ? new URL(request.url).origin : "") },
    };
    const body: Record<string, unknown> = {
      event_source: "web",
      event_source_id: pixelCode,
      data: [event],
    };
    if (Object.keys(context).length) event["context"] = context;
    if (settings.tiktok.testEventCode) body["test_event_code"] = settings.tiktok.testEventCode;
    const result = await postJson("https://business-api.tiktok.com/open_api/v1.3/event/track/", body, {
      "Access-Token": settings.tiktok.accessToken,
    });
    await appendTrackingLog({
      event: eventName,
      source: "tiktok",
      eventId: payload.eventId,
      orderId: payload.orderId ?? "",
      value: payload.value,
      ok: result.ok,
      detail: `${pixelCode}: ${result.detail}`,
      ...trackingLogIdentity(payload),
    });
  }
}

async function sendGoogle(settings: TrackingSettings, payload: TrackPayload): Promise<void> {
  if (!settings.google.enabled || !settings.google.measurementId || !settings.google.apiSecret) return;
  const clientId = payload.attribution.clientId || crypto.randomUUID();
  const isPurchase = payload.event === "Purchase";
  const isPageView = payload.event === "PageView";
  const isCheckout = payload.event === "InitiateCheckout";
  if (!isPurchase && !isPageView && !isCheckout) return;
  const event = isPageView
    ? {
        name: "page_view",
        params: {
          page_location: payload.sourceUrl || "",
          currency: payload.currency,
        },
      }
    : isCheckout
      ? {
          name: "begin_checkout",
          params: {
            currency: payload.currency,
            value: payload.value,
            items: payload.contents.map((item) => ({
              item_id: item.id,
              item_name: item.name,
              price: item.price,
              quantity: item.quantity,
            })),
          },
        }
      : {
          name: "purchase",
          params: {
            currency: payload.currency,
            value: payload.value,
            transaction_id: payload.orderId || payload.eventId,
            items: payload.contents.map((item) => ({
              item_id: item.id,
              item_name: item.name,
              price: item.price,
              quantity: item.quantity,
            })),
          },
        };
  const result = await postJson(
    `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(settings.google.measurementId)}&api_secret=${encodeURIComponent(settings.google.apiSecret)}`,
    {
      client_id: clientId,
      events: [event],
    },
  );
  await appendTrackingLog({
    event: event.name,
    source: "google",
    eventId: payload.eventId,
    orderId: payload.orderId ?? "",
    value: payload.value,
    ok: result.ok,
    detail: result.detail,
    ...trackingLogIdentity(payload),
  });
}

export async function dispatchServerTrack(
  payload: TrackPayload,
  request?: Request,
  opts?: { force?: boolean },
): Promise<void> {
  const settings = await getTrackingSettings();
  const force = opts?.force === true;
  await Promise.all([
    force || fromMetaAds(payload.attribution) ? sendMeta(settings, payload, request) : Promise.resolve(),
    force || fromTikTokAds(payload.attribution) ? sendTikTok(settings, payload, request) : Promise.resolve(),
    force || fromGoogleAds(payload.attribution) ? sendGoogle(settings, payload) : Promise.resolve(),
  ]);
  const path = pathFromPayload(payload.sourceUrl);
  await appendTrackingLog({
    event: payload.event,
    source: "server",
    eventId: payload.eventId,
    orderId: payload.orderId ?? "",
    value: payload.value,
    ok: true,
    detail: "recebido",
    ...trackingLogIdentity(payload),
    ...(path ? { path } : {}),
  });
}

function pathFromPayload(sourceUrl?: string): string {
  const value = (sourceUrl ?? "").trim();
  if (!value) return "";
  try {
    return new URL(value, "https://capacetekyt.com.br").pathname || "/";
  } catch {
    return value.startsWith("/") ? value : "";
  }
}

function trackingLogIdentity(payload: TrackPayload): { clientId?: string; path?: string } {
  const clientId = (payload.attribution.clientId ?? "").trim();
  const path = pathFromPayload(payload.sourceUrl);
  return {
    ...(clientId ? { clientId } : {}),
    ...(path ? { path } : {}),
  };
}

function orderToPayload(order: StoreOrder, event: string): TrackPayload {
  return {
    event,
    eventId: order.eventId || `pur_${order.id}`,
    value: order.total,
    currency: "BRL",
    contents: order.items.map((item) => ({
      id: item.productId,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    })),
    orderId: order.id,
    attribution: order.attribution,
    customer: {
      name: order.customer.name,
      email: order.customer.email,
      phone: order.customer.phone,
      cpf: order.customer.cpf,
      city: order.customer.city,
      state: order.customer.state,
      cep: order.customer.cep,
    },
    userAgent: order.userAgent,
  };
}

export async function confirmPaidOrder(input: {
  id?: string;
  referenceId?: string;
  transactionId?: string;
  request?: Request;
}): Promise<StoreOrder | undefined> {
  const found = await findStoreOrder(input);
  if (!found) return undefined;
  const next: StoreOrder = {
    ...found,
    paymentStatus: "paid",
    ...(input.transactionId && !found.transactionId ? { transactionId: input.transactionId } : {}),
    ...(input.referenceId && !found.referenceId ? { referenceId: input.referenceId } : {}),
  };
  if (!found.purchaseSent) {
    next.purchaseSent = true;
    await dispatchServerTrack(orderToPayload(next, "Purchase"), input.request);
  }
  const saved = await upsertStoreOrder(next);
  const { markLivePurchased } = await import("@/lib/live.server");
  await markLivePurchased({
    clientId: saved.attribution.clientId,
    orderId: saved.id,
    email: saved.customer.email,
  });
  return saved;
}

export async function maybeMarkGeneratedAsPaid(order: StoreOrder, request?: Request): Promise<void> {
  const settings = await getTrackingSettings();
  if (!settings.tiktok.markAsPaidOnPixCreate) return;
  if (order.purchaseSent) return;
  await dispatchServerTrack(orderToPayload(order, "CompletePayment"), request, { force: true });
  await upsertStoreOrder({ ...order, purchaseSent: true });
}

export async function sendPendingOrderPurchase(order: StoreOrder, request?: Request): Promise<StoreOrder> {
  if (order.purchaseSent) return order;
  if (order.paymentStatus !== "pending") return order;
  await dispatchServerTrack(orderToPayload(order, "CompletePayment"), request);
  return order;
}

export function attributionFromUnknown(value: unknown): Attribution {
  const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    fbp: String(rec["fbp"] ?? ""),
    fbc: String(rec["fbc"] ?? ""),
    fbclid: String(rec["fbclid"] ?? ""),
    ttclid: String(rec["ttclid"] ?? ""),
    ttp: String(rec["ttp"] ?? ""),
    gclid: String(rec["gclid"] ?? ""),
    gbraid: String(rec["gbraid"] ?? ""),
    wbraid: String(rec["wbraid"] ?? ""),
    clientId: String(rec["clientId"] ?? rec["client_id"] ?? ""),
    utmSource: String(rec["utmSource"] ?? rec["utm_source"] ?? ""),
    utmMedium: String(rec["utmMedium"] ?? rec["utm_medium"] ?? ""),
  };
}
