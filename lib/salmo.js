// Melodias da Biblioteca que servem para o Salmo do dia (CNBB): compara o refrão do dia com a letra
// de cada música e o número do salmo com o nome/observação. Assim a lista do Salmo não cresce com os anos.
import { simples } from './util';
import { letraDaCifra } from './musica';

const palavrasFortes = t => [...new Set(simples(t).split(' ').filter(p => p.length >= 4))];
const numerosDoSalmo = ref => (String(ref || '').match(/\d+/g) || []).slice(0, 2).map(Number);

// devolve [{ musica, nota, tipo: 'refrao' | 'numero' }] do mais parecido para o menos
export function melodiasDoSalmo(musicas, salmo) {
  if (!salmo) return [];
  const alvo = palavrasFortes(salmo.refrao);
  const nums = numerosDoSalmo(salmo.referencia);
  const reNum = nums.length ? new RegExp(`\\b(?:sl|salmo|salmos)\\s*0*(?:${nums.join('|')})\\b`) : null;
  const out = [];
  for (const m of musicas || []) {
    const texto = ' ' + simples([m.nome, m.obs, m.letra || letraDaCifra(m.cifra || '')].join(' ')) + ' ';
    const achadas = alvo.filter(p => texto.includes(' ' + p + ' ')).length;
    const refrao = alvo.length ? achadas / alvo.length : 0;
    const numero = !!reNum && reNum.test(simples([m.nome, m.obs].join(' ')));
    if (refrao >= 0.6) out.push({ musica: m, nota: refrao + (numero ? 0.5 : 0), tipo: 'refrao' });
    else if (numero) out.push({ musica: m, nota: refrao, tipo: 'numero' });
  }
  return out.sort((a, b) => b.nota - a.nota);
}

// texto padrão da observação de uma melodia nova de salmo: "Sl 23(24) · R. É assim a geração…"
export const obsDoSalmo = s => (s ? [s.referencia, s.refrao ? 'R. ' + s.refrao : ''].filter(Boolean).join(' · ') : '');

// Conferência da letra de uma melodia com o texto do salmo do dia (CNBB).
// Cada frase cantada é comparada com o texto oficial (pares de palavras seguidas); a que não bate
// volta com ok = false e, quando der, com a frase da CNBB mais parecida.
const IGNORAR = /^(r|bis|refrao|estrofe|\d+x|x\d+|\d+)$/;
const palavrasDaFrase = t => simples(String(t).replace(/\[[^\]]*\]/g, ' ')).split(' ').filter(p => p && !IGNORAR.test(p));
const pares = ws => ws.length < 2 ? new Set(ws) : new Set(ws.slice(1).map((w, i) => ws[i] + ' ' + w));

export function conferirLetra(letra, salmo) {
  if (!salmo) return [];
  const linhasCnbb = [salmo.refrao, ...String(salmo.texto || '').split('\n')].map(l => l.trim()).filter(Boolean);
  const todas = palavrasDaFrase(linhasCnbb.join(' '));
  const paresCnbb = new Set([...pares(todas), ...todas]);
  const cnbb = linhasCnbb.map(l => ({ texto: l.replace(/^R\.\s*/, ''), pares: pares(palavrasDaFrase(l)) }));
  return String(letra || '').split('\n').map(l => l.trim()).filter(l => l && !/^\[[^\]]*\]$/.test(l)).map(texto => {
    const ws = palavrasDaFrase(texto);
    if (!ws.length) return null;
    const ps = [...pares(ws)];
    const nota = ps.filter(p => paresCnbb.has(p)).length / ps.length;
    const ok = nota === 1; // a frase tem de estar igual no texto oficial (só pontuação e acentos são ignorados)
    let sugestao = '';
    if (!ok) {
      let melhor = 0;
      for (const c of cnbb) { const n = ps.filter(p => c.pares.has(p)).length / Math.max(ps.length, c.pares.size); if (n > melhor) { melhor = n; sugestao = c.texto; } }
      if (melhor < 0.25) sugestao = '';
    }
    return { texto, ok, sugestao };
  }).filter(Boolean);
}
