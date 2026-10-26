// Leitura da Liturgia Diária (site das Edições CNBB): extrai da página do dia
// o nome da celebração, a cor e a Aclamação ao Evangelho (referência, refrão e verso).

const ENTIDADES = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', ordm: 'º', ordf: 'ª' };
// HTML -> texto, mantendo as quebras de linha
export function htmlParaTexto(html) {
  return String(html || '')
    .replace(/<div[^>]*display:\s*none[^>]*>[\s\S]*?<\/div>/gi, '')
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

// Primeira leitura, segunda leitura (quando houver) e Evangelho, com o texto
// Os títulos podem vir com complemento: "SEGUNDA LEITURA (mais longa)", "EVANGELHO (mais breve)".
// Quando há versão longa e breve, fica a primeira que aparece (a outra é ignorada).
const COMPL = '(\\s*\\(.*\\))?\\s*$';
const CABECALHOS = [['primeira', new RegExp('^PRIMEIRA LEITURA' + COMPL, 'i')], ['salmo', /^Salmo responsorial/i],
  ['segunda', new RegExp('^SEGUNDA LEITURA' + COMPL, 'i')],
  ['aclamacao', /^Aclama[cç][aã]o ao Evangelho/i], ['evangelho', new RegExp('^EVANGELHO' + COMPL)]];
export function lerLeituras(body) {
  const linhas = htmlParaTexto(body).split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim());
  const secoes = []; let atual = null;
  for (const l of linhas) {
    const c = CABECALHOS.find(([, re]) => re.test(l));
    if (c) {
      // dias com mais de uma missa (Natal, por exemplo): fica a primeira
      if (secoes.some(s => s.tipo === c[0])) { atual = null; continue; }
      atual = { tipo: c[0], cab: l, linhas: [] }; secoes.push(atual); continue;
    }
    if (atual) atual.linhas.push(l);
  }
  const out = [];
  for (const s of secoes) {
    if (s.tipo === 'salmo') { const sl = lerSalmo(s); if (sl) out.salmo = sl; continue; }
    if (!['primeira', 'segunda', 'evangelho'].includes(s.tipo)) continue;
    // sem os números dos versículos, linhas vazias e avisos de outra missa do dia
    const ls = s.linhas.filter(l => l && !/^\d+[a-z]{0,3}$/i.test(l) && !/^Missa (da|do|na|de)\b/i.test(l));
    const iAb = ls.findIndex(l => /^(Leitura d|Proclama[cç][aã]o do Evangelho|In[ií]cio d)/i.test(l));
    const abertura = iAb >= 0 ? ls[iAb] : '';
    const ref = ((abertura.match(/(\d+[\d,.\-–a-z ]*)$/i) || [])[1] || '').trim();
    out.push({
      tipo: s.tipo,
      titulo: { primeira: 'Primeira Leitura', segunda: 'Segunda Leitura', evangelho: 'Evangelho' }[s.tipo]
        + ((s.cab.match(/\(([^)]+)\)/) || [])[1] ? ` (${s.cab.match(/\(([^)]+)\)/)[1].trim()})` : ''),
      resumo: iAb > 0 ? ls.slice(0, iAb).join(' ') : '',
      abertura: ref ? abertura.slice(0, abertura.length - ref.length).trim() : abertura,
      referencia: ref,
      texto: (iAb >= 0 ? ls.slice(iAb + 1) : ls).join('\n')
    });
  }
  return out;
}

// Salmo responsorial: referência, refrão (R.) e estrofes (cada uma termina em "R.")
function lerSalmo(s) {
  const linhas = s.linhas;
  const numero = l => /^\d+[a-z]{0,3}$/i.test(l);
  let referencia = s.cab.replace(/^Salmo responsorial/i, '').trim();
  let k = 0;
  if (!referencia) { while (k < linhas.length && !linhas[k]) k++; if (/^Sl\b/i.test(linhas[k] || '')) referencia = linhas[k++]; }
  while (k < linhas.length && !/^R\.\s*\S/.test(linhas[k])) k++;
  if (k >= linhas.length) return null;
  // refrão: a linha do "R." e as que continuam até a primeira linha vazia
  const refrao = [linhas[k].replace(/^R\.\s*/, '')];
  for (k++; k < linhas.length && linhas[k] && !numero(linhas[k]); k++) refrao.push(linhas[k]);
  const estrofes = []; let atual = [];
  for (; k < linhas.length; k++) {
    const l = linhas[k];
    if (!l || numero(l)) continue;
    if (/^R\.$/.test(l)) { if (atual.length) { estrofes.push(atual); atual = []; } continue; }
    const fim = /\sR\.$/.test(l);
    atual.push(l.replace(/\s*R\.$/, ''));
    if (fim) { estrofes.push(atual); atual = []; }
  }
  if (atual.length) estrofes.push(atual);
  return {
    referencia: referencia.replace(/\s+/g, ' '), refrao: refrao.join(' ').replace(/\s+/g, ' ').trim(),
    texto: estrofes.map(e => e.join('\n') + '\nR.').join('\n\n')
  };
}

export function lerCelebracao(details) {
  const t = htmlParaTexto(details).split('\n').map(juntar).filter(Boolean);
  // linhas: [data, celebração, semana]
  return { celebracao: t[1] || '', semana: t[2] || '' };
}

// A lista "Leituras:" do site traz as referências com o livro (ex.: "1Ts 1,5c-10"), na ordem da missa
function comSiglas(leituras, listaHtml) {
  const refs = htmlParaTexto(listaHtml).split('\n').map(juntar)
    .filter(l => l && !/^leituras:?$/i.test(l) && !/^sl\b/i.test(l));
  // só usa a sigla se ela confere com a referência da própria leitura (no Natal, por exemplo,
  // o texto pode ser de uma missa e a lista de outra)
  const sem = t => t.replace(/\s*\(.*\)\s*$/, '').replace(/\s+/g, '');
  // "1Ts 1,5c-10" confere com "1,5c-10": sigla do livro + exatamente a mesma referência
  const confere = (r, ref) => { const x = sem(r), y = sem(ref); return !!y && x.endsWith(y) && /^[1-3]?[A-Za-zÀ-ú]+$/.test(x.slice(0, x.length - y.length)); };
  // "1Ts 4,13-18 (mais longa) ou 4,13-14 (mais breve)" -> "1Ts 4,13-18"
  const limpa = r => r.split(/\s+ou\s+/)[0].replace(/\s*\([^)]*\)\s*$/, '').trim();
  return leituras.map(l => { const r = refs.find(x => confere(x, l.referencia)); return { ...l, sigla: r ? limpa(r) : l.referencia }; });
}

export function lerDia(content, completo = false) {
  if (!content) return null;
  return {
    data: content.date, tempo: content.title || '', cor: content.color || '',
    ...lerCelebracao(content.details), aclamacao: lerAclamacao(content.body),
    ...(completo ? (() => {
      const l = lerLeituras(content.body);
      const salmo = l.salmo || null;
      // referência do salmo pela lista de leituras, quando não vem junto do título
      if (salmo && !salmo.referencia) salmo.referencia = htmlParaTexto(content.leituras).split('\n').map(juntar).find(x => /^Sl\b/i.test(x)) || '';
      return { leituras: comSiglas(l, content.leituras), salmo };
    })() : {})
  };
}
