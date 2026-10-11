/** Erro de tempo esgotado ao falar com um serviço externo. */
export class TimeoutError extends Error {
  constructor(service: string, ms: number) {
    super(`${service} não respondeu em ${Math.round(ms / 1000)}s. Tente novamente.`);
    this.name = "TimeoutError";
  }
}

/**
 * fetch com limite de tempo. Sem isso, um serviço externo lento (gateway, UTMify, Pushcut, Meta)
 * deixa o pedido "carregando" até o navegador desistir ("Load failed").
 */
export async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 15000, service = "O serviço"): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: init.signal ?? controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new TimeoutError(service, ms);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
