export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#080808]">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-3 lg:px-10">
        <div>
          <img src="/logo-kyt.svg" alt="KYT" className="h-10 w-auto" />
          <p className="mt-4 font-display text-lg font-bold uppercase tracking-wide text-[#F0F0F0]">
            World Class Helmet
          </p>
          <p className="mt-2 max-w-xs font-sans text-sm text-[#6A6A6A]">
            Representante oficial da marca KYT no Brasil.
          </p>
        </div>

        <div>
          <p className="mb-6 font-display text-xs font-bold tracking-[0.18em] text-[#6A6A6A] uppercase">
            Links
          </p>
          <div className="flex flex-col gap-3">
            <a href="/#sobre" className="font-sans text-sm text-[#F0F0F0] opacity-60 transition-opacity hover:opacity-100">
              Sobre a KYT
            </a>
            <a href="/produtos" className="font-sans text-sm text-[#F0F0F0] opacity-60 transition-opacity hover:opacity-100">
              Produtos
            </a>
            <a href="/viseiras" className="font-sans text-sm text-[#F0F0F0] opacity-60 transition-opacity hover:opacity-100">
              Viseiras
            </a>
            <a href="/#pilotos" className="font-sans text-sm text-[#F0F0F0] opacity-60 transition-opacity hover:opacity-100">
              Pilotos
            </a>
            <a href="/contato" className="font-sans text-sm text-[#F0F0F0] opacity-60 transition-opacity hover:opacity-100">
              Contato
            </a>
          </div>
        </div>

        <div>
          <p className="mb-6 font-display text-xs font-bold tracking-[0.18em] text-[#6A6A6A] uppercase">
            Contato
          </p>
          <div className="flex flex-col gap-3">
            <a
              href="https://instagram.com/capacetekyt"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 font-sans text-sm text-[#F0F0F0] opacity-60 transition-opacity hover:opacity-100"
            >
              <InstagramIcon />
              @capacetekyt
            </a>
            <a
              href="https://tiktok.com/@capacete.kyt"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 font-sans text-sm text-[#F0F0F0] opacity-60 transition-opacity hover:opacity-100"
            >
              <TikTokIcon />
              @capacete.kyt
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl border-t border-white/8 px-6 py-6 lg:px-10">
        <p className="font-sans text-[11px] text-[#6A6A6A]">
          Quality & Winner Motors Importação e Exportação LTDA — CNPJ: 04.697.725/0002-12 — Rua Bahia,
          363, Alphaville, Barueri – SP
        </p>
        <p className="mt-1 font-sans text-[11px] text-[#6A6A6A]">
          Filial: Rodovia BR 470, Ingo Hering, 1601, São Domingos, Navegantes – SC — CNPJ:
          04.697.725/0003-01
        </p>
        <p className="mt-2 font-sans text-[11px] text-[#6A6A6A]">
          KYT Helmets Brasil — Todos os direitos reservados
        </p>
      </div>
    </footer>
  );
}

function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.83 2.83 0 0 1-2.83 2.83 2.83 2.83 0 0 1-2.83-2.83 2.83 2.83 0 0 1 2.83-2.83c.28 0 .56.04.82.12V9.41a6.27 6.27 0 0 0-.82-.05 6.28 6.28 0 0 0-6.28 6.28 6.28 6.28 0 0 0 6.28 6.28 6.28 6.28 0 0 0 6.28-6.28V8.73a8.18 8.18 0 0 0 4.77 1.52V6.84a4.84 4.84 0 0 1-1-.15z" />
    </svg>
  );
}
