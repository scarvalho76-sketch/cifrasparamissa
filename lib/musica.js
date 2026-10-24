// Leitura de acordes, transposição e grade harmônica.
// Funções puras (sem banco, sem tela), usadas na Biblioteca e no Modo cerimônia.

const SUSTENIDOS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BEMOIS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
// Grafia usada quando não sabemos o tom de destino (a mais comum em cifras)
const COMUM = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SOLFEJO = { 'do': 'C', 're': 'D', 'mi': 'E', 'fa': 'F', 'sol': 'G', 'la': 'A', 'si': 'B' };
// Tons maiores escritos com bemóis
const MAIORES_BEMOL = [5, 10, 3, 8, 1]; // F Bb Eb Ab Db

const semAcento = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const mod12 = n => ((n % 12) + 12) % 12;

function indiceNota(letra, acidente) {
  let n = BASE[letra.toUpperCase()];
  if (n === undefined) return null;
  if (acidente === '#') n += 1;
  if (acidente === 'b') n -= 1;
  return mod12(n);
}

// Entende o tom como o cantor costuma escrever: "C", "Cm", "C#", "Bb", "Dó", "Ré maior", "Lá menor", "Si bemol", "F# m"...
// Devolve { raiz: 0..11, menor: bool } ou null se não der para ter certeza (ex.: "C / D", dois cantores).
export function lerTom(texto) {
  if (!texto) return null;
  let t = semAcento(String(texto)).trim().toLowerCase().replace(/\s+/g, ' ');
  if (!t || t.includes('/') || t.includes(',')) return null;
  t = t.replace(/^tom( de)?:? ?/, '');
  let menor = /\bmenor\b|\bmin\b/.test(t);
  t = t.replace(/\b(maior|menor|maj|min)\b/g, '').trim();
  t = t.replace(/\s*sustenido\b/, '#').replace(/\s*bemol\b/, 'b').replace(/\s+/g, '');
  const sol = t.match(/^(do|re|mi|fa|sol|la|si)(.*)$/);
  let letra, resto;
  if (sol) { letra = SOLFEJO[sol[1]]; resto = sol[2]; }
  else { const m = t.match(/^([a-g])(.*)$/); if (!m) return null; letra = m[1]; resto = m[2]; }
  let acidente = '';
  if (resto.startsWith('#') || resto.startsWith('b')) { acidente = resto[0]; resto = resto.slice(1); }
  if (resto === 'm' || resto === '-') { menor = true; resto = ''; }
  if (resto !== '') return null;
  return { raiz: indiceNota(letra, acidente), menor };
}

