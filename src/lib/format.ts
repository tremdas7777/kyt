import { INSTALLMENT_FEE, INSTALLMENTS, clampInstallments } from "@/data/catalog";

export function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function installmentValue(price: number, times = INSTALLMENTS) {
  const n = clampInstallments(times);
  const total = n > 1 ? price * (1 + INSTALLMENT_FEE) : price;
  return formatBRL(total / n);
}

export function formatCep(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, (_, a, b, c) =>
      c ? `(${a}) ${b}-${c}` : b ? `(${a}) ${b}` : a ? `(${a}` : "",
    );
  }
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, (_, a, b, c) =>
    c ? `(${a}) ${b}-${c}` : `(${a}) ${b}`,
  );
}

export function formatCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function formatDuration(ms: number) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

export function formatRelativeTime(iso: string, now = Date.now()) {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed) || parsed <= 0) return "—";
  const diff = Math.max(0, now - parsed);
  if (diff < 10_000) return "agora";
  return formatDuration(diff);
}
