// Leitura da Liturgia Diária (site das Edições CNBB): extrai da página do dia
// o nome da celebração, a cor e a Aclamação ao Evangelho (referência, refrão e verso).

const ENTIDADES = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', ordm: 'º', ordf: 'ª' };
// HTML -> texto, mantendo as quebras de linha
export function htmlParaTexto(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|center|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e) => e[0] === '#'
      ? String.fromCharCode(e[1] === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
      : (ENTIDADES[e.toLowerCase()] ?? m))
    .replace(/ /g, ' ');
}
const juntar = t => t.replace(/\s+/g, ' ').trim();

export function lerAclamacao(body) {
  const texto = htmlParaTexto(body);
  const ini = texto.search(/Aclama[cç][aã]o ao Evangelho/i);
  if (ini < 0) return null;
  // vai até o início do Evangelho (escrito em maiúsculas no site)
  let trecho = texto.slice(ini);
  const fim = trecho.search(/\n\s*EVANGELHO\b/);
  if (fim > 0) trecho = trecho.slice(0, fim);
  const iR = trecho.search(/(^|\n)\s*R\.\s/);
  const iV = trecho.search(/(^|\n)\s*V\.\s/);
  if (iV < 0) return null;
  const cab = trecho.slice(0, iR >= 0 ? iR : iV).replace(/Aclama[cç][aã]o ao Evangelho/i, '');
  return {
    referencia: juntar(cab),
    refrao: iR >= 0 ? juntar(trecho.slice(iR, iV).replace(/^\s*R\.\s*/, '')) : '',
    verso: juntar(trecho.slice(iV).replace(/^\s*V\.\s*/, ''))
  };
}

export function lerCelebracao(details) {
  const t = htmlParaTexto(details).split('\n').map(juntar).filter(Boolean);
  // linhas: [data, celebração, semana]
  return { celebracao: t[1] || '', semana: t[2] || '' };
}

export function lerDia(content) {
  if (!content) return null;
  return {
    data: content.date, tempo: content.title || '', cor: content.color || '',
    ...lerCelebracao(content.details), aclamacao: lerAclamacao(content.body)
  };
}
