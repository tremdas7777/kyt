import { AsyncLocalStorage } from "node:async_hooks";

type ExecutionContext = { waitUntil?: (promise: Promise<unknown>) => void };

/** Contexto da requisição atual (para tarefas que continuam depois da resposta). */
export const requestContext = new AsyncLocalStorage<{ ctx: ExecutionContext | undefined }>();

/**
 * Roda uma tarefa depois de responder ao cliente (avisos para Meta, TikTok, Google, UTMify, Pushcut).
 * No Cloudflare usa ctx.waitUntil para a tarefa não ser cortada; fora dele, só dispara.
 */
export function runInBackground(label: string, task: () => Promise<unknown>): void {
  const promise = task().catch((error) => console.error(`[background] ${label}`, error));
  const ctx = requestContext.getStore()?.ctx;
  if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(promise);
}
