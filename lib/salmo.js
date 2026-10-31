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
