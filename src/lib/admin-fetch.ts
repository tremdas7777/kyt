export async function adminFetch(input: string, init: RequestInit = {}, ms = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, {
      ...init,
      credentials: "include",
      cache: "no-store",
      signal: init.signal ?? controller.signal,
    });
  } finally {
    window.clearTimeout(timer);
  }
}

export async function adminJson<T>(input: string, init: RequestInit = {}, ms = 8000): Promise<T | null> {
  try {
    const response = await adminFetch(input, init, ms);
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
