import { BadgeCheck, CreditCard, ShieldCheck, Truck } from "lucide-react";

import { PIX_DISCOUNT } from "@/data/catalog";

const BENEFITS = [
  { icon: CreditCard, title: `PIX ${Math.round(PIX_DISCOUNT * 100)}% OFF`, text: "Desconto direto no checkout, aprovação na hora." },
  { icon: Truck, title: "Frete grátis", text: "Para todo o Brasil, ou Envio Full em 3 a 5 dias úteis." },
  { icon: BadgeCheck, title: "Produto oficial", text: "Capacetes KYT originais, com homologação e nota fiscal." },
  { icon: ShieldCheck, title: "Compra segura", text: "Pagamento criptografado e troca de tamanho facilitada." },
];

/** Faixa de vantagens logo abaixo dos banners (como a faixa de confiança da Aidex). */
export function BenefitsStrip() {
  return (
    <section className="border-y border-white/10 bg-[#0c0c0c]">
      <div className="mx-auto grid max-w-7xl grid-cols-2 divide-white/10 px-6 lg:grid-cols-4 lg:divide-x lg:px-10">
        {BENEFITS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex items-start gap-3 py-5 lg:px-6 lg:py-6 lg:first:pl-0 lg:last:pr-0">
            <Icon className="mt-0.5 h-6 w-6 shrink-0 text-[#CC2222]" strokeWidth={1.75} />
            <div>
              <p className="font-display text-sm font-black tracking-[0.08em] uppercase">{title}</p>
              <p className="mt-0.5 text-xs leading-snug text-[#6A6A6A]">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
