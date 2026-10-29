'use client';
// Paginação padrão das listas (25 itens por página), como no Sonata
export const POR_PAGINA = 25;
export const paginar = (lista, pagina, porPagina = POR_PAGINA) => {
  const paginas = Math.max(1, Math.ceil(lista.length / porPagina));
  const pag = Math.min(Math.max(0, pagina), paginas - 1);
  return { itens: lista.slice(pag * porPagina, (pag + 1) * porPagina), pag, paginas };
};

export default function Paginacao({ pag, paginas, onMudar, rolarPara }) {
  if (paginas <= 1) return null;
  const ir = n => { onMudar(n); if (rolarPara) setTimeout(() => document.getElementById(rolarPara)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30); };
  return (
    <div className="row" style={{ margin: '10px 0', justifyContent: 'center', gap: 8 }}>
      <button type="button" className="sec mini" onClick={() => ir(pag - 1)} disabled={pag === 0}>‹ Anterior</button>
      <span className="mut" style={{ fontSize: '.9rem' }}>Página {pag + 1} de {paginas}</span>
      <button type="button" className="sec mini" onClick={() => ir(pag + 1)} disabled={pag >= paginas - 1}>Próxima ›</button>
    </div>
  );
}
