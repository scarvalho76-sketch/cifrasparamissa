// Salmo (ou qualquer música) a partir de um vídeo do YouTube: a cifra costuma estar na descrição.
import { ehAcorde, ehLinhaDeAcordes, lerTom } from './musica';

export const idDoVideo = t => {
  const s = String(t || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/|\/v\/)([\w-]{11})/);
  return m ? m[1] : '';
};
export const linkDoVideo = t => { const id = idDoVideo(t); return id ? `https://www.youtube.com/watch?v=${id}` : ''; };

// "[G]Senhor, [D]tu me conheces" -> linha de acordes em cima da letra (também aceita (G) entre parênteses)
const INLINE = /\[([^\]\s]{1,12})\]|\(([A-G][^)\s]{0,10})\)/g;
function separarInline(linha) {
  const achados = [...linha.matchAll(INLINE)].filter(m => ehAcorde(m[1] || m[2]));
  if (!achados.length) return null;
  let letra = '', acordes = '', ult = 0;
  for (const m of achados) {
    letra += linha.slice(ult, m.index);
    const col = Math.max(letra.length, acordes.length ? acordes.length + 1 : 0);
    acordes += ' '.repeat(col - acordes.length) + (m[1] || m[2]);
    if (col > letra.length) letra += ' '.repeat(col - letra.length);
    ult = m.index + m[0].length;
  }
  letra += linha.slice(ult);
  return letra.trim() ? [acordes, letra.replace(/\s+$/, '')] : [acordes];
}

const ROTULO = /^\s*(\[[^\]]+\]|(refr[aã]o|r\.|r:|resp\.?|intro(du[cç][aã]o)?|estrofe|solo|final)\b.*|.*:\s*)$/i;
const LIXO = /https?:\/\/|www\.|^\s*#\w|inscreva|curta|compartilhe|instagram|facebook|whatsapp|pix|chave pix|contato/i;

// Encontra a cifra na descrição e devolve { cifra, tom, capo, achou }
export function cifraDaDescricao(descricao) {
  const bruto = String(descricao || '').replace(/\r\n?/g, '\n').replace(/ /g, ' ').replace(/\t/g, '    ');
  // converte acordes no meio da letra
  const linhas = [];
  for (const l of bruto.split('\n')) { const s = separarInline(l); if (s) linhas.push(...s); else linhas.push(l.replace(/\s+$/, '')); }
  const tomM = bruto.match(/\btom\s*[:\-]?\s*([A-G][#b]?m?)(?![a-z])/i);
  const capoM = bruto.match(/capo(?:traste)?\D{0,12}(\d{1,2})/i);
  const capo = capoM ? Number(capoM[1]) : 0;
  const ehAc = l => ehLinhaDeAcordes(l.trim()) && !/^\s*tom\b/i.test(l);
  const idx = linhas.map((l, i) => (ehAc(l) ? i : -1)).filter(i => i >= 0);
  if (!idx.length) return { cifra: '', tom: lerTom(tomM?.[1] || '') ? tomM[1] : '', capo, achou: false };
  let ini = idx[0], fim = idx[idx.length - 1];
  // um rótulo logo antes ("Refrão:", "R.") entra junto
  if (ini > 0 && linhas[ini - 1].trim() && ROTULO.test(linhas[ini - 1]) && !LIXO.test(linhas[ini - 1])) ini--;
  // a letra da última linha de acordes entra junto
  if (fim + 1 < linhas.length && linhas[fim + 1].trim() && !LIXO.test(linhas[fim + 1])) fim++;
  const bloco = linhas.slice(ini, fim + 1).filter(l => !LIXO.test(l) && !/^\s*tom\s*[:\-]/i.test(l) && !/^\s*capo/i.test(l));
  // "Refrão:" vira [Refrão] (nome da parte em negrito no Modo celebração)
  const comPartes = bloco.map(l => { const m = l.match(/^\s*(refr[aã]o|estrofe|intro(?:du[cç][aã]o)?|final|solo)\s*:?\s*$/i); return m ? `[${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()}]` : l; });
  const cifra = comPartes.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
  // sem "Tom:" escrito, o primeiro acorde costuma ser o tom
  let tom = lerTom(tomM?.[1] || '') ? tomM[1] : '';
  if (!tom) { const prim = (linhas[idx[0]].trim().match(/[^\s|]+/) || [''])[0]; if (ehAcorde(prim)) tom = prim.replace(/[.,;]+$/, '').replace(/^([A-G][#b]?m?).*$/, '$1'); }
  return { cifra, tom: lerTom(tom) ? tom : '', capo, achou: true };
}

// Nome da música a partir do título do vídeo (tira "| canal", "#hashtags", "(Clipe Oficial)"...)
export function nomeDoTitulo(t) {
  return String(t || '').replace(/#\S+/g, '').replace(/\s*[|•].*$/, '')
    .replace(/\((?:clipe|v[ií]deo|lyric|letra|oficial|ao vivo|cover)[^)]*\)/gi, '').replace(/\s{2,}/g, ' ').trim();
}

// No navegador: busca o vídeo pelo servidor do Cantus e monta os dados para o editor da Biblioteca
export async function lerVideoDoYoutube(link) {
  const id = idDoVideo(link);
  if (!id) throw new Error('Não entendi este link do YouTube.');
  const r = await fetch('/api/youtube?v=' + id);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || 'Não foi possível ler o vídeo.');
  const c = cifraDaDescricao(j.descricao);
  return { ...c, nome: nomeDoTitulo(j.titulo), artista: j.canal || '', video: j.link, descricao: j.descricao };
}