// Grafia (sustenidos ou bemóis) adequada para um tom. Se o tom foi escrito com # ou b, respeita.
function grafiaDoTom(tom, texto) {
  const t = semAcento(String(texto || '')).trim();
  if (/^[A-Ga-g]#|sustenido/i.test(t)) return SUSTENIDOS;
  if (/^[A-Ga-g]b|bemol|^(do|re|mi|fa|sol|la|si)b/i.test(t)) return BEMOIS;
  if (!tom) return COMUM;
  const maiorRelativo = tom.menor ? mod12(tom.raiz + 3) : tom.raiz;
  return MAIORES_BEMOL.includes(maiorRelativo) ? BEMOIS : SUSTENIDOS;
}

// Quantos semitons separam dois tons (de -5 a +6, o caminho mais curto)
export function distancia(de, para) {
  const a = lerTom(de), b = lerTom(para);
  if (!a || !b) return null;
  let d = mod12(b.raiz - a.raiz);
  if (d > 6) d -= 12;
  return d;
}

export function nomeDoTom(texto, semitons = 0) {
  const t = lerTom(texto);
  if (!t) return null;
  const novo = { raiz: mod12(t.raiz + semitons), menor: t.menor };
  return grafiaDoTom(novo, semitons ? '' : texto)[novo.raiz] + (novo.menor ? 'm' : '');
}

// ---------- Acordes ----------
const SUFIXO = /^(?:maj|min|dim|aug|sus|add|m|M|°|º|ø|\+|-|\d+|\(|\)|b|#|\/(?=\d)|,)*$/;
const ACORDE = /^([A-G])([#b]?)(.*?)(?:\/([A-G])([#b]?))?$/;
// Marcas que podem aparecer numa linha de acordes sem serem acordes
const NEUTRO = /^(?:\|+:?|:?\|+|\(?\d+x\)?|x\d+|N\.?C\.?|%|-+|\.+|:|\/|\(|\)|\|\|)$/i;

// Pontuação colada no acorde (ex.: "C#m.") é ignorada na leitura e mantida na escrita
const PONTUACAO = /[.,;]+$/;

export function ehAcorde(token) {
  const m = String(token).replace(PONTUACAO, '').match(ACORDE);
  return !!m && SUFIXO.test(m[3]);
}

export function transporAcorde(token, semitons, grafia = COMUM) {
  const pont = (String(token).match(PONTUACAO) || [''])[0];
  const m = String(token).replace(PONTUACAO, '').match(ACORDE);
  if (!m || !SUFIXO.test(m[3])) return token;
  const raiz = grafia[mod12(indiceNota(m[1], m[2]) + semitons)];
  const baixo = m[4] ? '/' + grafia[mod12(indiceNota(m[4], m[5]) + semitons)] : '';
  return raiz + m[3] + baixo + pont;
}

// Separa "[Refrão] G D" em cabeçalho e resto; tokens de uma linha com a coluna de cada um
const CABECALHO = /^\s*\[([^\]]+)\]\s*/;
function tokens(linha) {
  const out = []; const re = /\S+/g; let m;
  while ((m = re.exec(linha))) out.push({ t: m[0], col: m.index });
  return out;
}

// Uma linha é de acordes quando tudo nela é acorde ou marca de compasso, com ao menos um acorde
export function ehLinhaDeAcordes(linha) {
  const resto = linha.replace(CABECALHO, '');
  const tk = tokens(resto);
  if (!tk.length) return false;
  let acordes = 0;
  for (const { t } of tk) {
    // acordes colados em barras: "|G" ou "Em|"
    const pedacos = t.split('|').filter(Boolean);
    if (!pedacos.length) continue;
    for (const p of pedacos) {
      if (ehAcorde(p)) acordes++;
      else if (!NEUTRO.test(p)) return false;
    }
  }
  return acordes > 0;
}

function transporLinha(linha, semitons, grafia) {
  const cab = (linha.match(CABECALHO) || [''])[0];
  const resto = linha.slice(cab.length);
  let out = '';
  for (const { t, col } of tokens(resto)) {
    const novo = t.split(/(\|)/).map(p => (p && p !== '|' && ehAcorde(p) ? transporAcorde(p, semitons, grafia) : p)).join('');
    // mantém o acorde em cima da mesma sílaba; se o anterior cresceu, empurra só o necessário
    const destino = Math.max(col, out.length ? out.length + 1 : 0);
    out += ' '.repeat(destino - out.length) + novo;
  }
  // em grade (com |), o espaçamento é refeito para as barras ficarem certinhas
  if (resto.includes('|')) out = out.replace(/\s+\|/g, ' |').replace(/\|\s+/g, '| ').replace(/^\| /, '| ');
  return cab + out;
}

// Transpõe uma cifra inteira (acordes sobre a letra, cabeçalhos [Parte], grade com |)
export function transporCifra(texto, semitons, tomDestino) {
  if (!texto || !semitons) return texto || '';
  const grafia = tomDestino ? grafiaDoTom(lerTom(tomDestino), tomDestino) : COMUM;
  return texto.split('\n').map(l => (ehLinhaDeAcordes(l) ? transporLinha(l, semitons, grafia) : l)).join('\n');
}

// ---------- Grade harmônica ----------
// Monta um rascunho da grade a partir da cifra: uma linha por parte, um acorde por compasso
// (estimativa; a cifra não diz quanto tempo cada acorde dura). Se a cifra já tiver "|", respeita os compassos dela.
export function gerarGrade(cifra) {
  if (!cifra) return '';
  const partes = []; let atual = null;
  let semNome = 0;
  const nova = (nome, auto = false) => { atual = { nome, auto, compassos: [], comBarras: false, linhas: [] }; partes.push(atual); };
  // "[Intro] G D Em C": a introdução termina na primeira linha em branco ou de letra;
  // o que vem depois, sem nome de parte, vira uma parte própria
  let introAberta = false, separar = false;
  for (const linha of cifra.split('\n')) {
    const cab = linha.match(CABECALHO);
    if (cab) { nova(cab[1].trim()); separar = false; introAberta = ehLinhaDeAcordes(linha) && !!linha.replace(CABECALHO, '').trim(); }
    else if (!ehLinhaDeAcordes(linha)) {
      if (introAberta) { introAberta = false; separar = true; }
      // sem nomes de parte na cifra, cada estrofe (separada por linha em branco) vira uma parte numerada
      else if (!linha.trim() && atual && atual.auto && atual.compassos.length) separar = true;
      continue;
    }
    else if (separar) { nova('Parte ' + (++semNome), true); separar = false; }
    if (!ehLinhaDeAcordes(linha)) continue;
    if (!atual) nova('Parte ' + (++semNome), true);
    const resto = linha.replace(CABECALHO, '');
    const daLinha = [];
    if (resto.includes('|')) {
      atual.comBarras = true;
      resto.split('|').map(s => s.trim()).filter(Boolean)
        .forEach(c => { const ac = c.split(/\s+/).filter(ehAcorde).map(a => a.replace(PONTUACAO, '')); if (ac.length) daLinha.push(ac.join(' ')); });
    } else {
      tokens(resto).forEach(({ t }) => { if (ehAcorde(t)) daLinha.push(t.replace(PONTUACAO, '')); });
    }
    if (daLinha.length) { atual.linhas.push(daLinha); atual.compassos.push(...daLinha); }
  }
  const usadas = partes.filter(p => p.compassos.length);
  if (!usadas.length) return '';
  // partes repetidas com os mesmos acordes aparecem uma vez, com a contagem
  const unicas = [];
  for (const p of usadas) {
    const ja = unicas.find(u => u.nome.toLowerCase() === p.nome.toLowerCase() && u.compassos.join('|') === p.compassos.join('|'));
    if (ja) ja.vezes++; else unicas.push({ ...p, vezes: 1 });
  }
  const estrutura = 'Estrutura: ' + usadas.map(p => p.nome).join(' → ');
  const blocos = unicas.map(p => {
    // linhas seguidas com os mesmos acordes viram uma só, com a contagem
    const grupos = [];
    for (const l of p.linhas) {
      const ult = grupos[grupos.length - 1];
      if (ult && ult.acordes.join('|') === l.join('|')) ult.vezes++; else grupos.push({ acordes: l, vezes: 1 });
    }
    // junta grupos simples em linhas de até 4 compassos; grupos repetidos ficam numa linha própria
    const linhas = []; let fila = [];
    const descarregar = () => { for (let i = 0; i < fila.length; i += 4) linhas.push('| ' + fila.slice(i, i + 4).join(' | ') + ' |'); fila = []; };
    for (const g of grupos) {
      if (g.vezes > 1) { descarregar(); linhas.push('| ' + g.acordes.join(' | ') + ` |  (${g.vezes}x)`); }
      else fila.push(...g.acordes);
    }
    descarregar();
    return `[${p.nome}]${p.vezes > 1 ? ` (${p.vezes}x)` : ''}\n` + linhas.join('\n');
  });
  return [estrutura, '', blocos.join('\n\n')].join('\n');
}

// ---------- Letra a partir da cifra ----------
const CABECALHO_L = /^\s*\[([^\]]+)\]/;
// Letra para o cantor: a cifra sem as linhas de acordes; partes sem letra (introdução, solo) saem
export function letraDaCifra(cifra) {
  if (!cifra) return '';
  const blocos = []; let atual = { cab: null, linhas: [] };
  for (const l of cifra.split('\n')) {
    const cab = l.match(CABECALHO_L);
    if (cab) {
      blocos.push(atual);
      const resto = l.replace(CABECALHO_L, '').trim();
      // "[Intro] G D Em C" é instrumental: a letra que vem depois fica sem nome de parte
      if (resto && ehLinhaDeAcordes(resto)) { atual = { cab: null, linhas: [] }; continue; }
      atual = { cab: '[' + cab[1].trim() + ']', linhas: [] };
      if (resto) atual.linhas.push(resto);
      continue;
    }
    if (ehLinhaDeAcordes(l)) continue;
    if (/^\s*capotraste/i.test(l)) continue;
    atual.linhas.push(l.trim().replace(/\s{2,}/g, ' '));
  }
  blocos.push(atual);
  return blocos
    .filter(b => b.linhas.some(x => x.trim()))
    .map(b => [b.cab, ...b.linhas].filter(x => x !== null).join('\n').replace(/\n{3,}/g, '\n\n').trim())
    .join('\n\n');
}
