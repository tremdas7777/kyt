import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/contato")({
  head: () => ({ meta: [{ title: "Contato | KYT Capacetes Brasil" }] }),
  component: ContactPage,
});

function ContactPage() {
  const [sent, setSent] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSent(true);
    toast.success("Mensagem enviada. Em breve falamos com você.");
  }

  return (
    <section className="flex min-h-[80vh] items-center pt-24 pb-16">
      <div className="mx-auto w-full max-w-xl px-6 text-center">
        <img src="/logo-kyt.svg" alt="KYT" className="mx-auto h-12 w-auto" />
        <h1 className="mt-8 font-display text-6xl font-black uppercase">Contato</h1>
        {sent ? (
          <p className="mt-6 text-[#6A6A6A]">Recebemos sua mensagem. Nossa equipe responde em breve.</p>
        ) : (
          <>
            <p className="mt-4 text-[#6A6A6A]">Fale com o time KYT Brasil.</p>
            <form onSubmit={onSubmit} className="mt-8 space-y-4 text-left">
              <input
                required
                placeholder="Nome"
                className="h-11 w-full border border-white/15 bg-transparent px-3 outline-none focus:border-[#CC2222]"
              />
              <input
                required
                type="email"
                placeholder="E-mail"
                className="h-11 w-full border border-white/15 bg-transparent px-3 outline-none focus:border-[#CC2222]"
              />
              <textarea
                required
                placeholder="Mensagem"
                rows={5}
                className="w-full border border-white/15 bg-transparent px-3 py-3 outline-none focus:border-[#CC2222]"
              />
              <button type="submit" className="kyt-btn kyt-btn-primary w-full">
                Enviar
              </button>
            </form>
          </>
        )}
        <Link to="/" className="kyt-btn kyt-btn-outline mt-8">
          ← Voltar
        </Link>
      </div>
    </section>
  );
}
