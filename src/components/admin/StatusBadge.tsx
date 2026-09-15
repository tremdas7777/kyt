export function StatusBadge({ status }: { status: string }) {
  const label = status === "paid" ? "Pago" : status === "failed" ? "Falhou" : "Pendente";
  const color = status === "paid" ? "text-emerald-400" : status === "failed" ? "text-[#CC2222]" : "text-amber-400";
  return <p className={`text-[11px] font-bold tracking-widest uppercase ${color}`}>{label}</p>;
}
