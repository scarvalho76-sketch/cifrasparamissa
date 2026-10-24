// Importação de cifras em PDF (como as exportadas pelo Cifra Club).
// O PDF guarda a posição de cada pedaço de texto; como o corpo da cifra usa fonte de largura fixa,
// dá para reconstruir as colunas e manter os acordes em cima das sílabas certas.
import { lerTom, letraDaCifra } from './musica';

const mediana = arr => { const a = [...arr].sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; };

// paginas: [[{ s, x, y, w, h }]] com y medido de cima para baixo
export function montarDoPdf(paginas) {
  const itens = [];
  paginas.forEach((p, i) => p.forEach(it => { if (it.s && it.s.trim() && it.h > 0) itens.push({ ...it, y: it.y + i * 10000, pag: i }); }));
  if (!itens.length) return null;

  // altura mais comum (por quantidade de letras) = corpo da cifra
  const peso = {};
  itens.forEach(it => { const k = Math.round(it.h * 10) / 10; peso[k] = (peso[k] || 0) + it.s.length; });
  const hCorpo = Number(Object.entries(peso).sort((a, b) => b[1] - a[1])[0][0]);
  const ehCorpo = it => Math.abs(it.h - hCorpo) < 0.6;

  // título e artista: os dois maiores tamanhos de letra da primeira página
  const grandes = [...new Set(itens.filter(it => it.pag === 0 && it.h > hCorpo * 1.25).map(it => Math.round(it.h * 10) / 10))].sort((a, b) => b - a);
  const textoDoTamanho = h => itens.filter(it => it.pag === 0 && Math.abs(it.h - h) < 0.2).sort((a, b) => a.y - b.y || a.x - b.x).map(it => it.s.trim()).join(' ').trim();
  const nome = grandes[0] ? textoDoTamanho(grandes[0]) : '';
  const artista = grandes[1] ? textoDoTamanho(grandes[1]) : '';

  // agrupa em linhas pela altura na página
  const ordenados = itens.filter(ehCorpo).sort((a, b) => a.y - b.y || a.x - b.x);
  const linhas = [];
  for (const it of ordenados) {
    const ult = linhas[linhas.length - 1];
    if (ult && Math.abs(ult.y - it.y) < 4) ult.itens.push(it); else linhas.push({ y: it.y, pag: it.pag, itens: [it] });
  }

  // largura de um caractere e margem esquerda do corpo
  const larguras = ordenados.filter(it => it.s.trim().length >= 3 && !/\s/.test(it.s.trim())).map(it => it.w / it.s.length);
  const cw = mediana(larguras) || hCorpo * 0.6;
  const x0 = Math.min(...ordenados.map(it => it.x));

  let tom = '';
  let capo = 0;
  const saida = [];
  const espacos = [];
  for (let i = 1; i < linhas.length; i++) if (linhas[i].pag === linhas[i - 1].pag) espacos.push(linhas[i].y - linhas[i - 1].y);
  const passo = mediana(espacos.filter(d => d > 2)) || hCorpo * 1.6;

  let anterior = null;
  for (const l of linhas) {
    const its = l.itens.sort((a, b) => a.x - b.x);
    const plano = its.map(it => it.s).join(' ').replace(/\s+/g, ' ').trim();
    if (/^tom\s*:/i.test(plano)) { tom = plano.replace(/^tom\s*:\s*/i, '').trim(); anterior = l; continue; }
    if (/^afina[cç][aã]o\s*:/i.test(plano) || /^composi[cç][aã]o de/i.test(plano)) { anterior = l; continue; }
    const mc = /^capotraste\s+na\s+(\d{1,2})/i.exec(plano);
    if (mc) { capo = Number(mc[1]); anterior = l; continue; }
    let s = '';
    for (const it of its) {
      const col = Math.max(0, Math.round((it.x - x0) / cw));
      const txt = it.s.replace(/\s+$/, '');
      if (!txt.trim()) continue;
      s += ' '.repeat(Math.max(col - s.length, s && !s.endsWith(' ') && !txt.startsWith(' ') ? 1 : 0)) + txt;
    }
    if (anterior && anterior.pag === l.pag && l.y - anterior.y > passo * 1.45 && saida.length) saida.push('');
    saida.push(s.replace(/\s+$/, ''));
    anterior = l;
  }
  // linha em branco logo depois do nome da parte não ajuda: sai
  const cifra = saida.join('\n').replace(/^(\s*\[[^\]]+\]\s*)\n\n/gm, '$1\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
  // Com capotraste, o Cifra Club escreve "Tom: A (forma dos acordes no tom de G)": os acordes estão em G
  const tomReal = (tom.match(/^\S+/) || [''])[0];
  const formaTxt = (/forma dos acordes no tom de\s+([A-G][#b]?m?)/i.exec(tom) || [])[1] || '';
  const tomCifra = formaTxt || tomReal;
  return {
    nome, artista, tom: lerTom(tomCifra) ? tomCifra : '', tomTexto: tom, cifra, letra: letraDaCifra(cifra),
    capo, tomReal: formaTxt && lerTom(tomReal) ? tomReal : ''
  };
}

// Lê o arquivo no navegador com o pdf.js e devolve { nome, artista, tom, cifra, letra }
export async function lerPdfDeCifra(arquivo) {
  const pdfjs = await import('pdfjs-dist');
  // o worker fica em /public com a mesma versão do pacote (pdfjs-dist 4.10.38)
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
  const paginas = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const p = await doc.getPage(n);
    const vp = p.getViewport({ scale: 1 });
    const tc = await p.getTextContent();
    paginas.push(tc.items.map(it => ({ s: it.str, x: it.transform[4], y: vp.height - it.transform[5], w: it.width, h: it.height })));
  }
  const r = montarDoPdf(paginas);
  if (!r || !r.cifra) throw new Error('Não encontrei texto neste PDF. Ele pode ser uma imagem escaneada.');
  return r;
}
