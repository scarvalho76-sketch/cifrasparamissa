import { ehLinhaDeAcordes } from './musica';

// Quebra de linhas longas da cifra para caber na tela, sem desalinhar acordes e letra:
// o par "linha de acordes + linha de letra" é cortado no MESMO ponto (num espaço da letra,
// sem partir nenhum acorde) e o resto desce como um novo par, com um pequeno recuo.
const RECUO = '  ';
const espacosIniciais = s => s.length - s.trimStart().length;
const ehAcordes = l => !!l.trim() && ehLinhaDeAcordes(l.trim());

// ponto de corte que não parte acorde: posição p com c[p-1] ou c[p] em branco
const naoPartAcorde = (c, p) => p >= c.length || p <= 0 || c[p - 1] === ' ' || c[p] === ' ';

function cortePar(c, l, larg) {
  const min = Math.max(4, Math.floor(larg * 0.4));
  // 1º: um espaço da letra onde nenhum acorde é partido
  for (let p = Math.min(larg, Math.max(c.length, l.length)); p >= min; p--)
    if ((l[p] === ' ' || p >= l.length) && naoPartAcorde(c, p)) return p;
  // 2º: qualquer ponto que não parta acorde (a palavra pode ser cortada)
  for (let p = larg; p >= min; p--) if (naoPartAcorde(c, p)) return p;
  return larg;
}

function quebrarPar(c, l, larg, saida) {
  while (Math.max(c.trimEnd().length, l.trimEnd().length) > larg) {
    const p = cortePar(c, l, larg);
    saida.push(c.slice(0, p).trimEnd(), l.slice(0, p).trimEnd());
    let c2 = c.slice(p), l2 = l.slice(p);
    // tira o espaço em comum do começo e põe o recuo nas duas linhas
    const tira = Math.min(c2.trim() ? espacosIniciais(c2) : Infinity, l2.trim() ? espacosIniciais(l2) : Infinity);
    const n = Number.isFinite(tira) ? tira : 0;
    c2 = c2.trim() ? RECUO + c2.slice(n) : ''; l2 = l2.trim() ? RECUO + l2.slice(n) : '';
    c = c2; l = l2;
    if (!c.trim() && !l.trim()) return;
    if (!c.trim()) { quebrarSimples(l, larg, saida); return; }
    if (!l.trim()) { quebrarSimples(c, larg, saida); return; } // acordes depois do fim da letra
  }
  saida.push(c.trimEnd());
  if (l.trim()) saida.push(l.trimEnd());
}

// linha sozinha (só acordes, grade ou texto): quebra num espaço
function quebrarSimples(linha, larg, saida) {
  let s = linha.trimEnd();
  while (s.length > larg) {
    let p = s.lastIndexOf(' ', larg);
    if (p <= espacosIniciais(s) + 2) p = larg;
    saida.push(s.slice(0, p).trimEnd());
    s = RECUO + s.slice(p).trimStart();
  }
  saida.push(s);
}

export function quebrarCifra(texto, larg) {
  if (!texto || !larg || larg < 12) return texto;
  const linhas = String(texto).split('\n');
  const saida = [];
  for (let i = 0; i < linhas.length; i++) {
    const a = linhas[i], b = linhas[i + 1];
    if (ehAcordes(a) && b !== undefined && b.trim() && !ehAcordes(b) && !/^\s*\[/.test(b)) {
      if (Math.max(a.trimEnd().length, b.trimEnd().length) > larg) quebrarPar(a, b, larg, saida);
      else saida.push(a, b);
      i++;
    } else if (a.trimEnd().length > larg) quebrarSimples(a, larg, saida);
    else saida.push(a);
  }
  return saida.join('\n');
}
