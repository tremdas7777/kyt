import { INSTALLMENTS } from "@/data/catalog";

export function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function installmentValue(price: number, times = INSTALLMENTS) {
  return formatBRL(price / times);
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
